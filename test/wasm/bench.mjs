/* IQ Pokyd - test/wasm/bench.mjs - what a start-up costs in wasm.

   Phase 3.4 of PLAN.md.  tools/bench-native.py prints the same figures for the
   native build; this prints them for build/wasm/pokyd.mjs, in node and -- with
   --browser -- in the browser the museum piece is actually going to run in.
   The plan's question is whether the SLOVNIK.TMP cache is a launch requirement
   or a later optimization, and it is answered by the gap between the cold and
   warm rows of this table.

   The driving is test/wasm/bench-core.mjs, shared verbatim with the browser
   page, and it is the same order of calls test/wasm/smoke.mjs makes.  Every run
   diffs its transcript against test/golden/rozhovor.txt: a timing from a run
   that answered wrong is worse than no timing.

   Memory, and what these numbers are not
   --------------------------------------
   wasm    HEAPU8.length, the size of the linear memory.  It only grows, so the
           figure after loading is the peak.  This is the engine: its heap, its
           stack, the dictionary.  Hold it against the native peak working set.
   memfs   what the in-memory filesystem is holding, SLOVNIK.TMP included.
           Emscripten keeps MEMFS file contents in JS typed arrays OUTSIDE the
           linear memory, so this is 17 MB the wasm column does not show.
   host    whatever the host can see of itself, read at the peak -- loaded, and
           nothing torn down yet.  In node that is process RSS, which is a
           process-wide high-water mark that never comes back down, so only the
           first run of a process is a clean reading.  In a browser it is
           performance.measureUserAgentSpecificMemory(), the whole tab, which is
           the number 3.4 is actually asking for and which needs the cross-origin
           isolation test/browser.mjs sends.

   Usage
   -----
       node test/wasm/bench.mjs              # 1 cold, 1 warm, in node
       node test/wasm/bench.mjs -n 3
       node test/wasm/bench.mjs --browser    # the same, in headless Chrome/Edge
       node test/wasm/bench.mjs --browser --head     # ... with a window
       node test/wasm/bench.mjs --json

   Needs python3 tools/build.py --wasm to have run.  Exit code 0 or 1.

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code.
*/

