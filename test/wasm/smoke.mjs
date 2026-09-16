/* IQ Pokyd - test/wasm/smoke.mjs - phase 3.3 of PLAN.md, the gate.

   Drives build/wasm/pokyd.mjs through the same 23 sentences the native driver
   was driven through at phase 1.6 and diffs the answers against
   test/golden/rozhovor.txt byte for byte.  If they differ, the wasm build's
   engine differs from the native one -- hazard 1 (char signedness) and hazard 4
   (overflow, aliasing, -O level) are the two that can do it, and the golden file
   is not the thing to re-record.  See test/golden/README.md.

   Two runs, not one, because they exercise different code:

     cold   an empty MEMFS, so ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU inflects
            11,207 words into 402,252 forms and writes an 18 MB SLOVNIK.TMP
     warm   a second module instance that gets that blob back through
            pokyd_import_cache before loading -- hazard 10's adjacency, and the
            only way the plan's "time the second run" is even possible here,
            since MEMFS does not survive an instance

   The blob the cold run exports is also compared against the native
   build/run/SLOVNIK.TMP when there is one: it is 18 MB the golden transcript
   barely touches, and phase 4.4 is going to keep it in IndexedDB.

   Nothing here decodes anything.  rozhovor.in is CP1250 bytes on disk, the API
   takes CP1250 bytes, and the transcript is written back out as the bytes the
   engine returned, so no codec sits between the golden file and the answer.
   That is phase 4.1's job and this test deliberately predates it.

   Usage:
       node test/wasm/smoke.mjs [-v] [--noise] [--no-warm] [--module FILE]

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code.
*/

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/* The settings the golden conversation was recorded with -- test/golden/README.md.
   They are NASTAV_STANDARDNE's own defaults, and pinned here for the same reason
   the driver pins them on the command line: so the test does not move if a
   default ever does. */
const SEED = 20050415;
const CHARACTER = 3;       /* prumerny -- average */
const MOOD = 3;            /* normalni -- normal */
const HUMAN_GENDER = 1;    /* muz -- male; NASTAVEN.PR:26 */
const COMPUTER_GENDER = 1;

/* struct pokyd_settings (src/api/pokyd_api.h), field by field in declaration
   order.  Every member is a char or an array of char, so the layout is a running
   sum with no padding anywhere and no alignment to reason about -- but it is
   still a C layout being read from JS, so the offsets are checked against what
   the engine actually writes into the struct before anything trusts them. */
const SETTINGS_LAYOUT = [
  ["humanGender", 1], ["computerGender", 1],
  ["humanName", 101], ["computerName", 101],
  ["character", 1], ["mood", 1], ["moodPoints", 1],
  ["saveConversation", 1], ["useSounds", 1], ["useEffects", 1],
  ["formalCzech", 1], ["showLabels", 1],
  ["debugFastExit", 1], ["debugSpellingTolerance", 1],
  ["debugSpellingRecursion", 1],
  ["emulateKeyboard", 1], ["keyboardQwerty", 1], ["standardCursor", 1],
  ["cmdReadOnly", 1], ["cmdNoBackground", 1],
];
const OFFSET = {};
let SETTINGS_SIZE = 0;
for (const [name, width] of SETTINGS_LAYOUT) {
  OFFSET[name] = SETTINGS_SIZE;
  SETTINGS_SIZE += width;
}

/* ------------------------------------------------------------------ the heap */

/* HEAPU8 is replaced every time the memory grows, and loading the dictionary
   grows it several times over, so it is read off the module at every use and
   never cached in a local. */

function put_string(M, bytes) {
  /* CP1250 bytes in, NUL-terminated copy in the wasm heap out. */
  const p = M._malloc(bytes.length + 1);
  if (p === 0) throw new Error("out of wasm memory");
  M.HEAPU8.set(bytes, p);
  M.HEAPU8[p + bytes.length] = 0;
  return p;
}

function read_string(M, p) {
  /* The engine's own buffer -- copied out, because the next pokyd_say overwrites
     it and because the heap underneath it can move. */
  if (p === 0) return null;
  const heap = M.HEAPU8;
  let end = p;
  while (heap[end] !== 0) end++;
  return Buffer.from(heap.subarray(p, end));
}

function error_of(M) {
  const b = read_string(M, M._pokyd_error());
  return b === null ? "(null)" : b.toString("latin1");
}

/* --------------------------------------------------------------------- a run */

