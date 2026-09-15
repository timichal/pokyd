#!/usr/bin/env python3
r"""Re-encode the engine sources between CP1250 (what the compiler eats) and UTF-8
(what we read, edit and diff).

Phase 1.2 of PLAN.md.

Two trees, one canonical
-----------------------
`src/engine/`   UTF-8. **Canonical.** This is the working copy: what git tracks,
                what `PATCHES.md` describes, what a human edits.
`build/cp1250/` CP1250. Generated. This is what the compiler is pointed at.

The engine is byte-oriented from end to end: it indexes a 28-letter alphabet,
switches on single bytes (`case '\xe8':` -- c-caron in CP1250) and checksums its
own data files.  Its runtime strings therefore have to stay CP1250 no matter what
the *source files* are encoded in.  Two ways to get that from a UTF-8 source tree:

  1. `-fexec-charset=CP1250`.  Works on gcc (via iconv).  Does **not** work on
     the clang that Emscripten ships -- its `-fexec-charset` only knows UTF-8 and
     IBM-1047.  Ruled out: phase 3 is the whole point.
  2. Hand the compiler CP1250 bytes, exactly as MSVC6 got them in 2005, and keep
     UTF-8 for humans only.  No charset flags anywhere, works on every toolchain.

We do (2).  `src/engine/` is never compiled directly; `--to-cp1250` regenerates
`build/cp1250/` from it before every build.

The invariant
-------------
    to_cp1250(to_utf8(x)) == x        for every byte of every file

`--check` asserts exactly that against `build/src/` (the byte-for-byte mirror of
`original/` produced by `gen-src.py`).  So this transcoding provably changes
nothing the compiler can see; it is a re-encoding, not a patch.  Real changes to
original code are phase 1.4's job and get recorded in `PATCHES.md`.

Hex escapes, and the "Latin 2" that isn't
-----------------------------------------
Almost every high byte in the corpus is Czech text (comments, string literals) or
a Czech letter the engine switches on -- all of it CP1250, all of it round-trips
as characters.  The exception is 60 character literals in two functions of
`vstup/vstup.fu`:

    void PREVED_Z_LATIN_2_NA_WINDOWS_1250(char *slovo)
    void PREVED_Z_WINDOWS_1250_NA_LATIN_2(char *slovo)

The author's "Latin 2" is not ISO-8859-2; it is **CP852**, the DOS PC Latin-2
codepage.  All 30 mappings check out against Python's `cp852` table.  Those
literals are byte constants from a foreign codepage, so reading them as CP1250
characters is meaningless -- `case '\xd8'` is c-caron-era CP852 e-caron, but
CP1250 calls 0xd8 R-caron -- and for 0x90 (CP852 E-acute) it is impossible:
CP1250 leaves 0x90 undefined, which is the one byte in the whole tree that fails
to decode.

So on each of those 60 lines the foreign-codepage side becomes `'\xNN'` and the
CP1250 side stays a readable letter:

    case '\xA0': znak='a'-acute; break;      // in PREVED_Z_LATIN_2_...
    case 'a'-acute: znak='\xA0'; break;      // in PREVED_Z_WINDOWS_1250_...

`--to-cp1250` reverses precisely those escapes on precisely those lines, which is
why the round trip is exact.  Nothing else in the tree is escaped, and the tool
refuses to guess: any other byte that will not decode is a hard error.

Usage
-----
    python tools/transcode.py --check                 # verify the invariant
    python tools/transcode.py --to-utf8 [--force]     # build/src/ -> src/engine/
    python tools/transcode.py --to-cp1250             # src/engine/ -> build/cp1250/
"""

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIRROR = ROOT / "build" / "src"          # CP1250 mirror of original/, from gen-src.py
UTF8 = ROOT / "src" / "engine"           # canonical UTF-8 working copy
CP1250 = ROOT / "build" / "cp1250"       # generated; what the compiler is given

SOURCE_SUFFIXES = {".in", ".k", ".h", ".pr", ".tr", ".fu", ".ft", ".sk", ".c", ".cpp"}

# A line of either PREVED_Z_* conversion table:  case 'X': znak='Y'; break;
CASE_LINE = re.compile(rb"^(\s*case ')(.)(' *: *znak=')(.)('; *break; *)$")
CASE_LINE_TEXT = re.compile(r"^(\s*case ')(\\x[0-9A-F]{2}|.)(' *: *znak=')(\\x[0-9A-F]{2}|.)('; *break; *)$")

# Which side of the table holds the foreign (CP852) byte, per enclosing function.
FROM_852 = "PREVED_Z_LATIN_2_NA_WINDOWS_1250("    # case label is CP852
TO_852 = "PREVED_Z_WINDOWS_1250_NA_LATIN_2("      # assigned value is CP852

