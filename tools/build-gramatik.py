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
                        (`100+(radek[1]-'0')`), and `SPOCITEJ_KONTROLNI_SOUCET`.
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
                        `char hlavicka[5000],prostoridslov[14],znak;`, so the stray
                        NUL lands on `znak` or on padding, and `znak` is not read
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

So the rebuild is conditional instead.  `build/gramatik/otisk.txt` holds a SHA-256 of
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
ARCHIV = ROOT / "original" / "IQ Pokyd" / "Data" / "Intelig"
SHIM = ROOT / "src" / "shim"
OUT = ROOT / "build" / "gramatik"

ZDROJ = "gramatik.c"          # lower case: see the docstring
VSTUP = "gramatik.iqz"        # lower case: main() fopen()s this exact name
VYSTUP = "IQPOKYD.IQP"        # upper case: main() fopen()s this exact name

CC = "gcc"
CXX = "g++"

CFLAGS = [
    "-std=gnu89",
    "-fsigned-char", "-fwrapv", "-fno-strict-aliasing", "-O1",
    "-Wall",
    "-I", str(SHIM), "-include", str(SHIM / "nahoda.h"),
]
CXXFLAGS = ["-std=gnu++98", "-fsigned-char", "-fwrapv", "-fno-strict-aliasing", "-O1",
            "-Wall", "-I", str(SHIM)]

# KODOVACI_ZNAK and the two macros around it, from Slovnik/SLOVNIK.PR:14-17.
KODOVACI_ZNAK = ord("K")
KLIC_HLAVICKY = ord("I")      # the second constant ZAPIS_HLAVICKU mixes in


def zakoduj_znak(b: int) -> int:
    return ((b + KODOVACI_ZNAK) & 0xFF) ^ KODOVACI_ZNAK


def dekoduj_znak(b: int) -> int:
    return ((b ^ KODOVACI_ZNAK) - KODOVACI_ZNAK) & 0xFF


class ChybnySoubor(Exception):
    pass


def kontrolni_soucty(bajty) -> tuple[int, int]:
    """SPOCITEJ_KONTROLNI_SOUCET, the engine's pair of one-byte checksums."""
    s1 = s2 = 0
    for b in bajty:
        s1 = (s1 + b) & 0xFF
        s2 = ((s2 ^ b) + b) & 0xFF
    return s1, s2


def precti_iqp(cesta: Path) -> dict:
    r"""Decode an `IQPOKYD.IQP` exactly as `PRECTI_INTELIGENCI_ZE_SOUBORU` does.

    `Slovnik/SLOVNIK.FU:1348`.  Both checksums are verified, so a file that gets
    through here is one the engine will accept.  The returned `retezce` are the
    1456 strings (182 conditions plus 7 answers each) still in the engine's own
    ZAKODOVANY_ZNAK form, which is how they live in `g_databazeiqpodminek`; the
    dump path is the only thing that un-applies it.
    """
    d = cesta.read_bytes()

    konec = d.find(0)
    if konec < 0 or konec > 500:
        raise ChybnySoubor("no identification text")
    poz = konec + 1
    nadpis = d[:konec]

    pocetzbytecnosti = d[poz] ^ KLIC_HLAVICKY
    poz += 1 + pocetzbytecnosti
    klic = d[poz] ^ KLIC_HLAVICKY
    poz += 1

    hlavicka = d[poz:poz + 9]
    if len(hlavicka) != 9:
        raise ChybnySoubor("truncated header")
    pole = [(((b - klic) & 0xFF) ^ KODOVACI_ZNAK) for b in hlavicka[:7]]

    # The checksum covers everything up to and including the 7 decoded bytes, with
    # the key counted in its decoded form -- that is what the reader has in
    # `hlavicka[]` at that point.
    s1, s2 = kontrolni_soucty(list(d[:poz - 1]) + [klic] + pole)
    if (s1, s2) != (hlavicka[7], hlavicka[8]):
        raise ChybnySoubor(f"header checksum {s1:#04x},{s2:#04x} != "
                           f"{hlavicka[7]:#04x},{hlavicka[8]:#04x}")
    if pole[0] != 3:
        raise ChybnySoubor(f"signature {pole[0]}, expected 3")
    if (pole[1], pole[2], pole[3]) != (0, 15, 0):
        raise ChybnySoubor(f"version {pole[1]}.{pole[2]} data {pole[3]}, expected 0.15 / 0")
    if pole[4] != KODOVACI_ZNAK:
        raise ChybnySoubor(f"KODOVACI_ZNAK {pole[4]:#04x}, expected {KODOVACI_ZNAK:#04x}")

    pocetpodminek = (pole[5] << 8) | pole[6]
    poz += 9

    # The body: 8 NUL-terminated strings per condition.  Each byte is undone with
    # its position *within its own string*, which resets at every terminator.
    retezce = []
    radek = bytearray()
    pozicenaradku = 0
    s1 = s2 = 0
    while len(retezce) < pocetpodminek * 8:
        if poz >= len(d):
            raise ChybnySoubor(f"truncated after {len(retezce)} strings")
        znak = (d[poz] - klic) & 0xFF
        znak ^= KLIC_HLAVICKY
        znak = (znak + (pozicenaradku ^ KODOVACI_ZNAK)) & 0xFF
        znak ^= klic
        s1 = (s1 + znak) & 0xFF
        s2 = ((s2 ^ znak) + znak) & 0xFF
        poz += 1
        pozicenaradku += 1
        if znak == 0:
            retezce.append(bytes(radek))
            radek = bytearray()
            pozicenaradku = 0
        else:
            radek.append(znak)

    if poz + 2 > len(d):
        raise ChybnySoubor("missing trailing checksums")
    if (s1, s2) != (d[poz], d[poz + 1]):
        raise ChybnySoubor(f"body checksum {s1:#04x},{s2:#04x} != "
                           f"{d[poz]:#04x},{d[poz + 1]:#04x}")
    zbytek = len(d) - (poz + 2)
    if zbytek:
        raise ChybnySoubor(f"{zbytek} trailing byte(s) after the checksums")

    return {
        "nadpis": nadpis,
        "pocetzbytecnosti": pocetzbytecnosti,
        "klic": klic,
        "pocetpodminek": pocetpodminek,
        "retezce": retezce,
        "delkatela": poz + 2 - (konec + 1 + 1 + pocetzbytecnosti + 1 + 9),
        "delka": len(d),
    }


