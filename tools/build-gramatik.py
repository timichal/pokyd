#!/usr/bin/env python3
r"""Build the author's rule compiler and recompile the rule base.

Phase 2.3 of PLAN.md.  `GRAMATIK.C` is the little C program that turns the
readable `GRAMATIK.IQZ` into the obfuscated `IQPOKYD.IQP` the engine loads.  It
shipped in the source drop next to its own output, so we can rebuild the rule
base from text instead of trusting a 2004 binary -- and, in passing, find out
whether the two agree.  They do; see `--compare` below.

What gets built, and from where
-------------------------------
Straight out of `original/`, byte for byte, with **no patch and no working copy**.
That is deliberate, and it is why this tool does not follow the `src/engine/`
convention that the engine itself follows:

  * `GRAMATIK.C` is not part of `Aplikace/`, so `gen-src.py` never mirrored it and
    `transcode.py` has no opinion about it.
  * It needs no patch.  It compiles on this toolchain as it stands -- six warnings,
    catalogued below, none of them fatal -- so there is nothing for `PATCHES.md` to
    record and nothing for a human to edit.  A canonical UTF-8 copy would be a tree
    whose only purpose was to be identical to the archive.
  * It is a *build-time* tool, not part of the shipped engine.  Its output is data.

If it ever does need a patch, that is the moment to give it a copy under `src/`
and an entry in `PATCHES.md` -- not before.

Names are lowercased on the way into `build/gramatik/` for the same reason
`gen-src.py` lowercases: `main()` opens `"gramatik.iqz"` in lower case with a bare
relative name, so on a case-sensitive host the archive's `GRAMATIK.IQZ` would not
be found.  The output name `IQPOKYD.IQP` is upper case because the program
hardcodes it that way, and because that is what `KONSTANT.K` tells the engine to
look for.

Encoding: none.  `GRAMATIK.C` is CP1250 like the rest of the corpus -- its
`UPRAV_SLOVO_PRO_IQPOKYD` switches on `'ď'`, `'ť'`, `'ň'` as single bytes -- and we
hand gcc those bytes unchanged.  No `-finput-charset`, no transcoding step: with
input and execution charset both left alone, gcc copies the bytes through, which
is exactly what MSVC 6 did with them.  This is the same argument as `src/README.md`
makes for the engine, minus the UTF-8 working copy.

The flags
---------
The engine's, from `tools/build.py`, minus the C++ and MFC ones:

-std=gnu89              `void main(void)`, and a `malloc` whose `void *` is assigned
                        to a `char *` without a cast.  This is 2005 C, not C++, and
                        it does not compile as C++ at all.
-fsigned-char           Hazard 1.  The whole back half of `main()` is `char`
                        arithmetic that wraps -- the obfuscator, the mood byte
                        (`100+(line[1]-'0')`), and `SPOCITEJ_KONTROLNI_SOUCET`.
                        The checksums come out the same either way, but the flag is
                        set so this tool and the engine that reads its output are
                        never on opposite sides of hazard 1.
-fwrapv                 Hazard 4, same reason as the engine.
-fno-strict-aliasing    Hazard 4.
-O1                     Hazard 4.  Matching the engine's optimisation level keeps
                        one variable out of the comparison.
-Wall                   Kept on, and the six hits are the inventory, not noise:
                          1x -Wmain             `void main(void)`
                          2x -Wformat= 'v'      `printf("100% vyznam ...")` -- a bare
                                                `%` in an error path's literal
                          2x -Wformat=          `%lu` handed an `int` at :340 and a
                                                `char *` at :341, both error paths
                          1x -Warray-bounds=    `strcpy(prostoridslov,"<14 spaces>")`
                                                into a `char[14]`: 15 bytes into 14.
                        The last one is a real out-of-bounds write and it is left
                        alone.  `prostoridslov` is a global declared in the middle of
                        `char header[5000],prostoridslov[14],ch;`, so the stray
                        NUL lands on `ch` or on padding, and `ch` is not read
                        until after the final `strcpy` has run for the last time.
                        Harmless in 2005, harmless here, and provably so: the output
                        is byte-identical to the file the author shipped.

`src/shim/nahoda.h` is force-included and `src/shim/nahoda.cpp` linked in, so the
obfuscation padding is drawn from the Microsoft CRT's LCG -- the generator the 2005
build actually used.  `PATCHES.md` records that ucrt64's own `rand()` is that same
sequence, so this is a verified no-op on this toolchain; it is here so the tool
keeps rolling the author's dice on a toolchain where it would not be.

Determinism, and the stamp file
-------------------------------
`ZAPIS_HLAVICKU` does `srand(time(NULL))` and then writes 0-99 bytes of padding and
a one-byte key, so **two runs a second apart produce different files**.  That is the
author's design -- the comment says "pro zmateni hackera" -- and it is not patched
out.  It costs the reader nothing, because the key is stored in the header and any
reader decodes the body regardless; what it would cost is a rule base that churns on
every `tools/build.py`, which phase 2.5 chose to make the shipping artefact.

So the rebuild is conditional instead.  `build/gramatik/fingerprint.txt` holds a SHA-256 of
everything the output depends on -- both archive files, the `nahoda` shim, the
compilers and the flags -- and the compile and run are skipped while it matches.  The
bytes are derived from source, and they stay put until the source moves.  `--force`
rebuilds regardless.  The *verification* below is not conditional: it runs every time,
rebuilt or not, because it is cheap and because it is the only thing that says the
file on disk is one the engine will load.

Usage
-----
    python3 tools/build-gramatik.py           # build if stale, verify, compare
    python3 tools/build-gramatik.py -f -v     # rebuild regardless, show every command
    python3 tools/build-gramatik.py --dump build/gramatik/rules.txt
    python3 tools/build-gramatik.py -q        # one line; what tools/build.py calls
"""

