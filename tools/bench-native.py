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
INPUT = ROOT / "test" / "golden" / "rozhovor.in"
CACHE = "SLOVNIK.TMP"
DATA = ("SLOVNIK.IQP", "IQPOKYD.IQP")

# test/golden/README.md pins these on the command line rather than trusting
# NASTAV_STANDARDNE, so the transcript does not move if a default ever does.
SETTINGS = ["--cp1250", "--seed", "20050415", "--character", "3", "--mood", "3",
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


def peak_memory(proc):
    """Peak working set of a finished child, in bytes, or None if unknowable."""
    if os.name == "nt":
        pmc = PROCESS_MEMORY_COUNTERS()
        pmc.cb = ctypes.sizeof(pmc)
        handle = ctypes.c_void_p(int(proc._handle))
        if ctypes.windll.psapi.GetProcessMemoryInfo(handle, ctypes.byref(pmc), pmc.cb):
            return int(pmc.PeakWorkingSetSize)
        return None
    try:
        import resource
        # A high-water mark across every child of this process, not this one --
        # only meaningful for the largest run.  Linux reports kB, macOS bytes.
        value = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
        return int(value) * (1 if sys.platform == "darwin" else 1024)
    except Exception:
        return None


# ---------------------------------------------------------------------- a run

def prepare_data():
    """build/bench/run/, holding the two data files and nothing else."""
    BENCH.mkdir(parents=True, exist_ok=True)
    for name in DATA:
        source = RUN / name
        if not source.is_file():
            print(f"bench: no {source.relative_to(ROOT)} -- python3 tools/build.py first")
            return False
        dest = BENCH / name
        if not dest.is_file() or dest.read_bytes() != source.read_bytes():
            shutil.copyfile(source, dest)
            # Nothing in SLOVNIK.TMP says which dictionary it was inflected from,
            # so a changed dictionary drops it -- build.py does the same.
            if (BENCH / CACHE).is_file():
                (BENCH / CACHE).unlink()
    return True


def one_run(cold, golden):
    """One conversation.  Returns what it cost, and whether it still holds."""
    if cold and (BENCH / CACHE).is_file():
        (BENCH / CACHE).unlink()
    transcript = BENCH.parent / "rozhovor.txt"

    cmd = [str(EXE), "--data", str(BENCH), "--time",
              "--transcript", str(transcript)] + SETTINGS

    t0 = time.perf_counter()
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out_text, err_text = proc.communicate(INPUT.read_bytes())
    proc_ms = (time.perf_counter() - t0) * 1000.0
    peak = peak_memory(proc)

    if proc.returncode != 0:
        print(f"bench: pokyd.exe exited {proc.returncode}")
        print(err_text.decode("latin1"))
        return None

    err_text = err_text.decode("latin1")
    out_text = out_text.decode("latin1")
    m_load = re.search(r"load ([0-9.]+) ms", err_text)
    m_answers = re.search(r"([0-9]+) answers ([0-9.]+) ms", err_text)
    m_words = re.search(r"Prevedeno ([0-9]+) slov", out_text)
    m_forms = re.search(r"MAX_POCET_VSECH_SLOV: ([0-9]+)", out_text)

    return {
        "cold": cold,
        "load_ms": float(m_load.group(1)) if m_load else None,
        "proc_ms": proc_ms,
        "answers_ms": float(m_answers.group(2)) if m_answers else None,
        "peak_b": peak,
        "cache_b": (BENCH / CACHE).stat().st_size if (BENCH / CACHE).is_file() else 0,
        "words": int(m_words.group(1)) if m_words else None,
        "forms": int(m_forms.group(1)) if m_forms else None,
        "transcript_matches": transcript.read_bytes() == golden,
        # The engine reports unfreed blocks on stderr, and 1.6 checked that by
        # eye; here the only lines allowed are the two --time prints.
        "stderr_clean": all(line.startswith("pokyd: load")
                            or " answers " in line
                            or line.strip() == ""
                            for line in err_text.splitlines()),
    }


# ------------------------------------------------------------------ reporting

def mb(byte_count):
    return "--" if byte_count is None else f"{byte_count / 1048576.0:6.1f} MB"


def median(values):
    h = sorted(x for x in values if x is not None)
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
    if not prepare_data():
        return 1

    golden = GOLDEN.read_bytes()
    runs = []
    failures = 0

    if not args.json:
        print(f"machine {platform.machine()}, {os.cpu_count()} cpus,"
              f" {platform.system()} {platform.release()}")
        print(f"exe     {EXE.relative_to(ROOT)}  ({EXE.stat().st_size:,} B)")
        print(f"data    {BENCH.relative_to(ROOT)}")
        print()
        print("  run      load ms   answers   peak WS      SLOVNIK.TMP   transcript")

    for cold in (True, False):
        for i in range(args.repeats):
            run = one_run(cold, golden)
            if run is None:
                return 1
            runs.append(run)
            if not run["transcript_matches"] or not run["stderr_clean"]:
                failures += 1
            if not args.json:
                print("  {:<7} {:>7.0f} {:>8.0f}   {}  {:>12,}   {}".format(
                    ("cold " if cold else "warm ") + str(i + 1),
                    run["load_ms"] or 0, run["answers_ms"] or 0,
                    mb(run["peak_b"]), run["cache_b"],
                    "identical" if run["transcript_matches"] else "DIFFERS"))

    colds = [b for b in runs if b["cold"]]
    warms = [b for b in runs if not b["cold"]]
    summary = {
        "machine": platform.machine(),
        "system": f"{platform.system()} {platform.release()}",
        "cold_ms": median([b["load_ms"] for b in colds]),
        "warm_ms": median([b["load_ms"] for b in warms]),
        "cold_peak_b": max([b["peak_b"] or 0 for b in colds] or [0]) or None,
        "warm_peak_b": max([b["peak_b"] or 0 for b in warms] or [0]) or None,
        "cache_b": colds[0]["cache_b"] if colds else None,
        "words": colds[0]["words"] if colds else None,
        "forms": colds[0]["forms"] if colds else None,
        "failures": failures,
    }

    if args.json:
        print(json.dumps(summary, indent=2))
        return 1 if failures else 0

    print()
    print(f"  cold    {summary['cold_ms']:.0f} ms median,"
          f" peak {mb(summary['cold_peak_b']).strip()}")
    print(f"  warm    {summary['warm_ms']:.0f} ms median,"
          f" peak {mb(summary['warm_peak_b']).strip()}")
    print(f"  cache   {summary['cache_b']:,} B on disk")
    if summary["forms"]:
        print(f"  words   {summary['words']:,} base words -> {summary['forms']:,} forms"
              f"  (MAX_POCET_VSECH_SLOV is 500,000)")
    print()
    print("PASS -- every run reproduced test/golden/rozhovor.txt." if failures == 0
          else f"FAIL -- {failures} run(s) did not reproduce the golden transcript.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