def zapis_dump(iqp: dict, cesta: Path) -> None:
    """The decoded rule base as readable CP1250 text, one record per blank-line block."""
    radky = []
    for i in range(iqp["pocetpodminek"]):
        blok = iqp["retezce"][i * 8:(i + 1) * 8]
        podminka = bytes(dekoduj_znak(b) for b in blok[0])
        # The last byte of a condition is the mood delta, written as 100+/-N.
        nalada = podminka[-1] - 100
        radky.append(b"# " + str(i + 1).encode() + b"  nalada " +
                     (b"%+d" % nalada) + b"\r\n")
        radky.append(podminka[:-1] + b"\r\n")
        for odpoved in blok[1:]:
            radky.append(bytes(dekoduj_znak(b) for b in odpoved) + b"\r\n")
        radky.append(b"\r\n")
    cesta.write_bytes(b"".join(radky))


def kratce(cesta: Path) -> str:
    """Repo-relative if it is inside the repo, absolute otherwise (`--out` may not be)."""
    try:
        return str(cesta.relative_to(ROOT))
    except ValueError:
        return str(cesta)


def spust(cmd, verbose, **kw) -> int:
    if verbose:
        print("  " + " ".join(str(c) for c in cmd))
    return subprocess.call([str(c) for c in cmd], **kw)


# Everything the output depends on.  If none of it moved, the rule base on disk is
# the rule base this script would produce -- give or take the padding, which is the
# whole point of keeping the old one (see `otisk`).
def otisk(out: Path) -> str:
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
    for cesta in (ARCHIV / "GRAMATIK.C", ARCHIV / "GRAMATIK.IQZ",
                  SHIM / "nahoda.h", SHIM / "nahoda.cpp"):
        h.update(cesta.read_bytes())
    h.update(repr((CC, CXX, CFLAGS, CXXFLAGS, ZDROJ, VSTUP, VYSTUP)).encode())
    return h.hexdigest()