# Sanity gate: the corpus has exactly this many table lines, 30 per direction.
EXPECTED_CASE_LINES = {FROM_852: 30, TO_852: 30}


class TranscodeError(Exception):
    pass


def _side(cur: str | None) -> tuple[bool, bool]:
    """(escape the case label?, escape the assigned value?) for the current function."""
    return cur == FROM_852, cur == TO_852


def to_utf8(rel: str, data: bytes) -> str:
    """CP1250 source bytes -> UTF-8 text.  Raises on anything that will not decode."""
    out: list[str] = []
    seen = dict.fromkeys(EXPECTED_CASE_LINES, 0)
    cur: str | None = None

    chunks = data.split(b"\n")
    for lineno, raw in enumerate(chunks, 1):
        # Only a \r that is actually followed by \n is a line terminator; a stray
        # one at end of file is content, and has to survive the round trip.
        terminated = lineno < len(chunks)
        crlf = terminated and raw.endswith(b"\r")
        body = raw[:-1] if crlf else raw
        eol = ("\r\n" if crlf else "\n") if terminated else ""

        for name in EXPECTED_CASE_LINES:
            if name.encode() in body:
                cur = name

        m = CASE_LINE.match(body)
        if m and (m[2][0] > 0x7F or m[4][0] > 0x7F):
            seen[cur] = seen.get(cur, 0) + 1
            esc_label, esc_value = _side(cur)
            if not (esc_label or esc_value):
                raise TranscodeError(
                    f"{rel}:{lineno}: byte-table line outside either PREVED_Z_* function")
            parts = [
                _decode(rel, lineno, m[1]),
                _escape(m[2]) if esc_label else _decode(rel, lineno, m[2]),
                _decode(rel, lineno, m[3]),
                _escape(m[4]) if esc_value else _decode(rel, lineno, m[4]),
                _decode(rel, lineno, m[5]),
            ]
            out.append("".join(parts) + eol)
        else:
            out.append(_decode(rel, lineno, body) + eol)

    text = "".join(out)

    if rel.endswith("vstup.fu"):
        for name, want in EXPECTED_CASE_LINES.items():
            if seen[name] != want:
                raise TranscodeError(
                    f"{rel}: expected {want} byte-table lines in {name.rstrip('(')}, found {seen[name]}")
    return text


def to_cp1250(rel: str, text: str) -> bytes:
    """UTF-8 text -> CP1250 source bytes.  The exact inverse of to_utf8()."""
    out: list[bytes] = []
    cur: str | None = None

    chunks = text.split("\n")
    for lineno, raw in enumerate(chunks, 1):
        terminated = lineno < len(chunks)
        crlf = terminated and raw.endswith("\r")
        body = raw[:-1] if crlf else raw
        eol = (b"\r\n" if crlf else b"\n") if terminated else b""

        for name in EXPECTED_CASE_LINES:
            if name in body:
                cur = name

        m = CASE_LINE_TEXT.match(body)
        if m and (len(m[2]) > 1 or len(m[4]) > 1 or ord(m[2]) > 0x7F or ord(m[4]) > 0x7F):
            esc_label, esc_value = _side(cur)
            parts = [
                _encode(rel, lineno, m[1]),
                _unescape(rel, lineno, m[2]) if esc_label else _encode(rel, lineno, m[2]),
                _encode(rel, lineno, m[3]),
                _unescape(rel, lineno, m[4]) if esc_value else _encode(rel, lineno, m[4]),
                _encode(rel, lineno, m[5]),
            ]
            out.append(b"".join(parts) + eol)
        else:
            out.append(_encode(rel, lineno, body) + eol)

    return b"".join(out)


def _decode(rel: str, lineno: int, b: bytes) -> str:
    try:
        return b.decode("cp1250")
    except UnicodeDecodeError as e:
        raise TranscodeError(
            f"{rel}:{lineno}: byte 0x{b[e.start]:02x} at column {e.start + 1} "
            f"is not CP1250; if it is a byte constant it needs an escape rule") from None


def _encode(rel: str, lineno: int, s: str) -> bytes:
    try:
        return s.encode("cp1250")
    except UnicodeEncodeError as e:
        raise TranscodeError(
            f"{rel}:{lineno}: {s[e.start]!r} (U+{ord(s[e.start]):04X}) at column {e.start + 1} "
            f"has no CP1250 encoding -- the engine cannot represent it") from None


def _escape(b: bytes) -> str:
    return f"\\x{b[0]:02X}"


def _unescape(rel: str, lineno: int, s: str) -> bytes:
    if len(s) == 1:
        raise TranscodeError(f"{rel}:{lineno}: expected a \\xNN byte constant, found {s!r}")
    return bytes([int(s[2:], 16)])


