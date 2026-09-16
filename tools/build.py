#!/usr/bin/env python3
r"""Build the engine natively.

Phase 1.3 of PLAN.md: the first real compile.

What gets built
---------------
One translation unit for the engine -- `src/shim/engine.cpp`, which #includes
`vsechno.in` exactly as `!Prostre/IQPokyd.cpp` did, because vsechno.in is not a
header, it is the program -- plus the small `src/shim/` replacement for the
Win32/MFC surface, plus `src/api/`, the exported surface (phase 3.1), plus a
driver if there is one.

The compiler is pointed at `build/cp1250/`, never at `src/engine/`.  This script
regenerates that tree first (tools/transcode.py --to-cp1250), so a build can
never be one edit stale.  See src/README.md.

The flags, and why each one
---------------------------
-std=gnu++98            The corpus predates C++11 and has 10 `"text "MACRO` string
                        concatenations that C++11 reads as user-defined literals
                        (hazard 8).  Also the closest thing to what MSVC 6 gave it.
-fsigned-char           Hazard 1.  The dictionary checksums, DEKODOVANY_ZNAK and
                        the mood delta all rely on `char` wrapping negative.  x86
                        gcc already defaults to signed; wasm clang does not, so the
                        flag is written down here rather than assumed.
-fwrapv                 Hazard 4: signed overflow is relied on, not avoided.
-fno-strict-aliasing    Hazard 4: 2005 C++, globals and casts everywhere.
-O1                     Hazard 4 again.  -O2 is not safe to reach for without
                        re-diffing the output.  Since 1.6 there is something to diff
                        against: test/golden/ holds a conversation and the command that
                        produced it, so a flag change is one cmp away from an answer.
-DBEZ_PROSTREDI=1       Drops Aplikace/Prostred/, the MFC window.  It has to be 1
                        and not merely defined: Debug/DEBUG.FU:115 tests
                        `BEZ_PROSTREDI == 1`, and an empty macro makes that line a
                        preprocessor syntax error.
-Wall                   Kept on deliberately.  It is how hazard 4 gets an inventory:
                        7 -Wmaybe-uninitialized hits, one of them the
                        `nejlepsiodpoved` read PLAN.md predicted.  The surviving
                        warnings are catalogued in PLAN.md 1.3 -- read them, do not
                        silence them.
-Wno-write-strings      1588 hits of `char *p = "literal"`, the pre-ISO C++ idiom,
                        in code we are not going to change.
-Wno-misleading-indentation
                        57 hits, all of them the author's one-space indent style.
                        Formatting, not meaning.

IQPOKYDWINMFC is not set here.  engine.cpp defines it to 0, which is what selects
the author's own console paths (printf progress instead of SetWindowText, plain
fopen instead of GetModuleFileName).

Usage
-----
    python tools/build.py            # objects + link check (or the driver, if present)
    python tools/build.py --wasm     # phase 3.2: the wasm module, via emcc
    python tools/build.py -v         # show every command
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHIM = ROOT / "src" / "shim"
API = ROOT / "src" / "api"                   # phase 3.1: pokyd_api.h, the exported surface
DRIVER = ROOT / "src" / "driver"             # phase 1.5 lives here; absent until then
CP1250 = ROOT / "build" / "cp1250"
OUT = ROOT / "build" / "native"
RUN = ROOT / "build" / "run"                 # where the driver is meant to be run

# What the engine expects to find next to itself, and where we take it from.
# The names are KONSTANT.K's (JMENO_ZAKLADNIHO_SLOVNIKU, JMENO_SOUBORU_S_INTELIGENCI)
# and OTEVRI_SOUBOR opens them by bare name in the current directory.
#
# slovnik.iqp is the full 11,207-word dictionary lifted from the released binary,
# not the 301-word remnant in the source drop -- PLAN.md 2.2.
#
# IQPOKYD.IQP is *built*, not copied: PLAN.md 2.5 chose to compile it from the
# readable GRAMATIK.IQZ with the author's own GRAMATIK.C rather than ship the 2004
# binary next to it.  That is only defensible because 2.4 proved the two agree on
# all 1,456 strings, so tools/build-gramatik.py re-proves it on every build and
# fails the build if they ever stop agreeing.
GRAMATIK = ROOT / "build" / "gramatik"
DATA = {
    "SLOVNIK.IQP": ROOT / "original" / "slovnik.iqp",
    "IQPOKYD.IQP": GRAMATIK / "IQPOKYD.IQP",
}
CACHE = "SLOVNIK.TMP"        # the inflected dictionary, written by the engine

CXX = "g++"

# --- Emscripten, phase 3.2 --------------------------------------------------
#
# emcc is looked up by absolute path and deliberately *not* expected on PATH.
# Sourcing emsdk_env puts emsdk's own node (24.19.0) ahead of the system node
# (24.20.0) that PLAN.md 3.3 pins as the smoke-test runner, and an activated
# emsdk is one more thing a second machine has to reproduce exactly.  Nothing
# here needs either: emcc resolves `.emscripten` relative to itself, so an
# un-activated, un-PATHed install works as it stands.
#
# Order of search: POKYD_EMCC, then $EMSDK, then the usual install roots, then
# PATH as a last resort for whoever does have it activated.
EMSDK_ROOTS = [
    Path("C:/Program Files/emsdk"),
    Path("C:/emsdk"),
    Path.home() / "emsdk",
    Path("/usr/lib/emsdk"),
]

# Where the sysroot cache goes when the shipped one cannot be written.  An emsdk
# under C:/Program Files has a 602 MB cache/ that needs elevation to touch, and
# the first link wants to write to it.  This is a cache, so it belongs in the
# user's cache directory -- not in build/, which is meant to be deletable.
EM_CACHE = Path(os.environ.get("LOCALAPPDATA") or Path.home() / ".cache") / "pokyd" / "emcache"

WASM = ROOT / "build" / "wasm"

# The 15 of pokyd_api.h, plus the allocator: the CP1250 boundary in phase 4.1 has
# to put bytes into the heap itself, because there is no UTF-8 helper that will do
# it for a code page.  The leading underscore is the C symbol as the linker sees it.
EXPORTS = [
    "_pokyd_init", "_pokyd_load_dictionaries", "_pokyd_shutdown", "_pokyd_error",
    "_pokyd_say", "_pokyd_sentence_count", "_pokyd_seed",
    "_pokyd_get_settings", "_pokyd_set_settings", "_pokyd_set_mood",
    "_pokyd_progress", "_pokyd_phase",
    "_pokyd_export_cache", "_pokyd_import_cache", "_pokyd_free",
    "_malloc", "_free",
]

# --no-entry because src/driver/ is left out of this build: it has a main(), and
# 3.2 builds a library.  The data files go into /pokyd/ in MEMFS, which is the
# directory pokyd_init() chdir()s into -- the engine opens every file by bare name
# in the current directory and writes the 17 MB SLOVNIK.TMP next to them, so it
# has to be writable.  Hence ALLOW_MEMORY_GROWTH, which the inflected dictionary
# needs on its own account anyway.
WASM_LINK = [
    "--no-entry",
    "-sMODULARIZE=1",
    "-sEXPORT_NAME=PokydModule",
    "-sALLOW_MEMORY_GROWTH=1",
    "-sINVOKE_RUN=0",
    "-sEXPORTED_FUNCTIONS=" + ",".join(EXPORTS),
    "-sEXPORTED_RUNTIME_METHODS=ccall,cwrap,FS,HEAPU8",
]

STD = ["-std=gnu++98"]
HAZARDS = ["-fsigned-char", "-fwrapv", "-fno-strict-aliasing", "-O1"]
DEFINES = ["-DBEZ_PROSTREDI=1"]
INCLUDES = ["-I", str(SHIM), "-I", str(API), "-I", str(CP1250)]
WARNINGS = ["-Wall", "-Wno-write-strings", "-Wno-misleading-indentation"]

CXXFLAGS = STD + HAZARDS + DEFINES + WARNINGS + INCLUDES

# A main() for when there is no driver yet.  Its only job is to make the linker
# resolve every reference in the engine object, which is the phase 1.3 gate.
LINKCHECK = r"""/* Generated by tools/build.py -- phase 1.3 link check, replaced by src/driver/. */
#include "engine.h"

