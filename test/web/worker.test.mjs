/* IQ Pokyd - test/web/worker.test.mjs - phase 4.2 of PLAN.md, the gate.

   test/web/engine.test.ts proves the engine answers the same through a string
   boundary as it does through a byte one, but it does that in node, on one
   thread, with no Worker anywhere.  This runs the real thing: headless Chrome,
   src/web/worker.ts started as a module worker, src/web/client.ts driving it
   over the message protocol, and the engine importing build/wasm/pokyd.mjs by
   URL inside the worker.

   Two questions, and the second is the one phase 4.2 exists to answer.

     1. Does IQ Pokyd still say the same things?  Both runs reproduce
        test/golden/rozhovor.txt byte for byte after re-encoding, and the cold
        run's exported SLOVNIK.TMP is the same 18,131,435 bytes the native build
        writes.
     2. Is the tab alive while it loads?  3.4 measured pokyd_load_dictionaries()
        at 15.3 s in Chrome as one synchronous call -- on the main thread that is
        a frozen page.  The page runs a 10 ms timer across the whole load and
        reports the longest it was kept waiting.  That number is the answer.

   It also checks the two things that only exist once there is a protocol: that
   a request sent before init comes back as a rejection rather than a hang, and
   that four requests in flight at once keep their ids straight.

   Run it:   node test/web/worker.test.mjs [--head]

   Needs python3 tools/build.py --wasm to have run.  --head shows the browser
   window instead of running headless.  No package.json and no driver: the page
   is served by test/browser.mjs, which also strips the types out of the .ts
   files on the way through, so what Chrome runs is the file on disk.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { KOREN, spustStranku } from "../browser.mjs";

const MODUL = join(KOREN, "build", "wasm", "pokyd.mjs");

/* The main thread may not be kept waiting longer than this at any point during
   the load.  It is a generous bound on purpose -- the point is the order of
   magnitude against a 15 s synchronous load, not a millisecond budget -- and it
   is still fifteen times shorter than one dropped frame budget would allow for
   a load that ran here. */
const NEJDELSI_PAUZA_MS = 500;

let poctu = 0;
let chyby = 0;

function nadpis(text) { console.log("\n" + text); }

function ok(co, podminka, detail = "") {
  poctu++;
  if (podminka) console.log("  ok    " + co);
  else {
    chyby++;
    console.log("  FAIL  " + co + (detail ? "\n        " + detail : ""));
  }
}

function rovno(co, mame, ocekavame) {
  ok(co, Object.is(mame, ocekavame),
    "got " + JSON.stringify(mame) + ", expected " + JSON.stringify(ocekavame));
}

function porovnejPrepis(co, bajty, zlate) {
  poctu++;
  const mame = Uint8Array.from(bajty);
  let i = 0;
  while (i < mame.length && i < zlate.length && mame[i] === zlate[i]) i++;
  if (i === mame.length && mame.length === zlate.length) {
    console.log("  ok    " + co + ": " + mame.length + " bytes, identical");
    return;
  }
  chyby++;
  console.log("  FAIL  " + co + ": differs from the golden file");
  console.log("        " + mame.length + " bytes here, " + zlate.length + " expected");
  console.log("        first difference at byte " + i);
  const nase = Buffer.from(mame).toString("latin1").split("\r\n");
  const jejich = Buffer.from(zlate).toString("latin1").split("\r\n");
  const radek = Buffer.from(zlate.subarray(0, i)).toString("latin1").split("\r\n").length;
  for (let r = Math.max(0, radek - 2); r < Math.min(jejich.length, radek + 1); r++) {
    if (nase[r] !== jejich[r]) {
      console.log("        line " + (r + 1) + " golden:  " + JSON.stringify(jejich[r]));
      console.log("        line " + (r + 1) + " browser: " + JSON.stringify(nase[r]));
    }
  }
}