import argparse
import hashlib
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "original" / "IQ Pokyd" / "Data" / "Intelig"
SHIM = ROOT / "src" / "shim"
OUT = ROOT / "build" / "gramatik"

SOURCE = "gramatik.c"          # lower case: see the docstring
INPUT = "gramatik.iqz"        # lower case: main() fopen()s this exact name
OUTPUT = "IQPOKYD.IQP"        # upper case: main() fopen()s this exact name

CC = "gcc"
CXX = "g++"

CFLAGS = [
    "-std=gnu89",
    "-fsigned-char", "-fwrapv", "-fno-strict-aliasing", "-O1",
    # GRAMATIK.C:206 overflows a global by one byte, and this is the flag that
    # lets it.  `char prostoridslov[14]` gets `strcpy(prostoridslov,"<14 spaces>")`
    # -- fourteen characters and the terminator the author forgot to count, so
    # the NUL lands on the byte after the array.  MinGW never noticed; Ubuntu's
    # gcc enables _FORTIFY_SOURCE by default, and __strcpy_chk aborts the run
    # with *** buffer overflow detected *** before a single rule is compiled.
    #
    # Turned off rather than patched, because `no patch, no working copy` is the
    # whole claim of this script and phase 2.4's evidence rests on it.  The
    # overflow is benign in effect and the file itself says why: prostoridslov
    # is only ever indexed (`:289`, `:293`), never read as a string, so nothing
    # wants that terminator, and the byte lands on `znak` or its padding -- a
    # scratch character reassigned before every use.  We do not have to take
    # that on trust either: the equivalence check below compares the rules this
    # produces against the shipped IQPOKYD.IQP byte for byte, so a byte that
    # landed somewhere that mattered would fail the build rather than ship.
    #
    # CFLAGS only.  Nothing of ours is exempted -- CXXFLAGS compiles
    # src/shim/nahoda.cpp and keeps every check it has.
    "-U_FORTIFY_SOURCE",
    "-Wall",
    "-I", str(SHIM), "-include", str(SHIM / "nahoda.h"),
]
CXXFLAGS = ["-std=gnu++98", "-fsigned-char", "-fwrapv", "-fno-strict-aliasing", "-O1",
            "-Wall", "-I", str(SHIM)]

# CODING_BYTE and the two macros around it, from Slovnik/SLOVNIK.PR:14-17.
# Named in English here like the rest of our code; the engine's own name is above.
CODING_BYTE = ord("K")
HEADER_KEY = ord("I")      # the second constant ZAPIS_HLAVICKU mixes in


def encode_byte(b: int) -> int:
    return ((b + CODING_BYTE) & 0xFF) ^ CODING_BYTE


def decode_byte(b: int) -> int:
    return ((b ^ CODING_BYTE) - CODING_BYTE) & 0xFF


class BadFile(Exception):
    pass


def checksums(data) -> tuple[int, int]:
    """SPOCITEJ_KONTROLNI_SOUCET, the engine's pair of one-byte checksums."""
    s1 = s2 = 0
    for b in data:
        s1 = (s1 + b) & 0xFF
        s2 = ((s2 ^ b) + b) & 0xFF
    return s1, s2


