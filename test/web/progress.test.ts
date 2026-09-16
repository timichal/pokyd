/* IQ Pokyd - test/web/progress.test.ts - phase 4.3 of PLAN.md, the parse.

   src/web/progress.ts claims to turn the engine's console into a loading bar.
   The claim has two halves and this file tests both, the second against the
   real engine:

     1. the state machine.  Given the stream a load produces, does it name the
        right step, in the right order, with a percentage that only ever goes
        up and ends at exactly 100?
     2. the stream.  Is that actually what a load produces?  A parser tested
        only against a fixture of its author's imagining is a parser tested
        against itself, so the second half of this file drives a real cold load
        and a real warm one and holds the tracker to what comes out.

   Two things are checked here that are facts about the engine rather than about
   the parser, and they are the two that would be expensive to rediscover:

     - the step markers arrive as CP852 read as CP1250, because the engine prints
       them through NAPIS_TEXT_V_LATIN_2.  The bytes are asserted, not the
       mojibake, so a change in the codec and a change in the engine fail
       differently.
     - a cold load writes exactly eight lines that are not a percentage, and the
       four this depends on are among them, in order.  If the author's console
       output ever moves, that count is what says so.

   No Worker and no DOM.  src/web/loading.ts and the throttle in
   src/web/worker.ts -- the two things that need a browser -- are
   test/web/progress.test.mjs.

   Run it:   node test/web/progress.test.ts [--no-cold] [-v]

   Needs python3 tools/build.py --wasm to have run.  --no-cold skips the
   fifteen-second cold load, which is most of the running time and all of the
   interesting output; -v prints the state at every step change.

   No package.json, no dependencies: node 24 strips the types itself.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code,
   so every Czech letter in here is a \u escape.
*/

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { encodeCp1250 } from "../../src/web/cp1250.ts";
import { PokydEngine } from "../../src/web/engine.ts";
import type { PokydModuleFactory } from "../../src/web/engine.ts";
import {
  PokydLoadingTracker,
  POKYD_COLD_NOTICE,
  POKYD_STEP_CAPTIONS,
  POKYD_STEP_IDLE,
  POKYD_STEP_BASE_DICTIONARY,
  POKYD_STEP_INFLECTING,
  POKYD_STEP_SORTING,
  POKYD_STEP_WRITING,
  POKYD_STEP_VOCABULARY,
  POKYD_STEP_INTELLIGENCE,
  POKYD_STEP_DONE,
  formatPercent,
  percentDecimals,
} from "../../src/web/progress.ts";
import type { PokydLoadingState } from "../../src/web/progress.ts";
import {
  POKYD_PHASE_BASE_DICTIONARY,
  POKYD_PHASE_VOCABULARY,
  POKYD_PHASE_INFLECTING,
  POKYD_PHASE_INTELLIGENCE,
  POKYD_PHASE_EXTERNAL,
  POKYD_PHASE_DONE,
} from "../../src/web/protocol.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODULE_PATH = join(ROOT, "build", "wasm", "pokyd.mjs");

/* The four lines the state machine turns on, as the engine writes them.  They
   are spelled out again here rather than imported, so that this is an
   independent statement of what the bytes are and not a restatement of
   src/web/progress.ts's opinion of them. */
const SEG_INFLECTING = "Sklo\u013auji...";
const SEG_SORTING = "T\u00fd\u02c7d\u02c7m...";
const SEG_WRITING = "Zapisuji...";
const SEG_COLD_DONE = "Hotovo. Prevedeno 11207 slov.";

/* ------------------------------------------------------------- the scoreboard */

let checks = 0;
let failures = 0;
let verbose = false;

function heading(text: string): void { console.log("\n" + text); }

function ok(label: string, cond: boolean, detail = ""): void {
  checks++;
  if (cond) {
    console.log("  ok    " + label);
  } else {
    failures++;
    console.log("  FAIL  " + label + (detail ? "\n        " + detail : ""));
  }
}

function eq(label: string, got: unknown, expected: unknown): void {
  ok(label, Object.is(got, expected),
    "got " + JSON.stringify(got) + ", expected " + JSON.stringify(expected));
}