async function one_conversation(PokydModule, sentences, { cache, verbose, noise, label }) {
  /* The engine talks to the console on its own account and always has: the
     inflection progress bar (SLOVNIK.FU:3322), and vstup.fu:801-809, which
     prints every base form it recognises on every sentence.  Native runs send
     that to stdout and the driver keeps the transcript in a separate file;
     here it would be 2.6 MB of node console traffic on top of a timed load, so
     it is discarded unless --noise asks for it.  The engine still makes every
     call -- nothing about what it computes changes. */
  const M = await PokydModule(noise ? {} : { print: () => {}, printErr: () => {} });

  const data_dir = put_string(M, Buffer.from("/pokyd", "latin1"));
  if (M._pokyd_init(data_dir) !== 0) throw new Error("pokyd_init: " + error_of(M));
  M._free(data_dir);

  /* Settings first, and through the engine's own accessors: read what
     NASTAV_STANDARDNE left, change the ones the golden run changed, write it
     back.  pokyd_set_mood separately, because mood is derived from moodPoints
     and writing it through the struct alone is undone after the next sentence
     (INTELIG.FU:1047). */
  const n = M._malloc(SETTINGS_SIZE);
  M._pokyd_get_settings(n);
  check_layout(M, n, label);
  M.HEAPU8[n + OFFSET.humanGender] = HUMAN_GENDER;
  M.HEAPU8[n + OFFSET.computerGender] = COMPUTER_GENDER;
  M.HEAPU8[n + OFFSET.character] = CHARACTER;
  M._pokyd_set_settings(n);
  M._pokyd_set_mood(MOOD);

  /* Before loading, never during -- hazard 10, and pokyd_api.h says why the
     import is a step of its own rather than an argument to the load. */
  if (cache) {
    const p = M._malloc(cache.length);
    if (p === 0) throw new Error("out of wasm memory installing the cache");
    M.HEAPU8.set(cache, p);
    if (M._pokyd_import_cache(p, cache.length) !== 0)
      throw new Error("pokyd_import_cache: " + error_of(M));
    M._free(p);
  }

  const t0 = performance.now();
  if (M._pokyd_load_dictionaries() !== 0)
    throw new Error("pokyd_load_dictionaries: " + error_of(M));
  const load_ms = performance.now() - t0;
  if (M._pokyd_phase() !== 6 /* POKYD_PHASE_DONE */)
    throw new Error("loaded, but pokyd_phase() says " + M._pokyd_phase());

  /* After loading, not before: the cold path reseeds from the clock on its way
     out (SLOVNIK.FU:1732). */
  M._pokyd_seed(SEED);

  const chunks = [];
  const t1 = performance.now();
  for (const sentence of sentences) {
    const p = put_string(M, sentence);
    const answer = read_string(M, M._pokyd_say(p));
    M._free(p);
    if (answer === null) throw new Error("pokyd_say returned NULL");
    chunks.push(Buffer.from("> ", "latin1"), sentence, Buffer.from("\r\n", "latin1"));
    chunks.push(Buffer.from("< ", "latin1"), answer, Buffer.from("\r\n", "latin1"));
    if (verbose) {
      process.stdout.write("  > " + sentence.toString("latin1") + "\n");
      process.stdout.write("  < " + answer.toString("latin1") + "\n");
    }
  }
  const answers_ms = performance.now() - t1;

  const sentence_count = M._pokyd_sentence_count();

  /* Export before shutdown: SLOVNIK.TMP lives in this instance's MEMFS and goes
     away with it. */
  let exported = null;
  const p_len = M._malloc(4);
  const block = M._pokyd_export_cache(p_len);
  if (block !== 0) {
    /* The length comes back through an unsigned long *, which is 32 bits little
       endian on wasm32.  Read off HEAPU8 rather than HEAPU32 so the module needs
       only the one view exported. */
    const h = M.HEAPU8;
    const cache_len = h[p_len] | (h[p_len + 1] << 8) | (h[p_len + 2] << 16)
      | (h[p_len + 3] * 0x1000000);
    exported = Buffer.from(M.HEAPU8.subarray(block, block + cache_len));
    M._pokyd_free(block);
  }
  M._free(p_len);
  M._free(n);

  const unfreed = M._pokyd_shutdown();

  return {
    transcript: Buffer.concat(chunks),
    load_ms, answers_ms, unfreed, sentence_count, cache: exported,
  };
}

function check_layout(M, n, label) {
  /* The one thing that could silently corrupt every setting at once: an offset
     table that has drifted from the header.  NASTAV_STANDARDNE has just run, so
     the defaults it wrote (NASTAVEN.PR:25-43) are known, and reading them back
     through these offsets is a real check of the layout. */
  const h = M.HEAPU8;
  const expected = {
    humanGender: 1, computerGender: 1, character: 3, mood: 3,
    saveConversation: 1, useSounds: 1, useEffects: 0,
    formalCzech: 0, showLabels: 1,
    debugFastExit: 0, debugSpellingTolerance: 1,
    debugSpellingRecursion: 11, emulateKeyboard: 0, keyboardQwerty: 1,
    standardCursor: 0,
  };
  for (const [name, value] of Object.entries(expected)) {
    if (h[n + OFFSET[name]] !== value)
      throw new Error(label + ": struct pokyd_settings does not match pokyd_api.h -- "
        + name + " reads " + h[n + OFFSET[name]]
        + ", NASTAV_STANDARDNE wrote " + value);
  }
  if (h[n + OFFSET.humanName] !== 0 || h[n + OFFSET.computerName] !== 0)
    throw new Error(label + ": the name fields are not where pokyd_api.h says they are");
}

/* ------------------------------------------------------------------- the diff */

