/* IQ Pokyd - test/web/engine.test.ts - phase 4.2 of PLAN.md, the string boundary.

   test/wasm/smoke.mjs already proves the wasm engine answers what the native one
   answers, and it does it in bytes on purpose: it predates the codec, so nothing
   sits between the golden file and the engine.  This asks the next question.
   src/web/engine.ts puts phase 4.1's codec on both ends -- a JavaScript string
   goes in, a JavaScript string comes out -- and the question is whether the
   conversation survives that.

   It does if, and only if, re-encoding the answers reproduces
   test/golden/rozhovor.txt byte for byte.  1,116 bytes of Czech with thirty
   accented letters in it, so a codec that lost or bent one of them could not.

   What else is checked here, roughly in order of how much it would hurt to be
   wrong:

     1. the transcript, cold and warm, through decode -> say -> encode
     2. the ordering rules pokyd_api.h states and does not enforce: seeding
        before a load, importing a cache after one, saying anything before one.
        All three are silent failures in C and exceptions here.
     3. the 220-byte settings struct, read and written from JavaScript,
        including a Czech name that has to survive as CP1250 in a char[101]
     4. that the engine's console output reaches JS *during* the synchronous
        load -- the finding phase 4.3 is built on, and the reason
        src/web/protocol.ts says what it says about g_procentanacitani
     5. a clean teardown: zero unfreed blocks, both runs

   There is no Worker here.  This file drives PokydEngine directly, because that
   class is deliberately transport-free and node has no Web Worker; the protocol,
   the worker and the client are tested in a real browser by
   test/web/worker.test.mjs.

   Run it:   node test/web/engine.test.ts [--no-cold] [-v]

   Needs python3 tools/build.py --wasm to have run.  --no-cold skips the
   fourteen-second cold load and warms up from build/run/SLOVNIK.TMP instead,
   which is a faster way of running everything except the cold path.

   No package.json, no dependencies: node 24 strips the types itself.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code,
   so every Czech letter in here is a \u escape.
*/

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { decodeCp1250, encodeCp1250 } from "../../src/web/cp1250.ts";
import { PokydEngine, POKYD_SETTINGS_SIZE } from "../../src/web/engine.ts";
import type { PokydModuleFactory } from "../../src/web/engine.ts";
import { POKYD_PHASE_DONE, POKYD_PHASE_INFLECTING } from "../../src/web/protocol.ts";
import type { PokydSettings } from "../../src/web/protocol.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODULE_PATH = join(ROOT, "build", "wasm", "pokyd.mjs");

/* The settings the golden conversation was recorded with -- test/golden/README.md.
   They are NASTAV_STANDARDNE's own defaults, pinned here for the same reason the
   driver pins them on the command line: so the test does not move if a default
   does. */
const SEED = 20050415;
const CHARACTER = 3;       /* prumerny -- average */
const MOOD = 3;            /* normalni -- normal */
const HUMAN_GENDER = 1;    /* muz -- male; NASTAVEN.PR:26 */
const COMPUTER_GENDER = 1;

/* ------------------------------------------------------------- the scoreboard */

let checks = 0;
let failures = 0;

function heading(text: string): void {
  console.log("\n" + text);
}

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

function throwsWith(label: string, action: () => void, wanted: string): void {
  checks++;
  try {
    action();
    failures++;
    console.log("  FAIL  " + label + "\n        it did not throw");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.indexOf(wanted) >= 0) {
      console.log("  ok    " + label);
    } else {
      failures++;
      console.log("  FAIL  " + label + "\n        threw " + JSON.stringify(message)
        + ", expected it to mention " + JSON.stringify(wanted));
    }
  }
}

/* ----------------------------------------------------------------- the diff */

