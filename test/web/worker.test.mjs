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

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code.
*/

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { ROOT, runPage } from "../browser.mjs";

const MODULE_PATH = join(ROOT, "build", "wasm", "pokyd.mjs");

/* The main thread may not be kept waiting longer than this at any point during
   the load.  It is a generous bound on purpose -- the point is the order of
   magnitude against a 15 s synchronous load, not a millisecond budget -- and it
   is still fifteen times shorter than one dropped frame budget would allow for
   a load that ran here. */
const MAX_STALL_MS = 500;

let checks = 0;
let failures = 0;

function heading(text) { console.log("\n" + text); }

function ok(label, cond, detail = "") {
  checks++;
  if (cond) console.log("  ok    " + label);
  else {
    failures++;
    console.log("  FAIL  " + label + (detail ? "\n        " + detail : ""));
  }
}

function eq(label, got, expected) {
  ok(label, Object.is(got, expected),
    "got " + JSON.stringify(got) + ", expected " + JSON.stringify(expected));
}

function compareTranscript(label, bytes, golden) {
  checks++;
  const got = Uint8Array.from(bytes);
  let i = 0;
  while (i < got.length && i < golden.length && got[i] === golden[i]) i++;
  if (i === got.length && got.length === golden.length) {
    console.log("  ok    " + label + ": " + got.length + " bytes, identical");
    return;
  }
  failures++;
  console.log("  FAIL  " + label + ": differs from the golden file");
  console.log("        " + got.length + " bytes here, " + golden.length + " expected");
  console.log("        first difference at byte " + i);
  const ours = Buffer.from(got).toString("latin1").split("\r\n");
  const theirs = Buffer.from(golden).toString("latin1").split("\r\n");
  const line = Buffer.from(golden.subarray(0, i)).toString("latin1").split("\r\n").length;
  for (let r = Math.max(0, line - 2); r < Math.min(theirs.length, line + 1); r++) {
    if (ours[r] !== theirs[r]) {
      console.log("        line " + (r + 1) + " golden:  " + JSON.stringify(theirs[r]));
      console.log("        line " + (r + 1) + " browser: " + JSON.stringify(ours[r]));
    }
  }
}

async function main() {
  let visible = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === "--head") visible = true;
    else {
      console.error("worker.test: unknown option \"" + arg + "\"");
      console.error("usage: node test/web/worker.test.mjs [--head]");
      return 2;
    }
  }

  if (!existsSync(MODULE_PATH)) {
    console.error("worker.test: no " + MODULE_PATH
      + "\n             build it with: python3 tools/build.py --wasm");
    return 1;
  }

  const golden = new Uint8Array(
    readFileSync(join(ROOT, "test", "golden", "rozhovor.txt")));

  const { data, url } = await runPage({
    page: "test/web/worker.html", visible, timeoutMs: 240000,
  });
  if (data.error) {
    console.error("\nthe page failed:\n" + data.error);
    return 1;
  }

  console.log("where   " + data.where);
  console.log("page    " + url.replace(/^http:\/\/127\.0\.0\.1:\d+/, ""));

  for (const run of data.runs) {
    heading(run.kind + " (load " + (run.load_ms / 1000).toFixed(2) + " s, "
      + run.sentence_count + " sentences in " + run.answers_ms.toFixed(0) + " ms)");
    compareTranscript(run.kind + " transcript, through the worker and back", run.transcript, golden);
    eq(run.kind + ": pokyd_sentence_count() over the wire", run.sentence_count, 23);
    eq(run.kind + ": unfreed blocks", run.unfreed, 0);

    /* The measurement phase 4.2 is for. */
    const stall = run.responsiveness.maxStallMs;
    ok(run.kind + ": the main thread stayed responsive -- longest stall "
      + stall.toFixed(0) + " ms over a " + (run.load_ms / 1000).toFixed(1)
      + " s load", stall < MAX_STALL_MS,
      "it was blocked for " + stall.toFixed(0) + " ms, which is more than the "
      + MAX_STALL_MS + " ms this test allows");
    ok(run.kind + ": and kept painting -- " + run.responsiveness.frames
      + " animation frames during the load", run.responsiveness.frames > 0,
      "requestAnimationFrame never ran, so nothing could have been drawn");

    /* The progress channel, over postMessage this time rather than in-process. */
    ok(run.kind + ": output events arrived during the load, not after it",
      run.output.duringLoad > 0,
      "none of the " + run.output.count + " output events arrived while loading");
    if (run.kind === "cold") {
      ok("cold: " + run.output.percentages + " of them were a percentage a loading"
        + " bar could use", run.output.percentages > 10,
        "only " + run.output.percentages + " looked like \"47.3%\"");
      console.log("        first: " + run.output.samples.slice(0, 4)
        .map((s) => JSON.stringify(s)).join(" "));
    }
  }

  const cold = data.runs.find((b) => b.kind === "cold");
  if (cold) {
    heading("the exported cache");
    const nativePath = join(ROOT, "build", "run", "SLOVNIK.TMP");
    if (existsSync(nativePath)) {
      eq("SLOVNIK.TMP is the same size as the native one", cold.cacheLength,
        readFileSync(nativePath).length);
    } else {
      ok("SLOVNIK.TMP was exported", cold.cacheLength > 0);
      console.log("        no build/run/SLOVNIK.TMP to compare it against");
    }
    ok("it survived the transfer to the main thread and back into a second worker",
      data.runs.some((b) => b.kind === "warm"),
      "there was no warm run, so the blob never made the round trip");
  }

  heading("the protocol");
  ok("a request before init rejects instead of hanging",
    typeof data.protocol.beforeInit === "string"
      && data.protocol.beforeInit.indexOf("init") >= 0,
    "the rejection said: " + JSON.stringify(data.protocol.beforeInit));
  eq("four concurrent requests: getSettings sees the mood that was set",
    data.protocol.concurrent.mood, 2);
  eq("four concurrent requests: progress() answers the progress request",
    data.protocol.concurrent.phase, 0);
  eq("four concurrent requests: sentenceCount() answers the count request",
    data.protocol.concurrent.count, 0);
  ok("four concurrent requests: no two replies were crossed",
    data.protocol.concurrent.same === true);

  ok("the page was cross-origin isolated, as test/browser.mjs intends",
    data.isolated === true);

  console.log(failures === 0
    ? "\nPASS -- " + checks + " checks.  IQ Pokyd holds the golden conversation in"
      + " a browser, on a thread that leaves the page alive."
    : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
  return failures === 0 ? 0 : 1;
}

process.exit(await main());
