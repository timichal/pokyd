/* IQ Pokyd - test/web/progress.test.mjs - phase 4.3 of PLAN.md, in the browser.

   test/web/progress.test.ts proves the tracker reads a real cold load
   correctly, but it does it in node with the engine's console handed over as a
   function call: no worker, no throttle, no DOM.  This runs the whole of 4.3
   where it is going to live -- headless Chrome, src/web/worker.ts on its own
   thread, src/web/client.ts over the message protocol, and src/web/loading.ts
   drawing IDD_NACITANI into the page.

   The question it exists for is the throttle.  The worker sends at most one
   output message per 60 ms because a cold load writes 397,897 of them, and
   three of the four step markers land in the middle of a run of percentages --
   so a throttle that treated them as ordinary segments would drop them, the
   caption would never leave "Nacitam zakladni slovnik...", and nothing in node
   could have noticed.  The worker exempts anything that is not a bare
   percentage.  Either all four markers cross the boundary or they do not.

   It also reads the loading window back out of the DOM at every change, so what
   is judged here is what was on the screen: the author's captions, his decimal
   comma, the bar's width, the indeterminate state during the write that
   publishes no number, and his "Vytvarim slovni zasobu, prosim cekejte..." on
   the visit that has to wait.

   Run it:   node test/web/progress.test.mjs [--head]

   Needs python3 tools/build.py --wasm to have run.  --head shows the browser
   window instead of running headless, which is the only way to watch the bar
   actually move.  No package.json and no driver: the page is served by
   test/browser.mjs.

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code, so every Czech letter in here is a \u escape.
*/

import { existsSync } from "node:fs";
import { join } from "node:path";

import { ROOT, runPage } from "../browser.mjs";

const MODULE_PATH = join(ROOT, "build", "wasm", "pokyd.mjs");

/* The four markers, as CP852 read as CP1250.  Stated here too, so that a change
   to the engine's console output fails in node as well as in the browser. */
const SEG_INFLECTING = "Sklo\u013auji...";
const SEG_SORTING = "T\u00fd\u02c7d\u02c7m...";
const SEG_WRITING = "Zapisuji...";
const SEG_COLD_DONE = "Hotovo. Prevedeno ";

let checks = 0;
let failures = 0;

function heading(text) { console.log("\n" + text); }

function show(text) {
  let out = "";
  for (const c of String(text)) {
    const n = c.codePointAt(0);
    out += n >= 0x20 && n < 0x7f ? c : "\\u" + n.toString(16).padStart(4, "0");
  }
  return "\"" + out + "\"";
}

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

function eqText(label, got, expected) {
  ok(label, got === expected,
    "got " + show(got) + ", expected " + show(expected));
}

/* ----------------------------------------------------------------- the checks */