function compare(label, got, expected) {
  if (got.equals(expected)) {
    console.log("  ok    " + label + ": " + got.length + " bytes, identical");
    return 0;
  }
  console.log("  FAIL  " + label + ": differs from the golden file");
  console.log("        " + got.length + " bytes here, " + expected.length + " expected");

  let i = 0;
  while (i < got.length && i < expected.length && got[i] === expected[i]) i++;
  const line = expected.subarray(0, i).toString("latin1").split("\r\n").length;
  console.log("        first difference at byte " + i + ", line " + line);

  const ours = got.toString("latin1").split("\r\n");
  const theirs = expected.toString("latin1").split("\r\n");
  for (let r = Math.max(0, line - 2); r < Math.min(theirs.length, line + 2); r++) {
    if (ours[r] !== theirs[r]) {
      console.log("        line " + (r + 1) + " golden: " + JSON.stringify(theirs[r]));
      console.log("        line " + (r + 1) + " wasm:   " + JSON.stringify(ours[r]));
    }
  }
  return 1;
}

function check_rest(when, run, expected_sentences) {
  let failures = 0;
  if (run.sentence_count !== expected_sentences) {
    console.log("  FAIL  " + when + ": pokyd_sentence_count() is " + run.sentence_count
      + ", expected " + expected_sentences);
    failures++;
  }
  if (run.unfreed !== 0) {
    console.log("  FAIL  " + when + ": " + run.unfreed + " memory blocks were not freed");
    failures++;
  } else {
    console.log("  ok    " + when + ": teardown clean, 0 unfreed blocks");
  }
  return failures;
}

/* --------------------------------------------------------------------- driver */

async function main() {
  let verbose = false, warm = true, noise = false;
  let module_path = join(ROOT, "build", "wasm", "pokyd.mjs");
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "-v" || argv[i] === "--verbose") verbose = true;
    else if (argv[i] === "--no-warm") warm = false;
    else if (argv[i] === "--noise") noise = true;
    else if (argv[i] === "--module" && i + 1 < argv.length) module_path = argv[++i];
    else {
      console.error('smoke: unknown option "' + argv[i] + '"');
      console.error("usage: node test/wasm/smoke.mjs [-v] [--noise] [--no-warm]"
        + " [--module FILE]");
      return 2;
    }
  }

  if (!existsSync(module_path)) {
    console.error("smoke: no " + module_path
      + "\n       build it with: python3 tools/build.py --wasm");
    return 1;
  }

  const golden = readFileSync(join(ROOT, "test", "golden", "rozhovor.txt"));
  const input = readFileSync(join(ROOT, "test", "golden", "rozhovor.in"));
  /* Exactly what the driver's loop does: strip the CR, drop empty lines
     (mfcDlg.cpp:556), keep every other byte as it lies. */
  const sentences = input.toString("latin1").split("\n")
    .map((r) => Buffer.from(r.replace(/\r+$/, ""), "latin1"))
    .filter((b) => b.length > 0);

  console.log("node    " + process.version);
  console.log("module  " + module_path);
  console.log("input   " + sentences.length + " sentences");

  const { default: PokydModule } = await import(pathToFileURL(module_path).href);

  let failures = 0;

  console.log("\ncold (empty MEMFS, the dictionary gets inflected):");
  const cold = await one_conversation(PokydModule, sentences,
    { cache: null, verbose, noise, label: "cold" });
  console.log("  load  " + (cold.load_ms / 1000).toFixed(2) + " s, "
    + sentences.length + " answers in " + cold.answers_ms.toFixed(0) + " ms");
  writeFileSync(join(ROOT, "build", "wasm", "rozhovor-cold.txt"), cold.transcript);
  failures += compare("cold transcript", cold.transcript, golden);
  failures += check_rest("cold", cold, sentences.length);

  if (cold.cache === null) {
    console.log("  FAIL  the cold run exported no cache -- no SLOVNIK.TMP was written");
    failures++;
  } else {
    console.log("  ok    cache exported: " + cold.cache.length + " bytes");
    const native_path = join(ROOT, "build", "run", "SLOVNIK.TMP");
    if (existsSync(native_path)) {
      failures += compare("SLOVNIK.TMP vs the native one", cold.cache,
        readFileSync(native_path));
    } else {
      console.log("  --    no build/run/SLOVNIK.TMP to compare it against"
        + " (run the native build first)");
    }
  }

  if (warm && cold.cache !== null) {
    console.log("\nwarm (a second instance, the cache imported before loading):");
    const warm = await one_conversation(PokydModule, sentences,
      { cache: cold.cache, verbose, noise, label: "warm" });
    console.log("  load  " + (warm.load_ms / 1000).toFixed(2) + " s, "
      + sentences.length + " answers in " + warm.answers_ms.toFixed(0) + " ms");
    writeFileSync(join(ROOT, "build", "wasm", "rozhovor-warm.txt"), warm.transcript);
    failures += compare("warm transcript", warm.transcript, golden);
    failures += check_rest("warm", warm, sentences.length);
  }

  console.log(failures === 0
    ? "\nPASS -- the wasm build answers exactly what the native one answered."
    : "\nFAIL -- " + failures + " check(s) did not hold.");
  return failures === 0 ? 0 : 1;
}

process.exit(await main());