import { readFileSync, existsSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { measure } from "./bench-core.mjs";
import { ROOT, runPage } from "../browser.mjs";

const MODULE_PATH = join(ROOT, "build", "wasm", "pokyd.mjs");

function sentences_from_file() {
  /* Exactly what the driver's loop does: strip the CR, drop empty lines
     (mfcDlg.cpp:556), keep every other byte as it lies.  CP1250 throughout --
     nothing here decodes anything, which is phase 4.1's job. */
  const input = readFileSync(join(ROOT, "test", "golden", "rozhovor.in"));
  return input.toString("latin1").split("\n")
    .map((r) => r.replace(/\r+$/, ""))
    .filter((r) => r.length > 0)
    .map((r) => Uint8Array.from(r, (z) => z.charCodeAt(0)));
}

/* ----------------------------------------------------------------- in node */

async function measure_in_node(repeats, noise) {
  const { default: PokydModule } = await import(pathToFileURL(MODULE_PATH).href);
  const sentences = sentences_from_file();
  const golden = new Uint8Array(readFileSync(join(ROOT, "test", "golden", "rozhovor.txt")));
  const runs = [];
  let blob = null;

  for (const cold of [true, false]) {
    for (let i = 0; i < repeats; i++) {
      if (!cold && blob === null) break;      /* nothing to warm up from */
      const run = await measure(PokydModule, {
        sentences, golden, noise,
        cache: cold ? null : blob,
        want_cache: cold && blob === null,         /* one export is enough */
        /* Read at the peak -- loaded, nothing torn down.  It is still a
           process-wide high-water mark that never comes back down, so only the
           first run of a process is a clean reading. */
        probe: () => process.memoryUsage().rss,
      });
      if (run.cache) blob = run.cache;
      runs.push({ kind: cold ? "cold" : "warm", ...run });
    }
  }
  return { runs, where: "node " + process.version, blob };
}

/* ------------------------------------------------------------- in a browser */

/* The server and the browser launcher moved to test/browser.mjs at phase 4.2,
   when test/web/worker.test.mjs became their second caller.  What is left here
   is what is specific to a benchmark: the query the page is given, and taking
   the rows back. */

async function measure_in_browser(repeats, noise, visible) {
  const { data } = await runPage({
    page: "test/wasm/bench.html",
    query: { n: repeats, noise: noise ? 1 : 0 },
    visible,
  });
  if (data.error) throw new Error("the page failed:\n" + data.error);
  return { runs: data.runs, where: data.where, tab: data.tab };
}

/* -------------------------------------------------------------------- output */

function mb(bytes) {
  return bytes === undefined || bytes === null ? "     --"
    : (bytes / 1048576).toFixed(1).padStart(6) + " MB";
}

function table(runs) {
  let failures = 0;
  console.log();
  console.log("  run      load ms  answers   wasm heap     memfs      host    transcript");
  for (const b of runs) {
    const verdict = b.transcript_matches === false ? "DIFFERS"
      : b.unfreed !== 0 ? "leaked " + b.unfreed : "identical";
    if (b.transcript_matches === false || b.unfreed !== 0) failures++;
    console.log("  {0}  {1} {2}  {3} {4} {5}   {6}"
      .replace("{0}", b.kind.padEnd(5))
      .replace("{1}", b.load_ms.toFixed(0).padStart(8))
      .replace("{2}", b.answers_ms.toFixed(0).padStart(7))
      .replace("{3}", mb(b.memory.after_load))
      .replace("{4}", mb(b.memfs))
      .replace("{5}", mb(b.host))
      .replace("{6}", verdict));
  }
  return failures;
}

function median(values) {
  const h = values.filter((x) => typeof x === "number").sort((a, b) => a - b);
  if (h.length === 0) return null;
  return h.length % 2 ? h[(h.length - 1) / 2]
    : (h[h.length / 2 - 1] + h[h.length / 2]) / 2;
}

/* --------------------------------------------------------------------- driver */

async function main() {
  let repeats = 1, noise = false, browser = false, visible = false, json = false;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "-n" && i + 1 < argv.length) repeats = parseInt(argv[++i], 10);
    else if (argv[i] === "--noise") noise = true;
    else if (argv[i] === "--browser") browser = true;
    else if (argv[i] === "--head") { browser = true; visible = true; }
    else if (argv[i] === "--json") json = true;
    else {
      console.error('bench: unknown option "' + argv[i] + '"');
      console.error("usage: node test/wasm/bench.mjs [-n N] [--browser] [--head]"
        + " [--noise] [--json]");
      return 2;
    }
  }

  if (!existsSync(MODULE_PATH)) {
    console.error("bench: no " + MODULE_PATH
      + "\n       build it with: python3 tools/build.py --wasm");
    return 1;
  }

  const { runs, where, tab } = browser
    ? await measure_in_browser(repeats, noise, visible)
    : await measure_in_node(repeats, noise);

  const colds = runs.filter((b) => b.kind === "cold");
  const warms = runs.filter((b) => b.kind === "warm");
  const summary = {
    where,
    /* The first cold run is the one a visitor gets, and it is reliably the
       slowest: the runtime is still running baseline-compiled wasm the first
       time through.  Reporting only the median would quietly report a number
       nobody experiences. */
    cold_first_ms: colds.length ? colds[0].load_ms : null,
    cold_ms: median(colds.map((b) => b.load_ms)),
    warm_ms: median(warms.map((b) => b.load_ms)),
    wasm_peak_b: Math.max(...runs.map((b) => b.memory.after_load)),
    memfs_b: Math.max(...runs.map((b) => b.memfs)),
    tab_b: tab || null,
    forms: 402252,
  };

  if (json) {
    console.log(JSON.stringify({ summary, runs: runs.map(({ transcript, cache, ...z }) => z) }, null, 2));
    return runs.some((b) => b.transcript_matches === false || b.unfreed !== 0) ? 1 : 0;
  }

  console.log("where   " + where);
  console.log("module  build/wasm/pokyd.mjs ("
    + statSync(MODULE_PATH).size.toLocaleString("en-US") + " B) + pokyd.wasm ("
    + statSync(join(ROOT, "build", "wasm", "pokyd.wasm")).size.toLocaleString("en-US") + " B)");
  const failures = table(runs);

  console.log();
  console.log("  cold    " + summary.cold_first_ms.toFixed(0) + " ms on the first run"
    + (colds.length > 1
      ? ", " + summary.cold_ms.toFixed(0) + " ms median of " + colds.length
        + " (the first pays for baseline-compiled wasm)" : ""));
  console.log("  warm    " + (summary.warm_ms === null ? "--" : summary.warm_ms.toFixed(0) + " ms median")
    + (summary.cold_ms && summary.warm_ms
      ? "   (" + (summary.cold_ms / summary.warm_ms).toFixed(0) + "x faster)" : ""));
  console.log("  memory  wasm heap peaks at " + mb(summary.wasm_peak_b).trim()
    + ", MEMFS holds " + mb(summary.memfs_b).trim() + " beside it");
  if (summary.tab_b) console.log("  tab     " + mb(summary.tab_b).trim()
    + " total, per performance.measureUserAgentSpecificMemory()");

  console.log();
  console.log(failures === 0
    ? "PASS -- every run reproduced test/golden/rozhovor.txt and freed every block."
    : "FAIL -- " + failures + " run(s) did not.");
  return failures === 0 ? 0 : 1;
}

process.exit(await main());