function bytesEq(label: string, got: Uint8Array, expected: Uint8Array): void {
  checks++;
  if (got.length === expected.length) {
    let i = 0;
    while (i < got.length && got[i] === expected[i]) i++;
    if (i === got.length) {
      console.log("  ok    " + label + ": " + got.length + " bytes, identical");
      return;
    }
  }
  failures++;
  let i = 0;
  while (i < got.length && i < expected.length && got[i] === expected[i]) i++;
  const line = decodeCp1250(expected.subarray(0, i)).split("\r\n").length;
  console.log("  FAIL  " + label + ": differs from the golden file");
  console.log("        " + got.length + " bytes here, " + expected.length + " expected");
  console.log("        first difference at byte " + i + ", line " + line);
  const ours = decodeCp1250(got).split("\r\n");
  const theirs = decodeCp1250(expected).split("\r\n");
  for (let r = Math.max(0, line - 2); r < Math.min(theirs.length, line + 1); r++) {
    if (ours[r] !== theirs[r]) {
      console.log("        line " + (r + 1) + " golden: " + JSON.stringify(theirs[r]));
      console.log("        line " + (r + 1) + " engine: " + JSON.stringify(ours[r]));
    }
  }
}

/* --------------------------------------------------------------------- a run */

interface Output {
  segments: string[];
  duringLoad: number;
  percentsWhileInflecting: number[];
  phasesDuringLoad: Set<number>;
}

interface Run {
  transcript: Uint8Array;
  output: Output;
  unfreed: number;
  sentenceCount: number;
  cache: Uint8Array | null;
  loadMs: number;
}

async function oneConversation(factory: PokydModuleFactory, sentences: string[],
                               options: { cache: Uint8Array | null;
                                          wantCache: boolean;
                                          verbose: boolean }): Promise<Run> {
  const output: Output = {
    segments: [], duringLoad: 0, percentsWhileInflecting: [],
    phasesDuringLoad: new Set<number>(),
  };
  let loading = false;

  const engine = await PokydEngine.create(factory, {
    onOutput: (text: string) => {
      output.segments.push(text);
      if (!loading) return;
      output.duringLoad++;
      /* Read from inside the blocked call: this is exactly what the worker does
         and the only moment the counters mean anything. */
      const state = engine.progress();
      output.phasesDuringLoad.add(state.phase);
      if (state.phase === POKYD_PHASE_INFLECTING) {
        output.percentsWhileInflecting.push(state.percent);
      }
    },
  });

  if (options.cache !== null) engine.importCache(options.cache);

  const settings = engine.getSettings();
  settings.humanGender = HUMAN_GENDER;
  settings.computerGender = COMPUTER_GENDER;
  settings.character = CHARACTER;
  engine.setSettings(settings);
  engine.setMood(MOOD);

  loading = true;
  const t0 = performance.now();
  engine.load();
  const loadMs = performance.now() - t0;
  loading = false;

  engine.seed(SEED);

  let transcript = "";
  for (const sentence of sentences) {
    const answer = engine.say(sentence);
    transcript += "> " + sentence + "\r\n< " + answer + "\r\n";
    if (options.verbose) console.log("    > " + sentence + "\n    < " + answer);
  }

  const sentenceCount = engine.sentenceCount();
  const cache = options.wantCache ? engine.exportCache() : null;
  const unfreed = engine.shutdown();

  return {
    transcript: encodeCp1250(transcript), output, unfreed, sentenceCount, cache,
    loadMs,
  };
}

/* -------------------------------------------------------------------- driver */