int main(void) {
  printf("link check: engine linked.  Nastaveni %u B, answer buffer %u B, "
         "Struktura_vety %u B\n",
         (unsigned)sizeof(g_nastaveni), (unsigned)sizeof(g_odpovedpocitace),
         (unsigned)sizeof(g_vetacloveka));
  return 0;
 }
"""


def find_emcc():
    """Locate emcc without requiring it on PATH.  Returns (Path, None) or (None, why)."""
    override = os.environ.get("POKYD_EMCC")
    if override:
        candidate = Path(override)
        if candidate.is_file():
            return candidate, None
        return None, f"POKYD_EMCC is set to {candidate}, which is not a file"

    roots = []
    if os.environ.get("EMSDK"):
        roots.append(Path(os.environ["EMSDK"]))
    roots += EMSDK_ROOTS
    for root in roots:
        for name in ("emcc.exe", "emcc.bat", "emcc"):
            candidate = root / "upstream" / "emscripten" / name
            if candidate.is_file():
                return candidate, None

    found = shutil.which("emcc")
    if found:
        return Path(found), None

    return None, ("no emcc.  Looked at POKYD_EMCC, $EMSDK, "
                  + ", ".join(str(k) for k in EMSDK_ROOTS) + ", and PATH.\n"
                  "Install it with:  git clone https://github.com/emscripten-core/emsdk\n"
                  "then emsdk install latest && emsdk activate latest.  Activating is\n"
                  "enough; it does not have to go on PATH.  Or point POKYD_EMCC straight\n"
                  "at the emcc executable.")


def em_environment(emcc, verbose):
    """The environment emcc runs in.  Two variables, both about staying out of the way.

    EM_CONFIG pins the .emscripten next to the install rather than whatever a
    stray ~/.emscripten might say.  EM_CACHE moves the sysroot cache somewhere
    writable when the shipped one is not -- an install under C:/Program Files
    needs elevation, and the first link fails on it otherwise.  Redirecting means
    emscripten rebuilds the handful of libs this build actually uses, once.

    Both are setdefault, so an activated emsdk keeps its own answers.
    """
    env = dict(os.environ)
    root = emcc.parent.parent.parent          # <emsdk>/upstream/emscripten/emcc

    config = root / ".emscripten"
    if config.is_file():
        env.setdefault("EM_CONFIG", str(config))

    cache_dir = emcc.parent / "cache"
    try:
        probe = cache_dir / ".pokyd-write-test"
        probe.touch()
        probe.unlink()
        writable = True
    except OSError:
        writable = False
    if not writable:
        EM_CACHE.mkdir(parents=True, exist_ok=True)
        env.setdefault("EM_CACHE", str(EM_CACHE))
        if verbose:
            print(f"  {cache_dir} is not writable, EM_CACHE -> {EM_CACHE}")

    return env


def build_wasm(args):
    """Phase 3.2.  Engine + shim + api to a MODULARIZE'd wasm module.

    The compile flags are the native ones unchanged: the hazard set is not a g++
    preference, it is the engine's requirement.  -fsigned-char most of all --
    x86 g++ defaults to signed and wasm clang does not, so this is the build
    where dropping it silently changes the dictionary checksums (hazard 1).
    """
    emcc, why = find_emcc()
    if emcc is None:
        print(why)
        return 1
    print(f"emcc    {emcc}")
    env = em_environment(emcc, args.verbose)

    # The preloaded files come from build/run/, under the bare names KONSTANT.K
    # expects.  Same layout the native driver is run in.
    if prepare_run_dir():
        return 1

    WASM.mkdir(parents=True, exist_ok=True)
    sources = sorted(SHIM.glob("*.cpp")) + sorted(API.glob("*.cpp"))

    objects = []
    for src in sources:
        obj = WASM / (src.stem + ".o")
        print(f"compiling {src.relative_to(ROOT)}")
        if run([emcc] + CXXFLAGS + ["-c", src, "-o", obj], args.verbose, env):
            return 1
        objects.append(obj)

    # --embed-file, not --preload-file, and the difference is worth writing down.
    #
    # Preloading emits a fourth artifact, pokyd.data, and its loader resolves the
    # name through Module.locateFile -- falling back to a bare 'pokyd.data' that
    # node reads relative to the process working directory, not to pokyd.mjs.  So
    # a preloaded module only loads from build/wasm/ unless every caller passes a
    # locateFile.  That cannot be defaulted from --pre-js either: the packager's
    # loader is emitted at the top of the factory and runs before pre-js does.
    #
    # Embedding sidesteps all of it -- same MEMFS, same /pokyd/, one artifact
    # fewer, and `await PokydModule()` works from any directory with no options.
    # The bill is 161 KB of dictionary and rule base inlined into pokyd.mjs, which
    # at this size is not worth a configuration contract.  Revisit if PROFIL.IQP
    # (7.5) or a bigger dictionary ever joins them.
    #
    # Relative names, and the link runs with build/run/ as the working directory,
    # so nothing about this machine's checkout ends up in the output.
    embed = []
    for name in DATA:
        embed += ["--embed-file", f"{name}@/pokyd/{name}"]

    out_path = WASM / "pokyd.mjs"
    print(f"linking {out_path.relative_to(ROOT)}  (module PokydModule)")
    if run([emcc] + objects + HAZARDS + WASM_LINK + embed + ["-o", out_path],
           args.verbose, env, cwd=RUN):
        return 1

    print(f"ok -> {out_path}")
    print('     data embedded at /pokyd/ -- the module wants pokyd_init("/pokyd")')
    return 0


def prepare_run_dir():
    """Lay out build/run/ -- the working directory the driver is run in.

    The engine opens its data files by bare name in the current directory, so
    they have to be somewhere writable: SLOVNIK.TMP, the inflected dictionary,
    is written next to them and is 17 MB.  The dictionary comes from original/,
    which is the archive and read only, hence a copy; the rule base comes from
    build/gramatik/, where build-gramatik.py just compiled it.

    The copy is refreshed whenever the source differs, and changing the base
    dictionary drops the cache.  It has to: nothing in SLOVNIK.TMP identifies
    which dictionary it was built from, so a stale one is silently the wrong
    vocabulary.  (Phase 4.4 keys the IndexedDB copy by dictionary hash for the
    same reason.)
    """
    RUN.mkdir(parents=True, exist_ok=True)
    for name, source in DATA.items():
        dest = RUN / name
        if not source.is_file():
            print(f"missing {source.relative_to(ROOT)}")
            return 1
        if dest.is_file() and dest.read_bytes() == source.read_bytes():
            continue
        dest.write_bytes(source.read_bytes())
        print(f"data    {dest.relative_to(ROOT)}  <- {source.relative_to(ROOT)}")
        if name == "SLOVNIK.IQP" and (RUN / CACHE).is_file():
            (RUN / CACHE).unlink()
            print(f"        dropped {CACHE}, it was built from the old dictionary")
    return 0


def run(cmd, verbose, env=None, cwd=None):
    if verbose:
        print("  " + " ".join(str(c) for c in cmd))
    return subprocess.call([str(c) for c in cmd], env=env, cwd=cwd)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-v", "--verbose", action="store_true", help="show every command")
    ap.add_argument("--wasm", action="store_true",
                    help="build the wasm module with emcc instead of the native binary")
    args = ap.parse_args()

    # Never build stale bytes.
    if run([sys.executable, ROOT / "tools" / "transcode.py", "--to-cp1250"], args.verbose):
        return 1

    # The rule base is data we build, not data we copy -- see DATA above.  Cheap
    # when nothing changed: build-gramatik.py keeps a stamp and only recompiles
    # when GRAMATIK.IQZ, GRAMATIK.C, the shim or the flags move.  It always
    # re-verifies, though, so a corrupted IQPOKYD.IQP fails here and not three
    # minutes later inside the engine.
    if run([sys.executable, ROOT / "tools" / "build-gramatik.py", "--quiet"]
           + (["-v"] if args.verbose else []), args.verbose):
        return 1

    if args.wasm:
        return build_wasm(args)

    OUT.mkdir(parents=True, exist_ok=True)

    sources = sorted(SHIM.glob("*.cpp")) + sorted(API.glob("*.cpp"))
    if DRIVER.is_dir():
        sources += sorted(DRIVER.glob("*.cpp"))
        entry = "driver"
    else:
        generated = OUT / "linkcheck.cpp"
        generated.write_text(LINKCHECK, encoding="ascii", newline="\n")
        sources.append(generated)
        entry = "link check"

    objects = []
    for src in sources:
        obj = OUT / (src.stem + ".o")
        print(f"compiling {src.relative_to(ROOT)}")
        if run([CXX] + CXXFLAGS + ["-c", src, "-o", obj], args.verbose):
            return 1
        objects.append(obj)

    exe = OUT / ("pokyd.exe" if sys.platform == "win32" else "pokyd")
    print(f"linking {exe.relative_to(ROOT)}  ({entry})")
    if run([CXX] + objects + ["-o", exe], args.verbose):
        return 1

    print(f"ok -> {exe}")

    if entry == "driver":
        if prepare_run_dir():
            return 1
        first_run = not (RUN / CACHE).is_file()
        print(f"\nrun it with:  {exe.relative_to(ROOT)} --data {RUN.relative_to(ROOT)}")
        if first_run:
            print("the first run inflects the whole dictionary -- ~5 s, 11,207 words into\n"
                  f"402,252 forms -- and after that {CACHE} makes startup instant")
    return 0


if __name__ == "__main__":
    sys.exit(main())