async function main() {
  let viditelne = false;
  for (const prepinac of process.argv.slice(2)) {
    if (prepinac === "--head") viditelne = true;
    else {
      console.error("worker.test: unknown option \"" + prepinac + "\"");
      console.error("usage: node test/web/worker.test.mjs [--head]");
      return 2;
    }
  }

  if (!existsSync(MODUL)) {
    console.error("worker.test: no " + MODUL
      + "\n             build it with: python3 tools/build.py --wasm");
    return 1;
  }

  const zlate = new Uint8Array(
    readFileSync(join(KOREN, "test", "golden", "rozhovor.txt")));

  const { data, url } = await spustStranku({
    stranka: "test/web/worker.html", viditelne, casovyLimitMs: 240000,
  });
  if (data.chyba) {
    console.error("\nthe page failed:\n" + data.chyba);
    return 1;
  }

  console.log("where   " + data.kde);
  console.log("page    " + url.replace(/^http:\/\/127\.0\.0\.1:\d+/, ""));

  for (const beh of data.behy) {
    nadpis(beh.druh + " (load " + (beh.nacitani_ms / 1000).toFixed(2) + " s, "
      + beh.poctvet + " sentences in " + beh.odpovedi_ms.toFixed(0) + " ms)");
    porovnejPrepis(beh.druh + " transcript, through the worker and back", beh.prepis, zlate);
    rovno(beh.druh + ": pokyd_sentence_count() over the wire", beh.poctvet, 23);
    rovno(beh.druh + ": unfreed blocks", beh.neuvolneno, 0);

    /* The measurement phase 4.2 is for. */
    const pauza = beh.responzivita.maxPauzaMs;
    ok(beh.druh + ": the main thread stayed responsive -- longest stall "
      + pauza.toFixed(0) + " ms over a " + (beh.nacitani_ms / 1000).toFixed(1)
      + " s load", pauza < NEJDELSI_PAUZA_MS,
      "it was blocked for " + pauza.toFixed(0) + " ms, which is more than the "
      + NEJDELSI_PAUZA_MS + " ms this test allows");
    ok(beh.druh + ": and kept painting -- " + beh.responzivita.snimku
      + " animation frames during the load", beh.responzivita.snimku > 0,
      "requestAnimationFrame never ran, so nothing could have been drawn");

    /* The progress channel, over postMessage this time rather than in-process. */
    ok(beh.druh + ": output events arrived during the load, not after it",
      beh.vystup.behemNacitani > 0,
      "none of the " + beh.vystup.pocet + " output events arrived while loading");
    if (beh.druh === "cold") {
      ok("cold: " + beh.vystup.procenta + " of them were a percentage a loading"
        + " bar could use", beh.vystup.procenta > 10,
        "only " + beh.vystup.procenta + " looked like \"47.3%\"");
      console.log("        first: " + beh.vystup.ukazky.slice(0, 4)
        .map((s) => JSON.stringify(s)).join(" "));
    }
  }

  const studeny = data.behy.find((b) => b.druh === "cold");
  if (studeny) {
    nadpis("the exported cache");
    const nativni = join(KOREN, "build", "run", "SLOVNIK.TMP");
    if (existsSync(nativni)) {
      rovno("SLOVNIK.TMP is the same size as the native one", studeny.cacheDelka,
        readFileSync(nativni).length);
    } else {
      ok("SLOVNIK.TMP was exported", studeny.cacheDelka > 0);
      console.log("        no build/run/SLOVNIK.TMP to compare it against");
    }
    ok("it survived the transfer to the main thread and back into a second worker",
      data.behy.some((b) => b.druh === "warm"),
      "there was no warm run, so the blob never made the round trip");
  }

  nadpis("the protocol");
  ok("a request before init rejects instead of hanging",
    typeof data.protokol.predInit === "string"
      && data.protokol.predInit.indexOf("init") >= 0,
    "the rejection said: " + JSON.stringify(data.protokol.predInit));
  rovno("four concurrent requests: getSettings sees the mood that was set",
    data.protokol.soubezne.nalada, 2);
  rovno("four concurrent requests: progress() answers the progress request",
    data.protokol.soubezne.faze, 0);
  rovno("four concurrent requests: sentenceCount() answers the count request",
    data.protokol.soubezne.vet, 0);
  ok("four concurrent requests: no two replies were crossed",
    data.protokol.soubezne.stejne === true);

  ok("the page was cross-origin isolated, as test/browser.mjs intends",
    data.isolated === true);

  console.log(chyby === 0
    ? "\nPASS -- " + poctu + " checks.  IQ Pokyd holds the golden conversation in"
      + " a browser, on a thread that leaves the page alive."
    : "\nFAIL -- " + chyby + " of " + poctu + " checks did not hold.");
  return chyby === 0 ? 0 : 1;
}

process.exit(await main());