async function main(): Promise<number> {
  let coldRun = true;
  let verbose = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === "--no-cold") coldRun = false;
    else if (arg === "-v" || arg === "--verbose") verbose = true;
    else {
      console.error("engine.test: unknown option \"" + arg + "\"");
      console.error("usage: node test/web/engine.test.ts [--no-cold] [-v]");
      return 2;
    }
  }

  if (!existsSync(MODULE_PATH)) {
    console.error("engine.test: no " + MODULE_PATH
      + "\n             build it with: python3 tools/build.py --wasm");
    return 1;
  }

  const golden = new Uint8Array(readFileSync(join(ROOT, "test", "golden", "rozhovor.txt")));
  /* Exactly what the driver's loop does: strip the CR, drop empty lines
     (mfcDlg.cpp:556).  Decoded here, because above src/web/engine.ts everything
     is a string -- which is the thing being tested. */
  const sentences = decodeCp1250(readFileSync(join(ROOT, "test", "golden", "rozhovor.in")))
    .split("\n").map((r) => r.replace(/\r+$/, "")).filter((r) => r.length > 0);

  const { default: factory } =
    await import(pathToFileURL(MODULE_PATH).href) as { default: PokydModuleFactory };

  console.log("node    " + process.version);
  console.log("module  " + MODULE_PATH);
  console.log("input   " + sentences.length + " sentences, decoded from CP1250");

  const nativeCache = join(ROOT, "build", "run", "SLOVNIK.TMP");
  let blob: Uint8Array | null = null;

  if (coldRun) {
    heading("cold (an empty MEMFS, so the dictionary gets inflected)");
    const run = await oneConversation(factory, sentences,
      { cache: null, wantCache: true, verbose });
    console.log("  load  " + (run.loadMs / 1000).toFixed(2) + " s");
    bytesEq("cold transcript, re-encoded", run.transcript, golden);
    eq("cold: pokyd_sentence_count()", run.sentenceCount, sentences.length);
    eq("cold: unfreed blocks", run.unfreed, 0);

    /* 4. The finding phase 4.3 is built on.  Emscripten calls the stdout hook
       synchronously from inside pokyd_load_dictionaries(), so text arrives while
       the call has not returned -- and the counter that ought to accompany it
       does not move, because SLOVNIK.FU:3318 is behind IQPOKYDWINMFC == 1. */
    ok("the engine's console output arrives during the load, not after it",
      run.output.duringLoad > 100,
      run.output.duringLoad + " segments arrived while load() was running");
    ok("at least one of them is a percentage the loading bar could use",
      run.output.segments.some((s) => /^\d+\.\d%\s*$/.test(s)),
      "no segment looked like \"47.3%\"");
    ok("it reports POKYD_PHASE_INFLECTING while it is inflecting",
      run.output.phasesDuringLoad.has(POKYD_PHASE_INFLECTING),
      "phases seen: " + [...run.output.phasesDuringLoad].join(", "));
    /* The claim is not "it never changes" -- the sub-step boundaries slam it to
       100 and back to 0 -- but "it never takes a value in between", which is
       what a progress bar would need.  SLOVNIK.FU:3318, the one assignment that
       would give it a gradient, is behind IQPOKYDWINMFC == 1. */
    const seen = [...new Set(run.output.percentsWhileInflecting)].sort((a, b) => a - b);
    ok("pokyd_progress() has no gradient through it -- see PROGRESS in protocol.ts",
      seen.length > 0 && seen.every((p) => p === 0 || p === 100),
      seen.length === 0
        ? "no sample was taken during POKYD_PHASE_INFLECTING"
        : "the counter took intermediate values: " + seen.slice(0, 8).join(", ")
            + " -- if SLOVNIK.FU:3318 is now compiled in, src/web/protocol.ts and"
            + " phase 4.3 both want updating");

    checks++;
    if (run.cache === null) {
      failures++;
      console.log("  FAIL  the cold run exported no cache -- no SLOVNIK.TMP was written");
    } else {
      console.log("  ok    cache exported: " + run.cache.length + " bytes");
      blob = run.cache;
      if (existsSync(nativeCache)) {
        bytesEq("SLOVNIK.TMP vs the native one", blob,
          new Uint8Array(readFileSync(nativeCache)));
      }
    }
  } else if (existsSync(nativeCache)) {
    blob = new Uint8Array(readFileSync(nativeCache));
    console.log("\n--no-cold: warming up from build/run/SLOVNIK.TMP ("
      + blob.length + " bytes)");
  } else {
    console.error("engine.test: --no-cold needs build/run/SLOVNIK.TMP"
      + "\n             make one with: python3 tools/build.py");
    return 1;
  }

  if (blob !== null) {
    heading("warm (the cache imported before the load)");
    const run = await oneConversation(factory, sentences,
      { cache: blob, wantCache: false, verbose });
    console.log("  load  " + (run.loadMs / 1000).toFixed(2) + " s");
    bytesEq("warm transcript, re-encoded", run.transcript, golden);
    eq("warm: pokyd_sentence_count()", run.sentenceCount, sentences.length);
    eq("warm: unfreed blocks", run.unfreed, 0);
  }

  /* --------------------------------------------------------- the small ones */

  /* Everything below runs on an engine that is never loaded, so it costs a
     module instantiation and nothing else. */
  heading("the ordering rules pokyd_api.h states and does not enforce");
  {
    const engine = await PokydEngine.create(factory);
    eq("a fresh engine is not loaded", engine.isLoaded, false);
    eq("pokyd_phase() is POKYD_PHASE_IDLE", engine.progress().phase, 0);
    throwsWith("say() before load() throws", () => engine.say("ahoj"), "not loaded");
    throwsWith("seed() before load() throws", () => engine.seed(1), "SLOVNIK.FU:1732");
    throwsWith("importCache() rejects an empty blob",
      () => engine.importCache(new Uint8Array(0)), "empty");
    throwsWith("setMood() rejects a mood outside 1..5", () => engine.setMood(6), "1..5");
    /* Found here, and it is the reason pokyd_api.h now says so: tearing down an
       engine that never loaded aborts the wasm module, because
       Typ_slova::VYMAZ_OBSAH frees twenty pointers that the base-dictionary read
       would have allocated and UVOLNI_X(NULL) is fatal by design. */
    throwsWith("shutdown() before a load throws rather than aborting the module",
      () => engine.shutdown(), "SKLONOV.FU:1348");
  }

  heading("the settings struct, from JavaScript");
  {
    const engine = await PokydEngine.create(factory);
    eq("sizeof(struct pokyd_settings)", POKYD_SETTINGS_SIZE, 220);

    const defaults = engine.getSettings();
    eq("NASTAV_STANDARDNE: character", defaults.character, 3);
    eq("NASTAV_STANDARDNE: mood", defaults.mood, 3);
    eq("NASTAV_STANDARDNE: debugSpellingRecursion",
      defaults.debugSpellingRecursion, 11);
    eq("NASTAV_STANDARDNE: the names start out empty", defaults.humanName, "");
    eq("every field of struct pokyd_settings is present",
      Object.keys(defaults).length, 20);

    /* "Michal" and "Pokyd" would prove nothing.  These are the letters CP1250
       has and ASCII does not, inside a char[101] the engine will read back. */
    const name = "Zlatkovsk\u00fd \u010cen\u011bk";        /* Zlatkovsky Cenek */
    const botName = "IQ Pokyd \u2013 p\u0159\u00edtel";     /* en dash, r-caron */
    const updated: PokydSettings = { ...defaults, humanName: name,
      computerName: botName, humanGender: 1, formalCzech: 1 };
    engine.setSettings(updated);
    const back = engine.getSettings();
    eq("a Czech name survives the round trip", back.humanName, name);
    eq("so does an en dash, which CP1250 has", back.computerName, botName);
    eq("and so does a plain flag", back.formalCzech, 1);

    /* char[101] is a hundred bytes and a terminator, and CP1250 is one byte per
       character, so the two counts agree and truncation is exact. */
    const longName = "\u017e".repeat(150);
    engine.setSettings({ ...back, humanName: longName });
    eq("a name longer than char[101] is truncated to 100 characters",
      engine.getSettings().humanName.length, 100);

    engine.setMood(5);
    const grumpy = engine.getSettings();
    eq("setMood(5) sets mood", grumpy.mood, 5);
    ok("setMood(5) moves moodPoints with it, which is the field that drifts",
      grumpy.moodPoints !== defaults.moodPoints,
      "moodPoints is still " + grumpy.moodPoints);
  }

  heading("the phase constants agree with pokyd_api.h");
  {
    eq("POKYD_PHASE_INFLECTING", POKYD_PHASE_INFLECTING, 3);
    eq("POKYD_PHASE_DONE", POKYD_PHASE_DONE, 6);
  }

  console.log(failures === 0
    ? "\nPASS -- " + checks + " checks.  The engine answers the same through a"
      + " string boundary as it does through a byte one."
    : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
  return failures === 0 ? 0 : 1;
}

process.exit(await main());