function checkVisit(run, ids, cold) {
  heading(run.kind + " visit (" + (run.loadMs / 1000).toFixed(2) + " s, "
    + run.segments + " output events through the worker, " + run.frames
    + " animation frames)");

  /* 1. the throttle. */
  if (cold) {
    eq("the throttle let all four step markers through", run.markers.length, 4);
    eqText("  the first is Sklo\u0148uji...", run.markers[0], SEG_INFLECTING);
    eqText("  then T\u0159\u00edd\u00edm...", run.markers[1], SEG_SORTING);
    eqText("  then Zapisuji...", run.markers[2], SEG_WRITING);
    ok("  then Hotovo. Prevedeno ...",
      typeof run.markers[3] === "string"
        && run.markers[3].startsWith(SEG_COLD_DONE),
      "it said " + show(run.markers[3]));
    ok("and it still dropped almost everything else -- " + run.segments
      + " events for 397,897 segments", run.segments < 2000,
      run.segments + " events crossed the boundary, so the throttle is not"
      + " throttling");
  } else {
    eq("a warm load has no step markers to lose", run.markers.length, 0);
  }

  /* 2. the steps.  A subsequence of the canonical order and not the whole of
     it, because the throttle is doing its job: POKYD_STEP_INTELLIGENCE is three
     milliseconds long and 60 ms is the gap between two messages, so it usually
     goes by without a message of its own.  That is a step nobody could have
     read anyway.  The steps that have to appear are the ones long enough to be
     worth a caption -- which is the whole cold path. */
  const canonical = [ids.base, ids.inflecting, ids.sorting, ids.writing,
    ids.vocabulary, ids.intelligence, ids.done];
  const required = cold
    ? [ids.base, ids.inflecting, ids.sorting, ids.writing, ids.vocabulary,
       ids.done]
    : [ids.base, ids.vocabulary, ids.done];
  ok("the steps it went through are in the canonical order: "
    + run.steps.join(","),
    run.steps.every((s, i) => canonical.includes(s)
      && (i === 0 || run.steps[i - 1] < s)),
    "against " + canonical.join(","));
  ok("and it did not skip one that lasts long enough to read",
    required.every((s) => run.steps.includes(s)),
    "it showed " + run.steps.join(",") + ", needing " + required.join(","));
  ok("and the bar never moved backwards over " + run.distinctPositions
    + " distinct positions", run.monotonic === true);
  if (cold) {
    ok("which is enough of them to look like motion over fifteen seconds",
      run.distinctPositions > 200,
      "only " + run.distinctPositions);
  }

  /* 3. what was on the screen. */
  heading(run.kind + ": the loading window, read back out of the DOM");
  for (const shot of run.screens) {
    console.log("        " + show(shot.caption).padEnd(44) + " "
      + shot.percent.padStart(7) + "  width " + shot.width
      + (shot.indeterminate ? "  [indeterminate]" : "")
      + (shot.noticeShown ? "  [notice]" : ""));
  }

  eqText("the first caption is the base dictionary", run.captions[0],
    "Na\u010d\u00edt\u00e1m z\u00e1kladn\u00ed slovn\u00edk...");
  if (cold) {
    eqText("then Sklo\u0148uji slovn\u00edk...", run.captions[1],
      "Sklo\u0148uji slovn\u00edk...");
    eqText("then T\u0159\u00edd\u00edm slovn\u00ed z\u00e1sobu...", run.captions[2],
      "T\u0159\u00edd\u00edm slovn\u00ed z\u00e1sobu...");
    eqText("then Zapisuji slovn\u00edk...", run.captions[3],
      "Zapisuji slovn\u00edk...");
    ok("the write, which publishes no number, showed as indeterminate rather"
      + " than as a stalled bar", run.indeterminateDuringWrite === true);
    ok("and the author's \"Vytv\u00e1\u0159\u00edm slovn\u00ed z\u00e1sobu, pros\u00edm"
      + " \u010dekejte...\" was on the screen for the wait",
      run.noticeDuringCold === true);
  } else {
    ok("a warm visit never shows the fifteen-second notice",
      run.noticeDuringCold === false);
  }

  eqText("it ends on 100,0% -- the author's decimal comma, PROSTRED.FU:530",
    run.finalScreen.percent, "100,0%");
  /* The browser normalises "100.00%" to "100%" on the way into the style
     attribute, so compare the number rather than the spelling. */
  eq("with the bar full", parseFloat(run.finalScreen.width), 100);
  ok("and nothing still claiming to be busy",
    run.finalScreen.indeterminate === false
      && run.finalScreen.noticeShown === false);
  eq("aria-valuenow agrees with it", run.finalScreen.ariaNow, "100.0");
  ok("and the caption is the step that just ended, not \"Spou\u0161t\u00edm IQ"
    + " Pokyd...\" again",
    run.finalScreen.caption !== "Spou\u0161t\u00edm IQ Pokyd...",
    "it went back to " + show(run.finalScreen.caption));

  /* 4. the housekeeping. */
  eq("the engine freed every block", run.unfreed, 0);
  ok("the loading window was in the page while it loaded", run.inDom === true);
  ok("and remove() took it out again", run.afterRemove === false);
  ok("the page kept painting -- " + run.frames + " animation frames",
    run.frames > 0);
}

async function main() {
  let visible = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === "--head") visible = true;
    else {
      console.error("progress.test: unknown option \"" + arg + "\"");
      console.error("usage: node test/web/progress.test.mjs [--head]");
      return 2;
    }
  }

  if (!existsSync(MODULE_PATH)) {
    console.error("progress.test: no " + MODULE_PATH
      + "\n               build it with: python3 tools/build.py --wasm");
    return 1;
  }

  const { data, url } = await runPage({
    page: "test/web/progress.html", visible, timeoutMs: 240000,
  });
  if (data.error) {
    console.error("\nthe page failed:\n" + data.error);
    return 1;
  }

  console.log("where   " + data.where);
  console.log("page    " + url.replace(/^http:\/\/127\.0\.0\.1:\d+/, ""));

  heading("the captions the browser loaded");
  eq("nine of them, one per step", data.captions.length, 9);
  eqText("and they are the author's", data.captions[1],
    "Na\u010d\u00edt\u00e1m z\u00e1kladn\u00ed slovn\u00edk...");
  eqText("the cold notice too", data.coldNotice,
    "Vytv\u00e1\u0159\u00edm slovn\u00ed z\u00e1sobu, pros\u00edm \u010dekejte...");

  checkVisit(data.cold, data.stepIds, true);
  checkVisit(data.warm, data.stepIds, false);

  heading("afterwards");
  ok("the exported cache is the 18 MB one", data.cold.cacheLength > 18000000,
    data.cold.cacheLength + " bytes");
  ok("nothing of either loading window is left in the page",
    data.screenEmpty === true);
  ok("the stylesheet stays, because the next load would only put it back",
    data.styleKept === true);
  ok("the page was cross-origin isolated, as test/browser.mjs intends",
    data.isolated === true);

  console.log(failures === 0
    ? "\nPASS -- " + checks + " checks.  IQ Pokyd says what it is doing while it"
      + " starts, in the author's own words."
    : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
  return failures === 0 ? 0 : 1;
}

process.exit(await main());
