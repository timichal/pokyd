/* IQ Pokyd - test/wasm/bench-core.mjs - one measured run of the wasm engine.

   Phase 3.4 of PLAN.md.  This is the part that has to be identical in node and
   in a browser, so it is a module of its own with no fs, no process and no DOM
   in it: the caller hands in the module factory, the sentences and the golden
   transcript, and gets back times and sizes.  test/wasm/bench.mjs is the node
   front end, test/wasm/bench.html the browser one.

   It drives the engine exactly the way test/wasm/smoke.mjs does -- same order,
   same settings, same seed -- because a benchmark that loads differently from
   the test is measuring a different program.  It also diffs the transcript on
   every run, so a number here is never reported for a run that answered wrong.

   What the numbers mean
   ---------------------
   load_ms       a bracket around pokyd_load_dictionaries() and nothing else.
                 tools/bench-native.py brackets the same call through the
                 driver's --time, which is what makes the two comparable.
   memory.*      HEAPU8.length at each checkpoint: the size of the wasm linear
                 memory, which only ever grows, so the last figure is also the
                 peak.  This is the engine's own heap and stack -- it is NOT the
                 whole cost of the tab.  MEMFS keeps file contents in JS typed
                 arrays outside the linear memory, so the 17 MB SLOVNIK.TMP the
                 cold path writes is somewhere else again, and the front ends
                 report what their host can see of it (process RSS in node, the
                 JS heap in a browser).

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code.
*/

/* The settings the golden conversation was recorded with -- test/golden/README.md,
   and pinned here for the same reason the driver pins them on the command line. */
export const SEED = 20050415;
const CHARACTER = 3;       /* prumerny -- average */
const MOOD = 3;            /* normalni -- normal */
const HUMAN_GENDER = 1;    /* muz -- male; NASTAVEN.PR:26 */
const COMPUTER_GENDER = 1;

/* struct pokyd_settings (src/api/pokyd_api.h) in declaration order.  Every member
   is a char or an array of char, so the layout is a running sum with no padding;
   smoke.mjs checks it against what NASTAV_STANDARDNE wrote, and does that on
   every run, so this copy does not repeat the check. */
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

/* HEAPU8 is replaced every time the memory grows, and the load grows it several
   times over, so it is read off the module at every use and never cached. */

function put_bytes(M, bytes) {
  const p = M._malloc(bytes.length + 1);
  if (p === 0) throw new Error("out of wasm memory");
  M.HEAPU8.set(bytes, p);
  M.HEAPU8[p + bytes.length] = 0;
  return p;
}

function read_string(M, p) {
  if (p === 0) return null;
  const heap = M.HEAPU8;
  let end = p;
  while (heap[end] !== 0) end++;
  return heap.slice(p, end);      /* a copy: the next call overwrites it */
}

function error_of(M) {
  const b = read_string(M, M._pokyd_error());
  return b === null ? "(null)" : String.fromCharCode(...b);
}

