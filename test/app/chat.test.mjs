/* IQ Pokyd - test/app/chat.test.mjs - phase 5.2 of PLAN.md.

   The milestone: hold a conversation with IQ Pokyd in a browser. Every test
   before this one drove the engine -- through the C API, through the wasm
   module, through the worker protocol. This one drives the page. It builds the
   app with Vite, serves dist/ over loopback, launches Chrome at
   test/app/chat.html, and that page puts the built index.html in an iframe and
   types the 23 sentences of test/golden/rozhovor.in into it, one at a time,
   pressing the button each time.

   What comes back is what was on the screen: the transcript read out of the
   DOM, encoded back to CP1250 and compared here with the file the MinGW build
   printed to a console at phase 1.6. If those bytes match, then a person with
   a browser and a person with a 2005 Windows binary are talking to the same
   program.

   Twice over. A first visit inflects 402,252 word forms and leaves 18 MB in
   IndexedDB; a second iframe -- new worker, new wasm module, new database
   connection -- finds that blob and is ready in a fifth of a second. Both have
   to be the golden conversation, and the second one has to be fast, or phase
   4.4 bought nothing.

   Run it:   node test/app/chat.test.mjs [--head]

   Needs python3 tools/build.py --wasm to have run, and npm install. It runs
   `vite build` itself, so what it tests is always the current sources. --head
   shows the browser, which is the only way to watch the conversation happen.

   Written by us, not ported. English identifiers and ASCII only, like the rest
   of the non-engine code, so every Czech letter in here is a \u escape.
*/

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { ROOT, runPage } from "../browser.mjs";

const MODULE_PATH = join(ROOT, "build", "wasm", "pokyd.mjs");
const VITE_BIN = join(ROOT, "node_modules", "vite", "bin", "vite.js");
const GOLDEN = join(ROOT, "test", "golden", "rozhovor.txt");

/* test/golden/README.md: what that transcript was recorded under.  Character 3
   and both genders are NASTAV_STANDARDNE's own defaults (NASTAVEN.PR:25-43),
   and the page reads them back rather than setting them, so a moved default
   fails here and not as a mystifying transcript diff. */
const CHARACTER = 3;
const MOOD = 3;
const GENDER = 1;
/* What 23 sentences of test/golden/rozhovor.in do to it: nalada 3 -> 1, the
   best of the five.  Phase 7.2 owns the drift; this is here so that a change to
   it is noticed by something. */
const MOOD_AFTER = 1;

/* 4.4 measured 14.53 s cold and 0.18 s warm in Chrome 152.  These are the
   bounds that would mean something had gone wrong -- a cold path taken twice,
   or a load so slow the cache cannot be being read at all -- not the
   measurement. */
const WARM_MAX_MS = 3000;

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

/* Where two CP1250 transcripts first differ, in the terms the golden file is
   written in: a line number and both versions of the line, as escapes. */
function firstDifference(got, expected) {
  const n = Math.min(got.length, expected.length);
  let at = -1;
  for (let i = 0; i < n; i++) {
    if (got[i] !== expected[i]) { at = i; break; }
  }
  if (at === -1) {
    return "one is a prefix of the other: " + got.length + " bytes against "
      + expected.length;
  }
  const line = expected.subarray(0, at).reduce(
    (count, b) => count + (b === 0x0a ? 1 : 0), 0) + 1;
  const show = (bytes) => {
    const start = bytes.lastIndexOf(0x0a, at) + 1;
    let end = bytes.indexOf(0x0a, at);
    if (end === -1) end = bytes.length;
    return Array.from(bytes.subarray(start, end)).map(
      (b) => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b)
        : "\\x" + b.toString(16).padStart(2, "0")).join("");
  };
  return "byte " + at + ", line " + line + ":\n        got      " + show(got)
    + "\n        expected " + show(expected);
}

/* ------------------------------------------------------------- the checks */