function near(label: string, got: number, expected: number, slack: number): void {
  ok(label, Math.abs(got - expected) <= slack,
    "got " + got + ", expected " + expected + " +/- " + slack);
}

/* ASCII-safe rendering of a Czech string, for a failure message in a terminal
   that may or may not be UTF-8. */
function show(text: string): string {
  let out = "";
  for (const c of text) {
    const n = c.codePointAt(0) as number;
    out += n >= 0x20 && n < 0x7f ? c : "\\u" + n.toString(16).padStart(4, "0");
  }
  /* Quoted by hand, not by JSON.stringify: that would escape the backslash of
     every escape this just wrote and print \\u013a for one character. */
  return "\"" + out + "\"";
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

function eqText(label: string, got: string, expected: string): void {
  ok(label, got === expected,
    "got " + show(got) + ", expected " + show(expected));
}

/* --------------------------------------------------- the markers are CP852 */

/* SLOVNIK.FU prints the two accented captions through NAPIS_TEXT_V_LATIN_2
   (VSTUP.FU:1230), which converts CP1250 to CP852 first -- hazard 6's "Latin
   2".  Phase 4.1's codec is CP1250 and must stay CP1250, so what reaches
   JavaScript is those CP852 bytes read as CP1250.  These are the bytes. */
function testMarkerBytes(): void {
  heading("the step markers, as the engine writes them (CP852, not CP1250)");

  eq("Sklo\u0148uji... is 53 6b 6c 6f e5 75 6a 69 2e 2e 2e",
    hex(encodeCp1250(SEG_INFLECTING)),
    "53 6b 6c 6f e5 75 6a 69 2e 2e 2e");
  eq("T\u0159\u00edd\u00edm... is 54 fd a1 64 a1 6d 2e 2e 2e",
    hex(encodeCp1250(SEG_SORTING)),
    "54 fd a1 64 a1 6d 2e 2e 2e");
  /* 0xe5 is n-caron in CP852 and a-ring in CP1250; 0xa1 is i-acute in CP852 and
     a caron in CP1250.  Neither is a letter JELI_PISMENO would accept, which is
     why the mojibake is stable and why matching on it is safe.

     And the conversion is real: the same words spelled in CP1250, which is what
     the author typed into SLOVNIK.FU, are different bytes. */
  const cp1250Spelling = hex(encodeCp1250("Sklo\u0148uji..."));
  ok("the CP1250 spelling of the same word is " + cp1250Spelling
    + " -- different bytes, so something converted them",
    cp1250Spelling !== hex(encodeCp1250(SEG_INFLECTING)));

  /* The two that are plain ASCII go through printf untouched. */
  eq("Zapisuji... is ASCII and goes through printf untouched",
    hex(encodeCp1250(SEG_WRITING)),
    "5a 61 70 69 73 75 6a 69 2e 2e 2e");
}

/* ----------------------------------------------------------- the author's text */

/* Every caption is his, from the resource file or from the two .FU files, and
   this is where a typo in one of them would be caught.  They are the whole
   visible output of phase 4.3, so they are worth an exact comparison. */
function testCaptions(): void {
  heading("the captions, from IQPokyd.rc, PROSTRED.FU and SLOVNIK.FU");

  eqText("IDLE: IQPokyd.rc:124 CAPTION and :130 IDC_TEXT",
    POKYD_STEP_CAPTIONS[POKYD_STEP_IDLE], "Spou\u0161t\u00edm IQ Pokyd...");
  eqText("BASE_DICTIONARY: PROSTRED.FU:568",
    POKYD_STEP_CAPTIONS[POKYD_STEP_BASE_DICTIONARY],
    "Na\u010d\u00edt\u00e1m z\u00e1kladn\u00ed slovn\u00edk...");
  eqText("INFLECTING: SLOVNIK.FU:3261",
    POKYD_STEP_CAPTIONS[POKYD_STEP_INFLECTING], "Sklo\u0148uji slovn\u00edk...");
  eqText("SORTING: SLOVNIK.FU:3331",
    POKYD_STEP_CAPTIONS[POKYD_STEP_SORTING],
    "T\u0159\u00edd\u00edm slovn\u00ed z\u00e1sobu...");
  eqText("WRITING: SLOVNIK.FU:3342",
    POKYD_STEP_CAPTIONS[POKYD_STEP_WRITING], "Zapisuji slovn\u00edk...");
  eqText("VOCABULARY: PROSTRED.FU:576",
    POKYD_STEP_CAPTIONS[POKYD_STEP_VOCABULARY],
    "Na\u010d\u00edt\u00e1m slovn\u00ed z\u00e1sobu...");
  eqText("INTELLIGENCE: PROSTRED.FU:586",
    POKYD_STEP_CAPTIONS[POKYD_STEP_INTELLIGENCE],
    "Na\u010d\u00edt\u00e1m inteligenci...");
  eqText("the cold notice: PROSTRED.FU:579, the window title of a first visit",
    POKYD_COLD_NOTICE,
    "Vytv\u00e1\u0159\u00edm slovn\u00ed z\u00e1sobu, pros\u00edm \u010dekejte...");

  /* Every caption has to be something, including the two ends. */
  ok("all nine steps have a caption",
    POKYD_STEP_CAPTIONS.length === 9
      && POKYD_STEP_CAPTIONS.every((c) => c.length > 0),
    POKYD_STEP_CAPTIONS.length + " captions");
}

/* ------------------------------------------------------------- the formatting */

function testFormat(): void {
  heading("the percentage, formatted the way VLAKNO__PROCENTA_PROGRESU did");

  eqText("a decimal comma, because Czech uses one", formatPercent(47.25), "47,3%");
  eqText("no decimals when asked for none", formatPercent(47.25, 0), "47%");
  eqText("zero", formatPercent(0), "0,0%");
  eqText("one hundred", formatPercent(100), "100,0%");
  eqText("out of range is clamped rather than shown", formatPercent(-3), "0,0%");
  eqText("and so is the other end", formatPercent(1e9, 0), "100%");
  eqText("NaN does not reach the screen", formatPercent(NaN), "0,0%");

  eq("one decimal while inflecting, PROSTRED.FU:527",
    percentDecimals(POKYD_STEP_INFLECTING), 1);
  eq("one decimal while sorting", percentDecimals(POKYD_STEP_SORTING), 1);
  eq("none while writing, PROSTRED.FU:526",
    percentDecimals(POKYD_STEP_WRITING), 0);
  eq("none while reading the base dictionary",
    percentDecimals(POKYD_STEP_BASE_DICTIONARY), 0);
}

/* ---------------------------------------------------------- synthetic streams */

/* A recorder that keeps every state the tracker published, so a test can ask
   what the screen would have shown rather than only what it ended on. */
function recorder(): { tracker: PokydLoadingTracker; seen: PokydLoadingState[] } {
  const seen: PokydLoadingState[] = [];
  const tracker = new PokydLoadingTracker({
    onChange: (state) => {
      seen.push(state);
      if (verbose) {
        console.log("        step " + state.step + " " + show(state.caption)
          + " step=" + String(state.stepPercent)
          + " overall=" + state.percent.toFixed(2)
          + " cold=" + String(state.cold));
      }
    },
  });
  return { tracker, seen };
}

function bar(tracker: PokydLoadingTracker, phase: number,
             from: number, to: number, step: number, decimals = 0): void {
  for (let v = from; v <= to; v += step) {
    tracker.output(v.toFixed(decimals) + "% ", { phase, percent: 0 });
  }
}

function monotonic(states: PokydLoadingState[]): boolean {
  for (let i = 1; i < states.length; i++) {
    if (states[i].percent < states[i - 1].percent) return false;
    if (states[i].step < states[i - 1].step) return false;
  }
  return true;
}

function testColdStream(): void {
  heading("a cold load, as a stream (no engine)");
  const { tracker, seen } = recorder();
  const P = { phase: POKYD_PHASE_INFLECTING, percent: 0 };

  bar(tracker, POKYD_PHASE_BASE_DICTIONARY, 0, 100, 10);
  eq("the base dictionary is the first step", tracker.state.step,
    POKYD_STEP_BASE_DICTIONARY);
  eq("and nothing has said yet whether this is a cold load",
    tracker.state.cold, null);

  /* NACTI_A_ROZSKLONUJ re-reads the base dictionary before it says anything, and
     the phase is already POKYD_PHASE_INFLECTING while it does. */
  bar(tracker, POKYD_PHASE_INFLECTING, 0, 100, 10);
  eq("the re-read inside NACTI_A_ROZSKLONUJ is still the base dictionary",
    tracker.state.step, POKYD_STEP_BASE_DICTIONARY);

  tracker.output(SEG_INFLECTING, P);
  eq("Sklo\u0148uji... starts the inflection loop", tracker.state.step,
    POKYD_STEP_INFLECTING);
  eq("and that is what says the load is a cold one", tracker.state.cold, true);
  eqText("the caption is the author's", tracker.state.caption,
    "Sklo\u0148uji slovn\u00edk...");
  eq("with no percentage of its own yet", tracker.state.stepPercent, null);

  bar(tracker, POKYD_PHASE_INFLECTING, 0, 100, 4, 1);
  near("the inflection loop is 9 points of the bar", tracker.state.percent,
    1 + 9, 0.2);

  tracker.output(SEG_SORTING, P);
  eq("T\u0159\u00edd\u00edm... starts the sort", tracker.state.step, POKYD_STEP_SORTING);
  bar(tracker, POKYD_PHASE_INFLECTING, 0, 100, 2.5, 1);
  near("which is 86 points, and the one that needed them",
    tracker.state.percent, 1 + 9 + 86, 0.2);

  tracker.output(SEG_WRITING, P);
  eq("Zapisuji... starts the write", tracker.state.step, POKYD_STEP_WRITING);
  eq("the write publishes no number, and says so rather than showing zero",
    tracker.state.stepPercent, null);
  near("so the bar holds where the sort left it", tracker.state.percent, 96, 0.2);

  tracker.output(SEG_COLD_DONE, P);
  eq("Hotovo. ends the cold path", tracker.state.step, POKYD_STEP_VOCABULARY);
  /* The DOS harness's own sign-off, which arrives after it and must move
     nothing. */
  tracker.output("MAX_POCET_VSECH_SLOV: 402252", P);
  tracker.output("Stiskni cokoliv", P);
  eq("and the harness winding down moves nothing", tracker.state.step,
    POKYD_STEP_VOCABULARY);

  /* pokyd_api.cpp then reloads: base dictionary again, then the 18 MB cache. */
  bar(tracker, POKYD_PHASE_BASE_DICTIONARY, 0, 100, 10);
  eq("the second base-dictionary read does not walk the step back",
    tracker.state.step, POKYD_STEP_VOCABULARY);
  bar(tracker, POKYD_PHASE_VOCABULARY, 0, 100, 5);

  bar(tracker, POKYD_PHASE_INTELLIGENCE, 0, 52, 4);
  eq("the intelligence file is the last step with a bar", tracker.state.step,
    POKYD_STEP_INTELLIGENCE);
  ok("and the bar is short of 100 when the engine stops talking",
    tracker.state.percent < 100,
    "it was already at " + tracker.state.percent);

  tracker.finish();
  eq("finish() takes it to exactly 100", tracker.state.percent, 100);
  eq("and to the last step", tracker.state.step, POKYD_STEP_DONE);
  eq("and says so", tracker.state.done, true);

  ok("nothing in " + seen.length + " published states moved backwards",
    monotonic(seen));
  ok("every state was a change -- no duplicates published",
    seen.every((s, i) => i === 0
      || s.percent !== seen[i - 1].percent
      || s.step !== seen[i - 1].step
      || s.stepPercent !== seen[i - 1].stepPercent
      || s.cold !== seen[i - 1].cold));
}

function testWarmStream(): void {
  heading("a warm load, as a stream (no engine)");
  const { tracker, seen } = recorder();

  bar(tracker, POKYD_PHASE_BASE_DICTIONARY, 0, 100, 10);
  eq("still nothing to say about cold or warm", tracker.state.cold, null);

  /* The discriminator: a cold load prints nothing at all under this phase,
     because the read fails on the missing SLOVNIK.TMP before its own bar. */
  bar(tracker, POKYD_PHASE_VOCABULARY, 0, 100, 5);
  eq("output under POKYD_PHASE_VOCABULARY means the cache was there",
    tracker.state.cold, false);
  eq("so the step is the vocabulary", tracker.state.step, POKYD_STEP_VOCABULARY);
  near("and it is worth 88 of the 100 points of a warm load",
    tracker.state.percent, 10 + 88, 0.2);

  bar(tracker, POKYD_PHASE_INTELLIGENCE, 0, 52, 4);
  bar(tracker, POKYD_PHASE_EXTERNAL, 0, 100, 50);
  tracker.finish();
  eq("finish() takes a warm load to 100 too", tracker.state.percent, 100);
  ok("and nothing moved backwards on the way", monotonic(seen));
}

function testEdges(): void {
  heading("the edges");

  {
    const { tracker } = recorder();
    bar(tracker, POKYD_PHASE_BASE_DICTIONARY, 0, 60, 10);
    const high = tracker.state.percent;
    /* SETRID_SLOVA_V_DATABAZI steps back by 0.1 eighty-odd times in 392,699
       readings; that is long double rounding, not progress being lost. */
    tracker.output("59% ", { phase: POKYD_PHASE_BASE_DICTIONARY, percent: 0 });
    eq("a percentage that goes backwards does not move the bar",
      tracker.state.percent, high);
    eq("nor the step's own number", tracker.state.stepPercent, 60);
  }

  {
    const { tracker, seen } = recorder();
    tracker.output("nothing the parser knows",
      { phase: POKYD_PHASE_BASE_DICTIONARY, percent: 0 });
    eq("an unrecognised line is not a percentage", tracker.state.stepPercent, null);
    eq("but it still carries the phase", tracker.state.step,
      POKYD_STEP_BASE_DICTIONARY);
    tracker.output("", { phase: POKYD_PHASE_BASE_DICTIONARY, percent: 0 });
    tracker.output("%", { phase: POKYD_PHASE_BASE_DICTIONARY, percent: 0 });
    tracker.output("12%%", { phase: POKYD_PHASE_BASE_DICTIONARY, percent: 0 });
    eq("and neither are three things that nearly look like one",
      tracker.state.stepPercent, null);
    eq("the tracker published " + seen.length + " state, not four",
      seen.length, 1);
  }

  {
    /* pokyd_load_dictionaries sets POKYD_PHASE_DONE on the line before it
       returns, and src/web/worker.ts always delivers one event carrying it --
       the flush of whatever the throttle was holding, which happens after the
       call has come back.  The tracker takes that as the load being over. */
    const { tracker } = recorder();
    bar(tracker, POKYD_PHASE_BASE_DICTIONARY, 0, 100, 25);
    tracker.output(SEG_INFLECTING, { phase: POKYD_PHASE_INFLECTING, percent: 0 });
    tracker.output("40% ", { phase: POKYD_PHASE_DONE, percent: 100 });
    eq("an event carrying POKYD_PHASE_DONE finishes the load",
      tracker.state.done, true);
    eq("and takes the bar to 100 without being asked",
      tracker.state.percent, 100);
    eqText("keeping the caption of the step that ended, not the idle one",
      tracker.state.caption, "Sklo\u0148uji slovn\u00edk...");
  }

  {
    const { tracker } = recorder();
    bar(tracker, POKYD_PHASE_BASE_DICTIONARY, 0, 100, 25);
    tracker.finish();
    const after = tracker.state.percent;
    tracker.output(SEG_INFLECTING, { phase: POKYD_PHASE_INFLECTING, percent: 0 });
    eq("output after finish() is ignored", tracker.state.percent, after);
    eq("and the step stays where finish() put it", tracker.state.step,
      POKYD_STEP_DONE);
    tracker.finish();
    eq("finish() twice is not an error", tracker.state.percent, 100);

    tracker.reset();
    eq("reset() puts it back to the beginning", tracker.state.step,
      POKYD_STEP_IDLE);
    eq("with nothing on the bar", tracker.state.percent, 0);
    eq("and nothing decided about the load", tracker.state.cold, null);
  }

  {
    /* attach() has to leave whatever was listening still listening: a page can
       want both a loading screen and a debug log. */
    const { tracker } = recorder();
    const heard: string[] = [];
    const seenBefore: string[] = [];
    const source = {
      onOutput: ((text: string) => { seenBefore.push(text); }) as
        ((text: string, progress: { phase: number; percent: number }) => void)
        | null,
    };
    const detach = tracker.attach(source);
    tracker.onChange = (s) => { heard.push(s.caption); };
    source.onOutput?.("50% ", { phase: POKYD_PHASE_BASE_DICTIONARY, percent: 0 });
    eq("attach() feeds the tracker", tracker.state.stepPercent, 50);
    eq("and the listener that was there before it", seenBefore.length, 1);
    ok("and the tracker published a state", heard.length === 1);
    detach();
    source.onOutput?.("90% ", { phase: POKYD_PHASE_BASE_DICTIONARY, percent: 0 });
    eq("detaching stops the tracker", tracker.state.stepPercent, 50);
    eq("and gives the old listener its channel back", seenBefore.length, 2);
  }
}

/* -------------------------------------------------------------- a real load */

interface LiveRun {
  states: PokydLoadingState[];
  lines: string[];        /* every segment that was not a percentage */
  segments: number;
  /* How many segments the engine wrote while each step was on screen.  This is
     the measurement phase 4.3 turned on: the sort writes 392,699 of them and
     the inflection loop 1,121. */
  segmentsByStep: Map<number, number>;
  loadMs: number;
  final: PokydLoadingState;
}

/* One load with a tracker on it, driven exactly as src/web/worker.ts drives one
   -- the phase counters read from inside the blocked call -- but unthrottled,
   so the tracker sees every one of the 397,897 segments a cold load writes. */
async function liveRun(factory: PokydModuleFactory,
                       cache: Uint8Array | null): Promise<LiveRun> {
  const states: PokydLoadingState[] = [];
  const lines: string[] = [];
  const segmentsByStep = new Map<number, number>();
  let segments = 0;
  let loading = false;

  const tracker = new PokydLoadingTracker({
    onChange: (state) => { if (loading) states.push(state); },
  });

  const engine = await PokydEngine.create(factory, {
    onOutput: (text: string) => {
      segments++;
      if (!/^\s*\d+(?:\.\d+)?%\s*$/.test(text)) lines.push(text);
      tracker.output(text, engine.progress());
      const step = tracker.state.step;
      segmentsByStep.set(step, (segmentsByStep.get(step) ?? 0) + 1);
    },
  });

  if (cache !== null) engine.importCache(cache);

  loading = true;
  const t0 = performance.now();
  engine.load();
  const loadMs = performance.now() - t0;
  tracker.finish();
  loading = false;

  const out: LiveRun = {
    states, lines, segments, segmentsByStep, loadMs, final: tracker.state,
  };
  const exported = cache === null ? engine.exportCache() : null;
  engine.shutdown();
  if (exported !== null) coldCache = exported;
  return out;
}

let coldCache: Uint8Array | null = null;

function checkLive(run: LiveRun, kind: string, cold: boolean): void {
  heading(kind + " (" + (run.loadMs / 1000).toFixed(2) + " s, " + run.segments
    + " segments, " + run.states.length + " state changes)");

  eq(kind + ": the load was recognised as " + (cold ? "cold" : "warm"),
    run.final.cold, cold);
  eq(kind + ": it ends at exactly 100", run.final.percent, 100);
  eq(kind + ": on POKYD_STEP_DONE", run.final.step, POKYD_STEP_DONE);
  ok(kind + ": and nothing moved backwards getting there",
    monotonic(run.states));

  /* A bar nobody can see is no better than no bar.  A cold load has to publish
     enough intermediate positions to look like motion over fifteen seconds. */
  const distinct = new Set(run.states.map((s) => s.percent.toFixed(1))).size;
  if (cold) {
    ok(kind + ": " + distinct + " distinct positions on the bar",
      distinct > 200, "only " + distinct + ", which would look like a jump");
  }

  const stepsSeen = Array.from(new Set(run.states.map((s) => s.step)));
  const wanted = cold
    ? [POKYD_STEP_BASE_DICTIONARY, POKYD_STEP_INFLECTING, POKYD_STEP_SORTING,
       POKYD_STEP_WRITING, POKYD_STEP_VOCABULARY, POKYD_STEP_INTELLIGENCE,
       POKYD_STEP_DONE]
    : [POKYD_STEP_BASE_DICTIONARY, POKYD_STEP_VOCABULARY,
       POKYD_STEP_INTELLIGENCE, POKYD_STEP_DONE];
  eq(kind + ": the steps it went through, in order", stepsSeen.join(","),
    wanted.join(","));

  if (!cold) return;

  /* The census.  Eight lines that are not a percentage, and the four the parser
     turns on are among them in this order.  A change to the author's console
     output lands here first. */
  eq("cold: the engine writes eight lines that are not a percentage",
    run.lines.length, 8);
  const markers = run.lines.filter((l) =>
    l === SEG_INFLECTING || l === SEG_SORTING || l === SEG_WRITING
    || l.startsWith("Hotovo. Prevedeno "));
  eq("cold: four of them are the step markers", markers.length, 4);
  eqText("cold: and the first is Sklo\u0148uji...", markers[0], SEG_INFLECTING);
  eqText("cold: then T\u0159\u00edd\u00edm...", markers[1], SEG_SORTING);
  eqText("cold: then Zapisuji...", markers[2], SEG_WRITING);
  ok("cold: then Hotovo. Prevedeno 11207 slov.",
    markers[3] === SEG_COLD_DONE, "it said " + show(markers[3] ?? ""));

  /* 4.3's own finding: the long step is the sort, not the inflection, and the
     sort has a bar.  This is what says so on the running engine. */
  const sortSegments = run.segmentsByStep.get(POKYD_STEP_SORTING) ?? 0;
  const inflectSegments = run.segmentsByStep.get(POKYD_STEP_INFLECTING) ?? 0;
  ok("cold: SETRID_SLOVA_V_DATABAZI wrote " + sortSegments + " segments to"
    + " ROZSKLONUJ_PODLE_SPRAVNEHO_VZORU's " + inflectSegments
    + " -- the long step is the sort",
    sortSegments > 100 * inflectSegments && inflectSegments > 1000,
    "the sort no longer dwarfs the inflection loop, so the weights in"
    + " src/web/progress.ts are describing a different engine");
  const sorting = run.states.filter((s) => s.step === POKYD_STEP_SORTING);
  ok("cold: and it moved the bar " + sorting.length + " times across its"
    + " twelve seconds", sorting.length > 900,
    "only " + sorting.length + ", so it has stopped printing its percentage");

  for (const line of run.lines) console.log("        " + show(line));
}

/* -------------------------------------------------------------------- driver */

async function main(): Promise<number> {
  let cold = true;
  for (const arg of process.argv.slice(2)) {
    if (arg === "--no-cold") cold = false;
    else if (arg === "-v") verbose = true;
    else {
      console.error("progress.test: unknown option \"" + arg + "\"");
      console.error("usage: node test/web/progress.test.ts [--no-cold] [-v]");
      return 2;
    }
  }

  console.log("IQ Pokyd - the loading bar (phase 4.3)");

  testMarkerBytes();
  testCaptions();
  testFormat();
  testColdStream();
  testWarmStream();
  testEdges();

  if (!existsSync(MODULE_PATH)) {
    console.error("\nprogress.test: no " + MODULE_PATH
      + "\n               build it with: python3 tools/build.py --wasm");
    return 1;
  }
  const factory = (await import(pathToFileURL(MODULE_PATH).href)
    ).default as PokydModuleFactory;

  if (cold) {
    checkLive(await liveRun(factory, null), "cold", true);
  } else {
    console.log("\n(--no-cold: the cold load and its eight lines are skipped)");
  }

  if (coldCache === null) {
    const nativeCache = join(ROOT, "build", "run", "SLOVNIK.TMP");
    if (!existsSync(nativeCache)) {
      console.error("\nprogress.test: no cache to warm-start from."
        + "\n               run without --no-cold, or build build/run/SLOVNIK.TMP"
        + " with: python3 tools/build.py");
      return 1;
    }
    const { readFileSync } = await import("node:fs");
    coldCache = new Uint8Array(readFileSync(nativeCache));
  }
  checkLive(await liveRun(factory, coldCache), "warm", false);

  console.log(failures === 0
    ? "\nPASS -- " + checks + " checks.  The engine's console is a loading bar,"
      + " and the long step is the sort."
    : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
  return failures === 0 ? 0 : 1;
}

process.exit(await main());
