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

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

import { readFileSync, existsSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { zmer } from "./bench-core.mjs";
import { KOREN, spustStranku } from "../browser.mjs";

const MODUL = join(KOREN, "build", "wasm", "pokyd.mjs");

function vety_ze_souboru() {
  /* Exactly what the driver's loop does: strip the CR, drop empty lines
     (mfcDlg.cpp:556), keep every other byte as it lies.  CP1250 throughout --
     nothing here decodes anything, which is phase 4.1's job. */
  const vstup = readFileSync(join(KOREN, "test", "golden", "rozhovor.in"));
  return vstup.toString("latin1").split("\n")
    .map((r) => r.replace(/\r+$/, ""))
    .filter((r) => r.length > 0)
    .map((r) => Uint8Array.from(r, (z) => z.charCodeAt(0)));
}

/* ----------------------------------------------------------------- in node */

async function zmer_v_node(opakovani, hluk) {
  const { default: PokydModule } = await import(pathToFileURL(MODUL).href);
  const vety = vety_ze_souboru();
  const zlate = new Uint8Array(readFileSync(join(KOREN, "test", "golden", "rozhovor.txt")));
  const behy = [];
  let blob = null;

  for (const studeny of [true, false]) {
    for (let i = 0; i < opakovani; i++) {
      if (!studeny && blob === null) break;      /* nothing to warm up from */
      const beh = await zmer(PokydModule, {
        vety, zlate, hluk,
        cache: studeny ? null : blob,
        vyvez: studeny && blob === null,         /* one export is enough */
        /* Read at the peak -- loaded, nothing torn down.  It is still a
           process-wide high-water mark that never comes back down, so only the
           first run of a process is a clean reading. */
        sonda: () => process.memoryUsage().rss,
      });
      if (beh.cache) blob = beh.cache;
      behy.push({ druh: studeny ? "cold" : "warm", ...beh });
    }
  }
  return { behy, kde: "node " + process.version, blob };
}

/* ------------------------------------------------------------- in a browser */

/* The server and the browser launcher moved to test/browser.mjs at phase 4.2,
   when test/web/worker.test.mjs became their second caller.  What is left here
   is what is specific to a benchmark: the query the page is given, and taking
   the rows back. */

async function zmer_v_prohlizeci(opakovani, hluk, viditelne) {
  const { data } = await spustStranku({
    stranka: "test/wasm/bench.html",
    dotaz: { n: opakovani, noise: hluk ? 1 : 0 },
    viditelne,
  });
  if (data.chyba) throw new Error("the page failed:\n" + data.chyba);
  return { behy: data.behy, kde: data.kde, tab: data.tab };
}

/* -------------------------------------------------------------------- output */

function mb(bajty) {
  return bajty === undefined || bajty === null ? "     --"
    : (bajty / 1048576).toFixed(1).padStart(6) + " MB";
}

function tabulka(behy) {
  let chyby = 0;
  console.log();
  console.log("  run      load ms  answers   wasm heap     memfs      host    transcript");
  for (const b of behy) {
    const sedi = b.prepis_sedi === false ? "DIFFERS"
      : b.neuvolneno !== 0 ? "leaked " + b.neuvolneno : "identical";
    if (b.prepis_sedi === false || b.neuvolneno !== 0) chyby++;
    console.log("  {0}  {1} {2}  {3} {4} {5}   {6}"
      .replace("{0}", b.druh.padEnd(5))
      .replace("{1}", b.nacitani_ms.toFixed(0).padStart(8))
      .replace("{2}", b.odpovedi_ms.toFixed(0).padStart(7))
      .replace("{3}", mb(b.pamet.po_nacteni))
      .replace("{4}", mb(b.memfs))
      .replace("{5}", mb(b.host))
      .replace("{6}", sedi));
  }
  return chyby;
}

function median(hodnoty) {
  const h = hodnoty.filter((x) => typeof x === "number").sort((a, b) => a - b);
  if (h.length === 0) return null;
  return h.length % 2 ? h[(h.length - 1) / 2]
    : (h[h.length / 2 - 1] + h[h.length / 2]) / 2;
}

/* --------------------------------------------------------------------- driver */

async function main() {
  let opakovani = 1, hluk = false, prohlizec = false, viditelne = false, json = false;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "-n" && i + 1 < argv.length) opakovani = parseInt(argv[++i], 10);
    else if (argv[i] === "--noise") hluk = true;
    else if (argv[i] === "--browser") prohlizec = true;
    else if (argv[i] === "--head") { prohlizec = true; viditelne = true; }
    else if (argv[i] === "--json") json = true;
    else {
      console.error('bench: unknown option "' + argv[i] + '"');
      console.error("usage: node test/wasm/bench.mjs [-n N] [--browser] [--head]"
        + " [--noise] [--json]");
      return 2;
    }
  }

  if (!existsSync(MODUL)) {
    console.error("bench: no " + MODUL
      + "\n       build it with: python3 tools/build.py --wasm");
    return 1;
  }

  const { behy, kde, tab } = prohlizec
    ? await zmer_v_prohlizeci(opakovani, hluk, viditelne)
    : await zmer_v_node(opakovani, hluk);

  const studene = behy.filter((b) => b.druh === "cold");
  const teple = behy.filter((b) => b.druh === "warm");
  const souhrn = {
    kde,
    /* The first cold run is the one a visitor gets, and it is reliably the
       slowest: the runtime is still running baseline-compiled wasm the first
       time through.  Reporting only the median would quietly report a number
       nobody experiences. */
    cold_prvni_ms: studene.length ? studene[0].nacitani_ms : null,
    cold_ms: median(studene.map((b) => b.nacitani_ms)),
    warm_ms: median(teple.map((b) => b.nacitani_ms)),
    wasm_peak_b: Math.max(...behy.map((b) => b.pamet.po_nacteni)),
    memfs_b: Math.max(...behy.map((b) => b.memfs)),
    tab_b: tab || null,
    tvary: 402252,
  };

  if (json) {
    console.log(JSON.stringify({ souhrn, behy: behy.map(({ prepis, cache, ...z }) => z) }, null, 2));
    return behy.some((b) => b.prepis_sedi === false || b.neuvolneno !== 0) ? 1 : 0;
  }

  console.log("where   " + kde);
  console.log("module  build/wasm/pokyd.mjs ("
    + statSync(MODUL).size.toLocaleString("en-US") + " B) + pokyd.wasm ("
    + statSync(join(KOREN, "build", "wasm", "pokyd.wasm")).size.toLocaleString("en-US") + " B)");
  const chyby = tabulka(behy);

  console.log();
  console.log("  cold    " + souhrn.cold_prvni_ms.toFixed(0) + " ms on the first run"
    + (studene.length > 1
      ? ", " + souhrn.cold_ms.toFixed(0) + " ms median of " + studene.length
        + " (the first pays for baseline-compiled wasm)" : ""));
  console.log("  warm    " + (souhrn.warm_ms === null ? "--" : souhrn.warm_ms.toFixed(0) + " ms median")
    + (souhrn.cold_ms && souhrn.warm_ms
      ? "   (" + (souhrn.cold_ms / souhrn.warm_ms).toFixed(0) + "x faster)" : ""));
  console.log("  memory  wasm heap peaks at " + mb(souhrn.wasm_peak_b).trim()
    + ", MEMFS holds " + mb(souhrn.memfs_b).trim() + " beside it");
  if (souhrn.tab_b) console.log("  tab     " + mb(souhrn.tab_b).trim()
    + " total, per performance.measureUserAgentSpecificMemory()");

  console.log();
  console.log(chyby === 0
    ? "PASS -- every run reproduced test/golden/rozhovor.txt and freed every block."
    : "FAIL -- " + chyby + " run(s) did not.");
  return chyby === 0 ? 0 : 1;
}

process.exit(await main());
