#!/usr/bin/env python3
r"""Measure what a start-up costs natively.  Phase 3.4 of PLAN.md.

The number this exists to produce is the one the wasm build gets compared
against: how long `pokyd_load_dictionaries()` takes, and how much memory the
process peaks at while it inflects 11,207 base words into 402,252 forms.  Phase
1.5 measured that once, by hand, on another machine (4.5 s, 37 MB).  This runs it
repeatedly and prints the same figures for whatever machine it is on, next to
`test/wasm/bench.mjs`, which prints them for wasm.

What it measures, and how
-------------------------
load time   The driver's own `--time`, a clock() bracket around
            pokyd_load_dictionaries() and nothing else -- not process start-up,
            not the conversation, not teardown.  test/wasm/bench.mjs brackets
            exactly the same call, which is what makes the two comparable.
peak memory PeakWorkingSetSize from GetProcessMemoryInfo, read off the child's
            handle after it has exited -- psapi answers for an exited process as
            long as a handle is still open, and subprocess keeps one.  That is
            the whole process, C runtime and engine together, which is the
            honest thing to hold a browser tab against, and it is the counter
            Task Manager shows.  Off Windows it falls back to
            getrusage(RUSAGE_CHILDREN), a high-water mark across every child so
            far, so only the largest run means anything there.

Cold and warm are the same binary on the same data.  The only difference is
whether SLOVNIK.TMP is there when the load starts: a cold run writes it (17 MB),
a warm run reads it, and 3.4's question is how far apart those two are once the
engine is in a browser.

It works in build/bench/run/, not build/run/, on purpose.  Deleting SLOVNIK.TMP
is how a cold run is made, and test/wasm/smoke.mjs diffs the wasm cache against
build/run/SLOVNIK.TMP -- so this never touches that file.

Every run is also diffed against test/golden/rozhovor.txt, because a bench that
is not also a test is a bench that eventually measures the wrong thing.

Usage
-----
    python3 tools/bench-native.py             # 3 cold, 3 warm
    python3 tools/bench-native.py -n 5
    python3 tools/bench-native.py --json      # the same numbers, machine readable
"""

import argparse
import ctypes
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXE = ROOT / "build" / "native" / "pokyd.exe"
RUN = ROOT / "build" / "run"
BENCH = ROOT / "build" / "bench" / "run"
GOLDEN = ROOT / "test" / "golden" / "rozhovor.txt"
VSTUP = ROOT / "test" / "golden" / "rozhovor.in"
CACHE = "SLOVNIK.TMP"
DATA = ("SLOVNIK.IQP", "IQPOKYD.IQP")

# test/golden/README.md pins these on the command line rather than trusting
# NASTAV_STANDARDNE, so the transcript does not move if a default ever does.
NASTAVENI = ["--cp1250", "--seed", "20050415", "--character", "3", "--mood", "3",
             "--human", "m", "--computer", "m"]


# --------------------------------------------------------------- peak memory

class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
    _fields_ = [("cb", ctypes.c_uint32),
                ("PageFaultCount", ctypes.c_uint32),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t)]


def vrchol_pameti(proces):
    """Peak working set of a finished child, in bytes, or None if unknowable."""
    if os.name == "nt":
        pmc = PROCESS_MEMORY_COUNTERS()
        pmc.cb = ctypes.sizeof(pmc)
        handle = ctypes.c_void_p(int(proces._handle))
        if ctypes.windll.psapi.GetProcessMemoryInfo(handle, ctypes.byref(pmc), pmc.cb):
            return int(pmc.PeakWorkingSetSize)
        return None
    try:
        import resource
        # A high-water mark across every child of this process, not this one --
        # only meaningful for the largest run.  Linux reports kB, macOS bytes.
        hodnota = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
        return int(hodnota) * (1 if sys.platform == "darwin" else 1024)
    except Exception:
        return None


# ---------------------------------------------------------------------- a run

def priprav_data():
    """build/bench/run/, holding the two data files and nothing else."""
    BENCH.mkdir(parents=True, exist_ok=True)
    for jmeno in DATA:
        zdroj = RUN / jmeno
        if not zdroj.is_file():
            print(f"bench: no {zdroj.relative_to(ROOT)} -- python3 tools/build.py first")
            return False
        cil = BENCH / jmeno
        if not cil.is_file() or cil.read_bytes() != zdroj.read_bytes():
            shutil.copyfile(zdroj, cil)
            # Nothing in SLOVNIK.TMP says which dictionary it was inflected from,
            # so a changed dictionary drops it -- build.py does the same.
            if (BENCH / CACHE).is_file():
                (BENCH / CACHE).unlink()
    return True