def read_iqp(path: Path) -> dict:
    r"""Decode an `IQPOKYD.IQP` exactly as `PRECTI_INTELIGENCI_ZE_SOUBORU` does.

    `Slovnik/SLOVNIK.FU:1348`.  Both checksums are verified, so a file that gets
    through here is one the engine will accept.  The returned `strings` are the
    1456 strings (182 conditions plus 7 answers each) still in the engine's own
    ZAKODOVANY_ZNAK form, which is how they live in `g_databazeiqpodminek`; the
    dump path is the only thing that un-applies it.
    """
    d = path.read_bytes()

    end = d.find(0)
    if end < 0 or end > 500:
        raise BadFile("no identification text")
    pos = end + 1
    banner = d[:end]

    padding = d[pos] ^ HEADER_KEY
    pos += 1 + padding
    key = d[pos] ^ HEADER_KEY
    pos += 1

    header = d[pos:pos + 9]
    if len(header) != 9:
        raise BadFile("truncated header")
    fields = [(((b - key) & 0xFF) ^ CODING_BYTE) for b in header[:7]]

    # The checksum covers everything up to and including the 7 decoded bytes, with
    # the key counted in its decoded form -- that is what the reader has in
    # `header[]` at that point.
    s1, s2 = checksums(list(d[:pos - 1]) + [key] + fields)
    if (s1, s2) != (header[7], header[8]):
        raise BadFile(f"header checksum {s1:#04x},{s2:#04x} != "
                           f"{header[7]:#04x},{header[8]:#04x}")
    if fields[0] != 3:
        raise BadFile(f"signature {fields[0]}, expected 3")
    if (fields[1], fields[2], fields[3]) != (0, 15, 0):
        raise BadFile(f"version {fields[1]}.{fields[2]} data {fields[3]}, expected 0.15 / 0")
    if fields[4] != CODING_BYTE:
        raise BadFile(f"CODING_BYTE {fields[4]:#04x}, expected {CODING_BYTE:#04x}")

    rules = (fields[5] << 8) | fields[6]
    pos += 9

    # The body: 8 NUL-terminated strings per condition.  Each byte is undone with
    # its position *within its own string*, which resets at every terminator.
    strings = []
    line = bytearray()
    col = 0
    s1 = s2 = 0
    while len(strings) < rules * 8:
        if pos >= len(d):
            raise BadFile(f"truncated after {len(strings)} strings")
        ch = (d[pos] - key) & 0xFF
        ch ^= HEADER_KEY
        ch = (ch + (col ^ CODING_BYTE)) & 0xFF
        ch ^= key
        s1 = (s1 + ch) & 0xFF
        s2 = ((s2 ^ ch) + ch) & 0xFF
        pos += 1
        col += 1
        if ch == 0:
            strings.append(bytes(line))
            line = bytearray()
            col = 0
        else:
            line.append(ch)

    if pos + 2 > len(d):
        raise BadFile("missing trailing checksums")
    if (s1, s2) != (d[pos], d[pos + 1]):
        raise BadFile(f"body checksum {s1:#04x},{s2:#04x} != "
                           f"{d[pos]:#04x},{d[pos + 1]:#04x}")
    rest = len(d) - (pos + 2)
    if rest:
        raise BadFile(f"{rest} trailing byte(s) after the checksums")

    return {
        "banner": banner,
        "padding": padding,
        "key": key,
        "rules": rules,
        "strings": strings,
        "body_len": pos + 2 - (end + 1 + 1 + padding + 1 + 9),
        "length": len(d),
    }


def write_dump(iqp: dict, path: Path) -> None:
    """The decoded rule base as readable CP1250 text, one record per blank-line block."""
    lines = []
    for i in range(iqp["rules"]):
        block = iqp["strings"][i * 8:(i + 1) * 8]
        condition = bytes(decode_byte(b) for b in block[0])
        # The last byte of a condition is the mood delta, written as 100+/-N.
        mood = condition[-1] - 100
        lines.append(b"# " + str(i + 1).encode() + b"  mood " +
                     (b"%+d" % mood) + b"\r\n")
        lines.append(condition[:-1] + b"\r\n")
        for answer in block[1:]:
            lines.append(bytes(decode_byte(b) for b in answer) + b"\r\n")
        lines.append(b"\r\n")
    path.write_bytes(b"".join(lines))


def short(path: Path) -> str:
    """Repo-relative if it is inside the repo, absolute otherwise (`--out` may not be)."""
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def run(cmd, verbose, **kw) -> int:
    if verbose:
        print("  " + " ".join(str(c) for c in cmd))
    return subprocess.call([str(c) for c in cmd], **kw)