def prelozit(out: Path, verbose: bool) -> int:
    """Copy the archive's two files out, build the compiler, run it."""
    # Straight out of the archive, byte for byte.  Copied unconditionally: the
    # archive is read only, so the copy is the only thing that can be stale.
    for jmeno, zdroj in ((ZDROJ, ARCHIV / "GRAMATIK.C"), (VSTUP, ARCHIV / "GRAMATIK.IQZ")):
        (out / jmeno).write_bytes(zdroj.read_bytes())
        print(f"data    {jmeno}  <- {zdroj.relative_to(ROOT)}")

    # `PRECTI_RADEK` takes '\r' as the line terminator and swallows the byte after
    # it, so the input has to be CRLF.  An LF-only checkout runs the whole file
    # together into one line and dies at 10,000 characters -- loudly, but 2,500
    # lines too late to be obvious.  Say so here instead.
    vstup = (out / VSTUP).read_bytes()
    if vstup.count(b"\n") != vstup.count(b"\r\n"):
        print(f"error: {VSTUP} has LF line endings; PRECTI_RADEK needs CRLF.\n"
              f"       check .gitattributes and re-checkout original/.", file=sys.stderr)
        return 1

    print(f"compiling {ZDROJ}")
    if spust([CC] + CFLAGS + ["-c", out / ZDROJ, "-o", out / "gramatik.o"], verbose):
        return 1
    print("compiling src/shim/nahoda.cpp")
    if spust([CXX] + CXXFLAGS + ["-c", SHIM / "nahoda.cpp", "-o", out / "nahoda.o"], verbose):
        return 1
    exe = out / ("gramatik.exe" if sys.platform == "win32" else "gramatik")
    print(f"linking {exe.name}")
    if spust([CXX, out / "gramatik.o", out / "nahoda.o", "-o", exe], verbose):
        return 1

    # It opens both files by bare name, so it has to be run in its own directory.
    # `--out` may point anywhere, including off this drive, so no relative_to here.
    print(f"running {exe.name} in {kratce(out)}")
    return spust([exe], verbose, cwd=out)


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

    for zdroj in (ARCHIV / "GRAMATIK.C", ARCHIV / "GRAMATIK.IQZ"):
        if not zdroj.is_file():
            print(f"missing {zdroj.relative_to(ROOT)}", file=sys.stderr)
            return 1

    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    razitko = out / "otisk.txt"
    otisk_ted = otisk(out)

    aktualni = (not args.force and (out / VYSTUP).is_file() and razitko.is_file()
                and razitko.read_text(encoding="ascii").strip() == otisk_ted)
    if aktualni:
        if not args.quiet:
            print(f"{VYSTUP} is up to date (inputs unchanged); --force to rebuild")
    else:
        if prelozit(out, args.verbose):
            return 1
        razitko.write_text(otisk_ted + "\n", encoding="ascii")

    # Verified on every run, rebuilt or not: decoding is milliseconds and it is the
    # only thing that says the file on disk is one the engine will actually load.
    try:
        novy = precti_iqp(out / VYSTUP)
    except ChybnySoubor as e:
        print(f"error: {out / VYSTUP} is not loadable: {e}", file=sys.stderr)
        return 1

    if args.dump:
        args.dump.parent.mkdir(parents=True, exist_ok=True)
        zapis_dump(novy, args.dump)

    # Phase 2.4: the shipped file, decoded the same way, and compared where a
    # comparison means something -- the rule stream, not the obfuscation around it.
    # This is the standing proof that building from `GRAMATIK.IQZ` (phase 2.5) gives
    # the visitor the same IQ Pokyd the author released, so it runs every build.
    vydany_soubor = ARCHIV / "IQPOKYD.IQP"
    vydany = None
    if vydany_soubor.is_file():
        try:
            vydany = precti_iqp(vydany_soubor)
        except ChybnySoubor as e:
            print(f"error: shipped {vydany_soubor.name} is not loadable: {e}", file=sys.stderr)
            return 1

    stejne = vydany is not None and novy["retezce"] == vydany["retezce"]

    if args.quiet:
        stav = ("identical to the shipped rule base" if stejne else
                "DIFFERS from the shipped rule base" if vydany else "shipped file absent")
        print(f"rules   {VYSTUP}: {novy['pocetpodminek']} rules, "
              f"{len(novy['retezce'])} strings, checksums verify, {stav}")
    else:
        print(f"\n{VYSTUP}: {novy['delka']} B, {novy['pocetpodminek']} rules, "
              f"{len(novy['retezce'])} strings, both checksums verify")
        print(f"         header {novy['nadpis'].decode('cp1250')!r}")
        print(f"         {novy['pocetzbytecnosti']} padding byte(s), "
              f"key {novy['klic']:#04x} -- both random, redrawn on every rebuild")
        if args.dump:
            print(f"         dumped to {args.dump}")
        if vydany is not None:
            print(f"\nshipped {vydany_soubor.name}: {vydany['delka']} B, "
                  f"{vydany['pocetpodminek']} rules, {len(vydany['retezce'])} strings, "
                  f"both checksums verify")
            print(f"         header {vydany['nadpis'].decode('cp1250')!r}")
            print("\ncompared:")
            print(f"  rule stream   {'identical' if stejne else 'DIFFERS'}  "
                  f"({len(vydany['retezce'])} strings, "
                  f"{sum(len(s) for s in vydany['retezce'])} B)")
            print(f"  header text   "
                  f"{'identical' if novy['nadpis'] == vydany['nadpis'] else 'differs'}")
            print(f"  obfuscation   {novy['pocetzbytecnosti']} vs "
                  f"{vydany['pocetzbytecnosti']} padding bytes, "
                  f"key {novy['klic']:#04x} vs {vydany['klic']:#04x}  (random, as designed)")

    if vydany is not None and not stejne:
        lisi = [i for i in range(min(len(novy["retezce"]), len(vydany["retezce"])))
                if novy["retezce"][i] != vydany["retezce"][i]]
        print(f"\nerror: the rebuilt rule base is not the one the author shipped -- "
              f"{len(lisi)} of {len(vydany['retezce'])} strings differ.", file=sys.stderr)
        for i in lisi[:5]:
            print(f"  rule {i // 8 + 1}, line {i % 8 + 1}:", file=sys.stderr)
            print(f"    shipped {vydany['retezce'][i]!r}", file=sys.stderr)
            print(f"    rebuilt {novy['retezce'][i]!r}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