def jeden_beh(studeny, zlaty):
    """One conversation.  Returns what it cost, and whether it still holds."""
    if studeny and (BENCH / CACHE).is_file():
        (BENCH / CACHE).unlink()
    prepis = BENCH.parent / "rozhovor.txt"

    prikaz = [str(EXE), "--data", str(BENCH), "--time",
              "--transcript", str(prepis)] + NASTAVENI

    t0 = time.perf_counter()
    proces = subprocess.Popen(prikaz, stdin=subprocess.PIPE,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    ven, chyby = proces.communicate(VSTUP.read_bytes())
    cas_procesu = (time.perf_counter() - t0) * 1000.0
    vrchol = vrchol_pameti(proces)

    if proces.returncode != 0:
        print(f"bench: pokyd.exe exited {proces.returncode}")
        print(chyby.decode("latin1"))
        return None

    chyby = chyby.decode("latin1")
    ven = ven.decode("latin1")
    nacitani = re.search(r"load ([0-9.]+) ms", chyby)
    odpovedi = re.search(r"([0-9]+) answers ([0-9.]+) ms", chyby)
    slova = re.search(r"Prevedeno ([0-9]+) slov", ven)
    tvary = re.search(r"MAX_POCET_VSECH_SLOV: ([0-9]+)", ven)

    return {
        "studeny": studeny,
        "nacitani_ms": float(nacitani.group(1)) if nacitani else None,
        "proces_ms": cas_procesu,
        "odpovedi_ms": float(odpovedi.group(2)) if odpovedi else None,
        "vrchol_b": vrchol,
        "cache_b": (BENCH / CACHE).stat().st_size if (BENCH / CACHE).is_file() else 0,
        "slova": int(slova.group(1)) if slova else None,
        "tvary": int(tvary.group(1)) if tvary else None,
        "prepis_sedi": prepis.read_bytes() == zlaty,
        # The engine reports unfreed blocks on stderr, and 1.6 checked that by
        # eye; here the only lines allowed are the two --time prints.
        "stderr_cisty": all(radek.startswith("pokyd: load")
                            or " answers " in radek
                            or radek.strip() == ""
                            for radek in chyby.splitlines()),
    }


# ------------------------------------------------------------------ reporting

def mb(bajty):
    return "--" if bajty is None else f"{bajty / 1048576.0:6.1f} MB"


def median(hodnoty):
    h = sorted(x for x in hodnoty if x is not None)
    if not h:
        return None
    return h[len(h) // 2] if len(h) % 2 else (h[len(h) // 2 - 1] + h[len(h) // 2]) / 2.0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-n", "--repeats", type=int, default=3,
                    help="runs of each kind (default 3)")
    ap.add_argument("--json", action="store_true", help="print the numbers as JSON")
    args = ap.parse_args()

    if not EXE.is_file():
        print(f"bench: no {EXE.relative_to(ROOT)} -- python3 tools/build.py first")
        return 1
    if not priprav_data():
        return 1

    zlaty = GOLDEN.read_bytes()
    behy = []
    chyby = 0

    if not args.json:
        print(f"machine {platform.machine()}, {os.cpu_count()} cpus,"
              f" {platform.system()} {platform.release()}")
        print(f"exe     {EXE.relative_to(ROOT)}  ({EXE.stat().st_size:,} B)")
        print(f"data    {BENCH.relative_to(ROOT)}")
        print()
        print("  run      load ms   answers   peak WS      SLOVNIK.TMP   transcript")

    for studeny in (True, False):
        for i in range(args.repeats):
            beh = jeden_beh(studeny, zlaty)
            if beh is None:
                return 1
            behy.append(beh)
            if not beh["prepis_sedi"] or not beh["stderr_cisty"]:
                chyby += 1
            if not args.json:
                print("  {:<7} {:>7.0f} {:>8.0f}   {}  {:>12,}   {}".format(
                    ("cold " if studeny else "warm ") + str(i + 1),
                    beh["nacitani_ms"] or 0, beh["odpovedi_ms"] or 0,
                    mb(beh["vrchol_b"]), beh["cache_b"],
                    "identical" if beh["prepis_sedi"] else "DIFFERS"))

    studene = [b for b in behy if b["studeny"]]
    teple = [b for b in behy if not b["studeny"]]
    souhrn = {
        "stroj": platform.machine(),
        "system": f"{platform.system()} {platform.release()}",
        "cold_ms": median([b["nacitani_ms"] for b in studene]),
        "warm_ms": median([b["nacitani_ms"] for b in teple]),
        "cold_peak_b": max([b["vrchol_b"] or 0 for b in studene] or [0]) or None,
        "warm_peak_b": max([b["vrchol_b"] or 0 for b in teple] or [0]) or None,
        "cache_b": studene[0]["cache_b"] if studene else None,
        "slova": studene[0]["slova"] if studene else None,
        "tvary": studene[0]["tvary"] if studene else None,
        "chyby": chyby,
    }

    if args.json:
        print(json.dumps(souhrn, indent=2))
        return 1 if chyby else 0

    print()
    print(f"  cold    {souhrn['cold_ms']:.0f} ms median,"
          f" peak {mb(souhrn['cold_peak_b']).strip()}")
    print(f"  warm    {souhrn['warm_ms']:.0f} ms median,"
          f" peak {mb(souhrn['warm_peak_b']).strip()}")
    print(f"  cache   {souhrn['cache_b']:,} B on disk")
    if souhrn["tvary"]:
        print(f"  words   {souhrn['slova']:,} base words -> {souhrn['tvary']:,} forms"
              f"  (MAX_POCET_VSECH_SLOV is 500,000)")
    print()
    print("PASS -- every run reproduced test/golden/rozhovor.txt." if chyby == 0
          else f"FAIL -- {chyby} run(s) did not reproduce the golden transcript.")
    return 1 if chyby else 0


if __name__ == "__main__":
    sys.exit(main())