function checkVisit(run, golden, cold) {
  heading(run.kind + " visit -- " + (run.loadMs / 1000).toFixed(2)
    + " s to the first typed character, " + run.turns + " turns on the screen");

  /* 1. what the visitor saw before the engine was ready. */
  eq("the page came up loading, not ready", run.firstState, "loading");
  ok("IDD_NACITANI was on the screen while it loaded", run.loadingShown === true);
  ok("and off it afterwards", run.loadingGone === true);
  ok("the input and the button are live", run.inputLive === true);
  ok("and the cursor is in the input, so the visitor can just type",
    run.focused === true);

  /* 2. the conversation, which is the whole point. */
  const got = Uint8Array.from(run.transcript);
  ok("the transcript on the screen is test/golden/rozhovor.txt, byte for byte"
    + " -- " + got.length + " bytes",
    got.length === golden.length && Buffer.compare(got, golden) === 0,
    firstDifference(got, golden));
  eq("46 turns: 23 typed, 23 answered", run.turns, 46);
  eq("and they alternate", run.whoOrder,
    Array.from({ length: 23 }, () => "human,pokyd").join(","));
  eq("no answer came back empty", run.emptyAnswers, 0);
  eq("the engine counted the same 23 sentences", run.sentenceCount, 23);
  ok("the input was locked while the engine answered", run.busySeen > 0,
    "the busy state was never observed between a click and an answer");

  /* 3. the settings the golden file leans on, read back rather than set. */
  eq("character is still 3 (prumerny)", run.settings.character, CHARACTER);
  eq("mood is still 3 (normalni)", run.settings.mood, MOOD);
  eq("both genders are still the default", run.settings.humanGender, GENDER);
  eq("  and the computer's", run.settings.computerGender, GENDER);
  /* Read again after the 23rd sentence.  nalada is naladabody/15 and
     naladabody drifts as the conversation goes (INTELIG.FU:532), so this is the
     one setting that is expected to have moved -- and 1 is the best of the
     five, which is what 23 civil sentences get you. */
  eq("and the mood it ended the conversation in", run.moodAfter, MOOD_AFTER);

  /* 4. the cache, from phase 4.4, now doing its job for a real page. */
  if (cold) {
    ok("a first visit wrote the cache -- " + run.report.bytes + " bytes",
      run.report.saved === true && run.report.bytes > 18000000);
    ok("and it did not find one to start with", run.report.hit === false);
  } else {
    ok("a second visit found it", run.report.hit === true);
    ok("so it did not write one again", run.report.saved === false);
    ok("and it was ready in " + (run.loadMs / 1000).toFixed(2) + " s",
      run.loadMs < WARM_MAX_MS,
      "a warm visit took " + run.loadMs + " ms, which is a cold path");
  }
  eq("no storage failure", run.report.error, null);

  /* 5. the teardown. */
  eq("the engine freed everything it allocated", run.unfreed, 0);
}

/* -------------------------------------------------------------- the driver */

async function main() {
  const visible = process.argv.includes("--head");

  if (!existsSync(MODULE_PATH)) {
    console.error("no " + MODULE_PATH + "\n"
      + "  build it first:  python3 tools/build.py --wasm");
    return 1;
  }
  if (!existsSync(VITE_BIN)) {
    console.error("no " + VITE_BIN + "\n  install it first:  npm install");
    return 1;
  }

  console.log("IQ Pokyd - phase 5.2, the conversation in the built app\n");

  /* Build what the browser is about to be shown, so that this test can never
     pass against a dist/ somebody left lying about. */
  const build = spawnSync(process.execPath, [VITE_BIN, "build"],
    { cwd: ROOT, encoding: "utf8" });
  if (build.status !== 0) {
    console.error("vite build failed:\n" + (build.stdout || "")
      + (build.stderr || ""));
    return 1;
  }
  const built = (build.stdout || "").split("\n")
    .filter((line) => line.includes("dist/"))
    .map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trim());
  console.log("build   vite build, " + built.length + " files:");
  for (const line of built) console.log("        " + line);

  const { data, url, exe } = await runPage({
    page: "test/app/chat.html", visible, timeoutMs: 300000, quiet: true,
  });
  if (data.error) {
    console.error("\nthe page failed:\n" + data.error);
    return 1;
  }
  console.log("browser " + exe);
  console.log("page    " + url.replace(/^http:\/\/127\.0\.0\.1:\d+/, ""));
  console.log("app     " + data.app);

  const golden = readFileSync(GOLDEN);

  heading("the page itself");
  eq("23 sentences were typed into it", data.sentences, 23);
  eq("it is titled as the author titled his window", data.cold.title,
    "IQ Pokyd v0.15");
  eq("and it declares the language IQ Pokyd speaks", data.cold.lang, "cs");
  eq("the transcript is marked up with the golden file's own two characters",
    data.cold.markers.join(""), "<>");

  checkVisit(data.cold, golden, true);
  checkVisit(data.warm, golden, false);

  heading("the two visits together");
  ok("both used the same cache key: " + data.cold.report.key,
    data.sameKey === true);
  ok("and they are the same conversation",
    Buffer.compare(Uint8Array.from(data.cold.transcript),
      Uint8Array.from(data.warm.transcript)) === 0);
  ok("the second visit was " + (data.cold.loadMs / data.warm.loadMs).toFixed(0)
    + " times faster to start", data.warm.loadMs * 4 < data.cold.loadMs,
    "cold " + data.cold.loadMs + " ms, warm " + data.warm.loadMs + " ms");

  console.log(failures === 0
    ? "\nPASS -- " + checks + " checks.  IQ Pokyd holds the phase 1.6"
      + " conversation in a browser, byte for byte, on a first visit and on a"
      + " second."
    : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
  return failures === 0 ? 0 : 1;
}

process.exit(await main());