# Everything the output depends on.  If none of it moved, the rule base on disk is
# the rule base this script would produce -- give or take the padding, which is the
# whole point of keeping the old one (see `fingerprint`).
def fingerprint(out: Path) -> str:
    r"""A fingerprint of the inputs, so a rebuild happens when something changed.

    Why this exists at all: `ZAPIS_HLAVICKU` seeds from the clock, so rebuilding
    unconditionally would hand the engine -- and phase 9.3's deploy, and anything
    that content-hashes a static asset -- a different `IQPOKYD.IQP` on every single
    `tools/build.py`, for no change in a single rule.  That was the one real cost of
    phase 2.5's decision to build the rule base rather than copy the author's, and
    this is what pays it: the bytes are derived from source, and they stay put until
    the source moves.  `--force` rebuilds anyway.
    """
    h = hashlib.sha256()
    for path in (ARCHIVE / "GRAMATIK.C", ARCHIVE / "GRAMATIK.IQZ",
                  SHIM / "nahoda.h", SHIM / "nahoda.cpp"):
        h.update(path.read_bytes())
    h.update(repr((CC, CXX, CFLAGS, CXXFLAGS, SOURCE, INPUT, OUTPUT)).encode())
    return h.hexdigest()


def compile_rules(out: Path, verbose: bool) -> int:
    """Copy the archive's two files out, build the compiler, run it."""
    # Straight out of the archive, byte for byte.  Copied unconditionally: the
    # archive is read only, so the copy is the only thing that can be stale.
    for name, source in ((SOURCE, ARCHIVE / "GRAMATIK.C"), (INPUT, ARCHIVE / "GRAMATIK.IQZ")):
        (out / name).write_bytes(source.read_bytes())
        print(f"data    {name}  <- {source.relative_to(ROOT)}")

    # `PRECTI_RADEK` takes '\r' as the line terminator and swallows the byte after
    # it, so the input has to be CRLF.  An LF-only checkout runs the whole file
    # together into one line and dies at 10,000 characters -- loudly, but 2,500
    # lines too late to be obvious.  Say so here instead.
    input_bytes = (out / INPUT).read_bytes()
    if input_bytes.count(b"\n") != input_bytes.count(b"\r\n"):
        print(f"error: {INPUT} has LF line endings; PRECTI_RADEK needs CRLF.\n"
              f"       check .gitattributes and re-checkout original/.", file=sys.stderr)
        return 1

    print(f"compiling {SOURCE}")
    if run([CC] + CFLAGS + ["-c", out / SOURCE, "-o", out / "gramatik.o"], verbose):
        return 1
    print("compiling src/shim/nahoda.cpp")
    if run([CXX] + CXXFLAGS + ["-c", SHIM / "nahoda.cpp", "-o", out / "nahoda.o"], verbose):
        return 1
    exe = out / ("gramatik.exe" if sys.platform == "win32" else "gramatik")
    print(f"linking {exe.name}")
    if run([CXX, out / "gramatik.o", out / "nahoda.o", "-o", exe], verbose):
        return 1

    # It opens both files by bare name, so it has to be run in its own directory.
    # `--out` may point anywhere, including off this drive, so no relative_to here.
    #
    # And its exit status is not read, because there is nothing in it to read.
    # GRAMATIK.C:180 is `void main(void)` with no return in it, so on the way out
    # the status is whatever happened to be in the return register: MinGW handed
    # back 0 for twenty years and Linux/gcc hands back garbage, on the very run
    # that printed `Soubor uspesne preveden.`  It is wrong in the other direction
    # too -- all 21 of his error paths call exit(0).
    #
    # What judges the run instead is the file it was supposed to write.  Deleting
    # it first is the load-bearing half of that: without it a compiler that died
    # before writing would leave the previous run's IQPOKYD.IQP in place, and
    # everything below would happily verify yesterday's rules.
    print(f"running {exe.name} in {short(out)}")
    (out / OUTPUT).unlink(missing_ok=True)
    status = run([exe], verbose, cwd=out)
    if not (out / OUTPUT).is_file():
        print(f"error: {exe.name} wrote no {OUTPUT}.  It exited {status}, which on a"
              f" void main() means nothing either way -- read what it printed.",
              file=sys.stderr)
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-v", "--verbose", action="store_true", help="show every command")
    ap.add_argument("-q", "--quiet", action="store_true",
                    help="one line instead of the full verification (tools/build.py uses this)")
    ap.add_argument("-f", "--force", action="store_true",
                    help="rebuild even if the inputs have not changed")
    ap.add_argument("-o", "--out", type=Path, default=OUT, help="build directory")
    ap.add_argument("--dump", type=Path,
                    help="also write the decoded rule base there (CP1250, CRLF)")
    args = ap.parse_args()

    for source in (ARCHIVE / "GRAMATIK.C", ARCHIVE / "GRAMATIK.IQZ"):
        if not source.is_file():
            print(f"missing {source.relative_to(ROOT)}", file=sys.stderr)
            return 1

    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    stamp = out / "fingerprint.txt"
    fingerprint_now = fingerprint(out)

    up_to_date = (not args.force and (out / OUTPUT).is_file() and stamp.is_file()
                and stamp.read_text(encoding="ascii").strip() == fingerprint_now)
    if up_to_date:
        if not args.quiet:
            print(f"{OUTPUT} is up to date (inputs unchanged); --force to rebuild")
    else:
        if compile_rules(out, args.verbose):
            return 1
        stamp.write_text(fingerprint_now + "\n", encoding="ascii")

    # Verified on every run, rebuilt or not: decoding is milliseconds and it is the
    # only thing that says the file on disk is one the engine will actually load.
    try:
        built = read_iqp(out / OUTPUT)
    except BadFile as e:
        print(f"error: {out / OUTPUT} is not loadable: {e}", file=sys.stderr)
        return 1

    if args.dump:
        args.dump.parent.mkdir(parents=True, exist_ok=True)
        write_dump(built, args.dump)

    # Phase 2.4: the shipped file, decoded the same way, and compared where a
    # comparison means something -- the rule stream, not the obfuscation around it.
    # This is the standing proof that building from `GRAMATIK.IQZ` (phase 2.5) gives
    # the visitor the same IQ Pokyd the author released, so it runs every build.
    shipped_path = ARCHIVE / "IQPOKYD.IQP"
    shipped = None
    if shipped_path.is_file():
        try:
            shipped = read_iqp(shipped_path)
        except BadFile as e:
            print(f"error: shipped {shipped_path.name} is not loadable: {e}", file=sys.stderr)
            return 1

    same = shipped is not None and built["strings"] == shipped["strings"]

    if args.quiet:
        state = ("identical to the shipped rule base" if same else
                "DIFFERS from the shipped rule base" if shipped else "shipped file absent")
        print(f"rules   {OUTPUT}: {built['rules']} rules, "
              f"{len(built['strings'])} strings, checksums verify, {state}")
    else:
        print(f"\n{OUTPUT}: {built['length']} B, {built['rules']} rules, "
              f"{len(built['strings'])} strings, both checksums verify")
        print(f"         header {built['banner'].decode('cp1250')!r}")
        print(f"         {built['padding']} padding byte(s), "
              f"key {built['key']:#04x} -- both random, redrawn on every rebuild")
        if args.dump:
            print(f"         dumped to {args.dump}")
        if shipped is not None:
            print(f"\nshipped {shipped_path.name}: {shipped['length']} B, "
                  f"{shipped['rules']} rules, {len(shipped['strings'])} strings, "
                  f"both checksums verify")
            print(f"         header {shipped['banner'].decode('cp1250')!r}")
            print("\ncompared:")
            print(f"  rule stream   {'identical' if same else 'DIFFERS'}  "
                  f"({len(shipped['strings'])} strings, "
                  f"{sum(len(s) for s in shipped['strings'])} B)")
            print(f"  header text   "
                  f"{'identical' if built['banner'] == shipped['banner'] else 'differs'}")
            print(f"  obfuscation   {built['padding']} vs "
                  f"{shipped['padding']} padding bytes, "
                  f"key {built['key']:#04x} vs {shipped['key']:#04x}  (random, as designed)")

    if shipped is not None and not same:
        differ = [i for i in range(min(len(built["strings"]), len(shipped["strings"])))
                if built["strings"][i] != shipped["strings"][i]]
        print(f"\nerror: the rebuilt rule base is not the one the author shipped -- "
              f"{len(differ)} of {len(shipped['strings'])} strings differ.", file=sys.stderr)
        for i in differ[:5]:
            print(f"  rule {i // 8 + 1}, line {i % 8 + 1}:", file=sys.stderr)
            print(f"    shipped {shipped['strings'][i]!r}", file=sys.stderr)
            print(f"    rebuilt {built['strings'][i]!r}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
