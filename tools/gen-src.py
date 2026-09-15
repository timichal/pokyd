#!/usr/bin/env python3
r"""Generate a compilable shim source tree from the read-only original/ archive.

Phase 1.1 of PLAN.md.

The original sources are a single translation unit stitched together by
`VSECHNO.IN`, whose #include lines are hardcoded absolute DOS/Windows paths:

    #include "\!IQPokyd\!Zdrojak\Aplikace\Vzory\sklonov.pr"
    #include "f:\!iqpokyd\aplikace\vzory\sklonov.fu"

No -I flag can reach those: gcc on Windows treats a leading backslash as
"root of the current drive", so the path is absolute and the include search
path is never consulted.  Rather than editing original/ (it is the archive) or
creating directories at a drive root, we copy the tree into build/src/ and
rewrite the include lines to plain relative paths:

    #include "vzory/sklonov.pr"

Everything after the `aplikace` component is kept verbatim, so the generated
tree is a 1:1 mirror.  Names are lowercased because the original is
inconsistent about case (`\!IQPokyd\!Zdrojak\Aplikace\` in one file,
`\!iqpokyd\!Zdrojak\aplikace\` in another) and only worked because Windows
does not care -- Emscripten on a case-sensitive host would.

File *contents* are copied byte-for-byte; the sources stay CP1250 here.
Transcoding to UTF-8 is task 1.2 and gets its own output tree.
"""

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "original" / "IQ Pokyd" / "Aplikace"
OUT = ROOT / "build" / "src"

# Source extensions of the original's own naming scheme:
#   .K  konstanty      .PR prototypy      .TR typy/třídy
#   .H  hlavičky       .FU funkce         .FT funkční tabulky
#   .SK vzory skloňování               .IN include soubory
SOURCE_SUFFIXES = {".in", ".k", ".h", ".pr", ".tr", ".fu", ".ft", ".sk", ".c", ".cpp"}

INCLUDE_RE = re.compile(rb'(#[ \t]*include[ \t]*")([^"\n]+)(")')

# The component the hardcoded prefixes all end with; everything after it is the
# path relative to the root of the generated tree.
ANCHOR = "aplikace"


def rewrite_include_path(raw: str) -> str | None:
    r"""`\!IQPokyd\!Zdrojak\Aplikace\Vzory\sklonov.pr` -> `vzory/sklonov.pr`.

    Returns None for includes that are not engine-internal (left untouched).
    """
    path = raw.replace("\\", "/").lower()
    parts = [p for p in path.split("/") if p not in ("", ".")]
    if ANCHOR not in parts:
        return None
    tail = parts[parts.index(ANCHOR) + 1:]
    if not tail:
        return None
    return "/".join(tail)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-o", "--out", type=Path, default=OUT,
                    help="output tree (default: build/src)")
    ap.add_argument("-v", "--verbose", action="store_true",
                    help="print every rewritten include")
    args = ap.parse_args()

    if not SRC.is_dir():
        print(f"error: {SRC} not found", file=sys.stderr)
        return 1

    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)

    written: set[str] = set()
    wanted: list[tuple[str, str, str]] = []   # (target, source file, original spelling)
    n_files = n_rewritten = n_skipped = 0

    for path in sorted(SRC.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(SRC)
        if path.suffix.lower() not in SOURCE_SUFFIXES:
            n_skipped += 1
            continue

        rel_out = "/".join(p.lower() for p in rel.parts)
        data = path.read_bytes()

        def sub(m: re.Match) -> bytes:
            nonlocal n_rewritten
            raw = m.group(2).decode("ascii", "replace")
            new = rewrite_include_path(raw)
            if new is None:
                return m.group(0)
            n_rewritten += 1
            wanted.append((new, rel_out, raw))
            if args.verbose:
                print(f"  {rel_out}: {raw}  ->  {new}")
            return m.group(1) + new.encode("ascii") + m.group(3)

        data = INCLUDE_RE.sub(sub, data)

        dest = out / rel_out
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        written.add(rel_out)
        n_files += 1

    print(f"{n_files} files -> {out}"
          f"  ({n_rewritten} includes rewritten, {n_skipped} non-source files skipped)")

    missing = [(t, f, raw) for t, f, raw in wanted if t not in written]
    if missing:
        print(f"\nerror: {len(missing)} include(s) do not resolve in the generated tree:",
              file=sys.stderr)
        for target, src_file, raw in missing:
            print(f"  {src_file}: {raw!r} -> {target}", file=sys.stderr)
        return 1

    print(f"all {len(set(t for t, _, _ in wanted))} include targets resolve")
    return 0


if __name__ == "__main__":
    sys.exit(main())