def sources(tree: Path) -> list[Path]:
    return sorted(p for p in tree.rglob("*")
                  if p.is_file() and p.suffix.lower() in SOURCE_SUFFIXES)


def rel_of(tree: Path, p: Path) -> str:
    return "/".join(p.relative_to(tree).parts)


def cmd_to_utf8(force: bool) -> int:
    if not MIRROR.is_dir():
        print(f"error: {MIRROR} not found -- run tools/gen-src.py first", file=sys.stderr)
        return 1
    if UTF8.exists() and any(UTF8.rglob("*")) and not force:
        print(f"error: {UTF8} already exists.  It is the canonical tree and may hold "
              f"hand-applied patches; pass --force to overwrite it.", file=sys.stderr)
        return 1

    n = 0
    for p in sources(MIRROR):
        rel = rel_of(MIRROR, p)
        text = to_utf8(rel, p.read_bytes())
        dest = UTF8 / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(text.encode("utf-8"))
        n += 1
    print(f"{n} files -> {UTF8}  (UTF-8, CRLF preserved, no BOM)")
    return 0


def cmd_to_cp1250(out: Path) -> int:
    if not UTF8.is_dir():
        print(f"error: {UTF8} not found -- run --to-utf8 first", file=sys.stderr)
        return 1
    n = 0
    for p in sources(UTF8):
        rel = rel_of(UTF8, p)
        data = to_cp1250(rel, p.read_bytes().decode("utf-8"))
        dest = out / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        n += 1
    print(f"{n} files -> {out}  (CP1250 -- this is what the compiler gets)")
    return 0


def cmd_check() -> int:
    """to_cp1250(to_utf8(x)) == x, for every file, byte for byte."""
    if not MIRROR.is_dir():
        print(f"error: {MIRROR} not found -- run tools/gen-src.py first", file=sys.stderr)
        return 1

    bad = 0
    n_files = n_escapes = 0
    for p in sources(MIRROR):
        rel = rel_of(MIRROR, p)
        original = p.read_bytes()
        try:
            text = to_utf8(rel, original)
            back = to_cp1250(rel, text)
        except TranscodeError as e:
            print(f"  FAIL {rel}: {e}", file=sys.stderr)
            bad += 1
            continue
        n_files += 1
        n_escapes += len(re.findall(r"\\x[0-9A-F]{2}'", text))
        if back != original:
            bad += 1
            i = next(k for k in range(min(len(back), len(original)) + 1)
                     if k == len(back) or k == len(original) or back[k] != original[k])
            line = original.count(b"\n", 0, i) + 1
            print(f"  FAIL {rel}: first difference at byte {i} (line {line}): "
                  f"{original[i:i+8]!r} -> {back[i:i+8]!r}", file=sys.stderr)

    # The UTF-8 tree, if it exists, must transcode back to the same bytes too --
    # this is what catches an editor silently rewriting line endings or dropping
    # the encoding.
    # A file that differs from the original is fine -- that is what a phase 1.4 patch
    # looks like.  A file that will not transcode at all is not, and has to fail loudly.
    drift = broken = 0
    if UTF8.is_dir():
        for p in sources(UTF8):
            rel = rel_of(UTF8, p)
            mirror = MIRROR / rel
            if not mirror.is_file():
                print(f"  note {rel}: present in {UTF8.name}/ but not in the mirror")
                continue
            try:
                back = to_cp1250(rel, p.read_bytes().decode("utf-8"))
            except (TranscodeError, UnicodeDecodeError) as e:
                print(f"  FAIL {rel}: {e}", file=sys.stderr)
                broken += 1
                continue
            if back != mirror.read_bytes():
                drift += 1
                print(f"  diff {rel}: differs from the original (expected after phase 1.4 "
                      f"patches -- check it against PATCHES.md)")

    print(f"round trip: {n_files} files, {n_escapes} byte-constant escapes, "
          f"{bad} failure(s)")
    if UTF8.is_dir():
        state = "clean" if not drift else f"{drift} file(s) differ from the original"
        if broken:
            state += f", {broken} file(s) will not transcode"
        print(f"working copy: {state}")
    return 1 if bad or broken else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--check", action="store_true", help="verify the round trip (default)")
    g.add_argument("--to-utf8", action="store_true", help=f"{MIRROR.name}/ -> {UTF8}")
    g.add_argument("--to-cp1250", action="store_true", help=f"{UTF8} -> {CP1250}")
    ap.add_argument("--force", action="store_true", help="let --to-utf8 overwrite the working copy")
    ap.add_argument("-o", "--out", type=Path, default=CP1250, help="output tree for --to-cp1250")
    args = ap.parse_args()

    try:
        if args.to_utf8:
            return cmd_to_utf8(args.force)
        if args.to_cp1250:
            return cmd_to_cp1250(args.out.resolve())
        return cmd_check()
    except TranscodeError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