function same(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/* -------------------------------------------------------------- one full run */

/* sentences   an array of Uint8Array, CP1250, one sentence each
   golden      the golden transcript as a Uint8Array, or null to skip the diff
   cache       a Uint8Array to import before loading (a warm run), or null (cold)
   want_cache  export the cache afterwards -- the cold run does, to feed the warm one
*/
export async function measure(PokydModule, { sentences, golden = null, cache = null,
                                             want_cache = false, noise = false,
                                             probe = null } = {}) {
  const memory = {};
  const now = (typeof performance !== "undefined" ? () => performance.now()
                                                  : () => Date.now());

  /* The engine talks to the console on its own account -- the inflection
     progress bar (SLOVNIK.FU:3322) and vstup.fu:801-809 on every sentence.  That
     is 2.6 MB of traffic per run on top of a timed load, so it is discarded
     unless --noise asks for it.  3.3 measured the difference at under 1%. */
  const t_module = now();
  const M = await PokydModule(noise ? {} : { print: () => {}, printErr: () => {} });
  const module_ms = now() - t_module;
  memory.after_start = M.HEAPU8.length;

  const data_dir = put_bytes(M, new TextEncoder().encode("/pokyd"));
  if (M._pokyd_init(data_dir) !== 0) throw new Error("pokyd_init: " + error_of(M));
  M._free(data_dir);

  const n = M._malloc(SETTINGS_SIZE);
  M._pokyd_get_settings(n);
  M.HEAPU8[n + OFFSET.humanGender] = HUMAN_GENDER;
  M.HEAPU8[n + OFFSET.computerGender] = COMPUTER_GENDER;
  M.HEAPU8[n + OFFSET.character] = CHARACTER;
  M._pokyd_set_settings(n);
  M._pokyd_set_mood(MOOD);
  M._free(n);
  memory.after_init = M.HEAPU8.length;

  /* Before loading, never during -- pokyd_api.h says why the import is a step of
     its own rather than an argument to the load.  Two copies of the blob exist
     for the length of this block: the caller's and the one in the wasm heap. */
  let import_ms = 0;
  if (cache) {
    const t = now();
    const p = M._malloc(cache.length);
    if (p === 0) throw new Error("out of wasm memory installing the cache");
    M.HEAPU8.set(cache, p);
    if (M._pokyd_import_cache(p, cache.length) !== 0)
      throw new Error("pokyd_import_cache: " + error_of(M));
    M._free(p);
    import_ms = now() - t;
    memory.after_import = M.HEAPU8.length;
  }

  const t0 = now();
  if (M._pokyd_load_dictionaries() !== 0)
    throw new Error("pokyd_load_dictionaries: " + error_of(M));
  const load_ms = now() - t0;
  if (M._pokyd_phase() !== 6 /* POKYD_PHASE_DONE */)
    throw new Error("loaded, but pokyd_phase() says " + M._pokyd_phase());
  memory.after_load = M.HEAPU8.length;

  /* Whatever the host can see of its own memory, asked for here and not after
     the run: this is the moment the dictionary is loaded and nothing has been
     torn down, which is the peak the plan is asking about.  It may await -- a
     browser's measureUserAgentSpecificMemory() waits for a collection -- and
     that is harmless, the load is already timed and nothing runs meanwhile. */
  const host_memory = probe ? await probe(M) : null;

  /* After loading, not before: the cold path reseeds from the clock on its way
     out (SLOVNIK.FU:1732). */
  M._pokyd_seed(SEED);

  const chunks = [];
  const t1 = now();
  for (const sentence of sentences) {
    const p = put_bytes(M, sentence);
    const answer = read_string(M, M._pokyd_say(p));
    M._free(p);
    if (answer === null) throw new Error("pokyd_say returned NULL");
    chunks.push([0x3e, 0x20], sentence, [0x0d, 0x0a], [0x3c, 0x20], answer, [0x0d, 0x0a]);
  }
  const answers_ms = now() - t1;
  memory.after_conversation = M.HEAPU8.length;

  let transcript = [];
  for (const chunk of chunks) transcript.push(...chunk);
  transcript = Uint8Array.from(transcript);

  /* What MEMFS is holding: the two data files and, after a cold load, the 17 MB
     SLOVNIK.TMP.  MEMFS keeps file contents in JS arrays, not in the linear
     memory above, which is exactly why it is worth reporting separately. */
  let memfs = 0;
  for (const name of ["SLOVNIK.IQP", "IQPOKYD.IQP", "SLOVNIK.TMP"]) {
    try { memfs += M.FS.stat("/pokyd/" + name).size; } catch { /* not there */ }
  }

  let exported = null;
  let export_ms = 0;
  if (want_cache) {
    const t = now();
    const p_len = M._malloc(4);
    const block = M._pokyd_export_cache(p_len);
    if (block !== 0) {
      const h = M.HEAPU8;
      const cache_len = h[p_len] | (h[p_len + 1] << 8) | (h[p_len + 2] << 16)
        | (h[p_len + 3] * 0x1000000);
      memory.after_export = M.HEAPU8.length;    /* read before the copy is freed */
      exported = M.HEAPU8.slice(block, block + cache_len);
      M._pokyd_free(block);
    }
    M._free(p_len);
    export_ms = now() - t;
  }

  const sentence_count = M._pokyd_sentence_count();
  const unfreed = M._pokyd_shutdown();
  memory.after_shutdown = M.HEAPU8.length;

  return {
    load_ms, answers_ms, module_ms, import_ms, export_ms,
    memory, memfs, unfreed, sentence_count, host: host_memory,
    transcript_matches: golden === null ? null : same(transcript, golden),
    transcript, cache: exported,
  };
}
