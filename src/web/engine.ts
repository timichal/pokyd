/* IQ Pokyd - src/web/engine.ts - the wasm module, driven from JavaScript.

   Phase 4.2 of PLAN.md.  Everything between a JavaScript string and
   src/api/pokyd_api.h lives here and nowhere else: the malloc/copy/free dance,
   the 220-byte settings struct, the NUL-terminated reads, and the CP1250 codec
   from phase 4.1 applied at every one of them.  Above this file there are only
   strings; below it there are only bytes.

   It is deliberately transport-free.  There is no `self`, no postMessage and no
   DOM in here, so the same class runs in the worker (src/web/worker.ts), in node
   under a test, and -- if it ever has to -- on the main thread.  That is what
   makes test/web/engine.test.ts able to put the golden conversation through the
   real string boundary with nothing but node.

   It owns the ordering rules, which pokyd_api.h states and does not enforce:

       create()          once; it runs pokyd_init
       importCache()     optional, and only before load()
       load()            ~14 s cold in wasm, ~0.2 s warm
       seed()            after load(), never before
       say()             as often as you like
       dictionaryHash()  any time; it is a read of MEMFS, not of the engine
       exportCache()     any time after load()
       shutdown()        once, and only after a load that succeeded

   Three of those are real hazards rather than tidiness.  Seeding before a cold
   load does not survive it -- ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU reseeds
   from the clock on its way out (SLOVNIK.FU:1732) -- and a cache imported after
   the load is 18 MB written to a file nobody will read.  Both would be silent:
   the first gives a different conversation, the second a slow one.  The third
   is not silent at all -- shutting down an engine that never finished loading
   aborts the wasm module outright, for the reason written out at the call.  All
   three throw here, on this side of the boundary, where the message can say why.

   Heap discipline.  HEAPU8 is replaced every time the linear memory grows and
   loading the dictionary grows it several times over, so it is read off the
   module at every single use and never held in a local across a call.  Every
   string that comes back out of the engine is copied immediately: pokyd_say
   hands back g_odpovedpocitace itself, and the next call overwrites it.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

/* One function, and the direction is deliberate: the argument for *which* hash
   belongs next to the thing the hash is a key for, and src/web/cache.ts has no
   top-level side effects and touches IndexedDB only inside its own methods --
   so importing it here costs a node process nothing. */
import { fnv1a64 } from "./cache.ts";
import { decodeCp1250, encodeCp1250, encodeCp1250Z } from "./cp1250.ts";
import type {
  PokydDebugInfo, PokydProgress, PokydSettings,
} from "./protocol.ts";
import { POKYD_PHASE_DONE } from "./protocol.ts";

/* ------------------------------------------------------- the module as it is */

/* What tools/build.py exports, and nothing more -- the EXPORTS list in that file
   is the other half of this interface.  The leading underscore is the C symbol
   as the linker sees it. */
export interface PokydWasm {
  HEAPU8: Uint8Array;
  /* Emscripten's MEMFS, in EXPORTED_RUNTIME_METHODS because tools/build.py
     --embed-file puts the data files in it.  Only dictionaryHash() uses it, and
     only to read; the engine reaches its own files through libc. */
  FS: { readFile(path: string): Uint8Array };
  _malloc(n: number): number;
  _free(ptr: number): void;

  _pokyd_init(dataDir: number): number;
  _pokyd_load_dictionaries(): number;
  _pokyd_shutdown(): number;
  _pokyd_error(): number;

  _pokyd_say(sentence: number): number;
  _pokyd_sentence_count(): number;
  _pokyd_seed(seed: number): void;

  _pokyd_get_settings(out: number): void;
  _pokyd_set_settings(src: number): void;
  _pokyd_set_mood(mood: number): void;
  _pokyd_set_mood_points(points: number): void;
  _pokyd_debug_info(out: number): void;

  _pokyd_progress(): number;
  _pokyd_phase(): number;

  _pokyd_export_cache(len: number): number;
  _pokyd_import_cache(data: number, len: number): number;
  _pokyd_free(block: number): void;
}

/* The default export of build/wasm/pokyd.mjs -- MODULARIZE=1, EXPORT_NAME
   PokydModule.  The options bag is Emscripten's; the two this file passes are
   `stdout` and `stderr`, per-character callbacks that Emscripten invokes
   synchronously from inside whatever C call is doing the writing. */
export type PokydModuleFactory =
  (options?: Record<string, unknown>) => Promise<PokydWasm>;

/* ------------------------------------------------------- the settings struct */

/* struct pokyd_settings, in declaration order.  Every member is a char or an
   array of char, so the layout is a running sum: no padding anywhere and no
   alignment to reason about.  Typed against PokydSettings so a misspelled field
   is a compile error rather than a silently wrong offset. */
const SETTINGS_LAYOUT: ReadonlyArray<readonly [keyof PokydSettings, number]> = [
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

const OFFSET: Partial<Record<keyof PokydSettings, number>> = {};
let layoutSize = 0;
for (const [name, width] of SETTINGS_LAYOUT) {
  OFFSET[name] = layoutSize;
  layoutSize += width;
}

/* Two numbers written down rather than derived, so that adding a field to the
   interface and forgetting the table -- or the other way round -- stops the
   module from loading instead of corrupting every setting at once. */
export const POKYD_SETTINGS_FIELDS = 20;
export const POKYD_SETTINGS_SIZE = 220;
if (SETTINGS_LAYOUT.length !== POKYD_SETTINGS_FIELDS
    || layoutSize !== POKYD_SETTINGS_SIZE) {
  throw new Error("src/web/engine.ts: the settings table is "
    + SETTINGS_LAYOUT.length + " fields and " + layoutSize
    + " bytes, but struct pokyd_settings is " + POKYD_SETTINGS_FIELDS
    + " and " + POKYD_SETTINGS_SIZE);
}

/* ---------------------------------------------------------- the debug struct */

/* struct pokyd_debug, in declaration order and on the same terms as the table
   above: a running sum of widths, with 4 for each of the five counters and the
   array length for each string.  Unlike pokyd_settings this one is *not*
   padding-free -- the counters want four-byte alignment, so the struct's own
   alignment is four and the two trailing bytes are followed by one of padding.
   That affects the size and not a single offset, which is why the size below is
   written down separately rather than derived, and why pokyd_api.cpp carries a
   static_assert on the same number. */
const DEBUG_LAYOUT: ReadonlyArray<readonly [keyof PokydDebugInfo, number]> = [
  ["allocatedBlocks", 4], ["maxWords", 4], ["answerCount", 4],
  ["baseWords", 4], ["rules", 4],
  ["lastAnswer", 201], ["lastSentence", 501],
  ["subject", 201], ["predicate", 201], ["object", 201],
  ["mood", 1], ["moodPoints", 1],
];

const DEBUG_OFFSET: Partial<Record<keyof PokydDebugInfo, number>> = {};
let debugSum = 0;
for (const [name, width] of DEBUG_LAYOUT) {
  DEBUG_OFFSET[name] = debugSum;
  debugSum += width;
}

export const POKYD_DEBUG_FIELDS = 12;
/** sizeof(struct pokyd_debug): the 1327 bytes the table adds up to, rounded up
 *  to the four-byte alignment the counters impose. */
export const POKYD_DEBUG_SIZE = 1328;
if (DEBUG_LAYOUT.length !== POKYD_DEBUG_FIELDS || debugSum !== 1327) {
  throw new Error("src/web/engine.ts: the debug table is "
    + DEBUG_LAYOUT.length + " fields and " + debugSum
    + " bytes, but struct pokyd_debug is " + POKYD_DEBUG_FIELDS + " and 1327");
}

/* What NASTAV_STANDARDNE writes (NASTAVEN.PR:25-43).  Read back through the
   offsets above immediately after pokyd_init, this is a real check of the
   layout against the engine that produced it -- and the one thing that could
   corrupt every setting at once without any other symptom. */
const DEFAULTS: ReadonlyArray<readonly [keyof PokydSettings, number]> = [
  ["humanGender", 1], ["computerGender", 1], ["character", 3], ["mood", 3],
  ["saveConversation", 1], ["useSounds", 1], ["useEffects", 0],
  ["formalCzech", 0], ["showLabels", 1],
  ["debugFastExit", 0], ["debugSpellingTolerance", 1],
  ["debugSpellingRecursion", 11], ["emulateKeyboard", 0],
  ["keyboardQwerty", 1], ["standardCursor", 0],
];

/* --------------------------------------------------------------- the options */

export interface PokydEngineOptions {
  /** The directory pokyd_init() enters.  "/pokyd" is where tools/build.py
   *  embeds SLOVNIK.IQP and IQPOKYD.IQP in MEMFS, and it has to be writable:
   *  the engine opens every data file by bare name in the current directory and
   *  writes the 18 MB SLOVNIK.TMP next to them. */
  dataDir?: string;
  /** Called with whatever the engine writes to its console, decoded from
   *  CP1250, one segment per carriage return.  It fires *during* load(), from
   *  inside the synchronous call, which is the only progress signal a
   *  BEZ_PROSTREDI build produces -- see PROGRESS in src/web/protocol.ts.
   *  Leave it unset and the characters are dropped without being decoded. */
  onOutput?: (text: string) => void;
}

const DEFAULT_DATA_DIR = "/pokyd";

/* How much the engine may write between carriage returns before the segment is
   handed over anyway.  Nothing it prints comes close; this exists so that a
   runaway printf cannot grow a buffer without bound. */
const SEGMENT_LIMIT = 1024;

/* --------------------------------------------------------------- the engine */

/* JMENO_ZAKLADNIHO_SLOVNIKU (src/engine/konstant.k:24) -- the base dictionary,
   the file dictionaryHash() identifies the cache by. */
const DICTIONARY_FILE = "SLOVNIK.IQP";

export class PokydEngine {
  private readonly M: PokydWasm;
  private readonly outputHook: { fn: ((text: string) => void) | null };
  private readonly dataDir: string;
  private cachedHash: string | null = null;
  private loaded = false;
  private closed = false;

  private constructor(M: PokydWasm, hook: { fn: ((text: string) => void) | null },
                      dataDir: string) {
    this.M = M;
    this.outputHook = hook;
    this.dataDir = dataDir;
  }

  /* Instantiate the module, install the output hook, run pokyd_init and check
     the settings layout.  `factory` is the default export of pokyd.mjs; it is
     taken as an argument rather than imported so that this file has no opinion
     about where the build lives -- node passes a file: URL import, the worker
     passes whatever the page told it. */
  static async create(factory: PokydModuleFactory,
                      options: PokydEngineOptions = {}): Promise<PokydEngine> {
    const hook: { fn: ((text: string) => void) | null } =
      { fn: options.onOutput ?? null };

    /* Segmentation.  CR, LF and BS all mean the same thing here -- the engine is
       about to overwrite the line it just wrote -- so each of them ends a
       segment, and none of them appears in one.  Empty segments are dropped, so
       the five backspaces the base-dictionary reader emits before every
       percentage cost nothing. */
    const buffer = new Uint8Array(SEGMENT_LIMIT);
    let len = 0;
    const flush = (): void => {
      if (len === 0) return;
      const text = decodeCp1250(buffer.subarray(0, len));
      len = 0;
      const fn = hook.fn;
      if (fn) fn(text);
    };
    const putChar = (c: number | null): void => {
      /* 2.7 million calls over a cold load, so the cheapest possible early-out
         when nobody is listening. */
      if (hook.fn === null) return;
      if (c === null || c === 0 || c === 13 || c === 10 || c === 8) {
        flush();
        return;
      }
      if (len === buffer.length) flush();
      buffer[len++] = c & 0xff;
    };

    /* print/printErr as well as stdout/stderr: the first pair is Emscripten's
       line-buffered path and would never fire here, since the inflection bar
       writes no newlines for fourteen seconds, but silencing it means an
       unhooked engine cannot flood a console by accident. */
    const M = await factory({
      stdout: putChar, stderr: putChar,
      print: () => { /* superseded by stdout */ },
      printErr: () => { /* superseded by stderr */ },
    });

    const dataDir = options.dataDir ?? DEFAULT_DATA_DIR;
    const engine = new PokydEngine(M, hook, dataDir);
    const p = engine.store(encodeCp1250Z(dataDir));
    try {
      if (M._pokyd_init(p) !== 0) {
        throw new Error("pokyd_init(" + JSON.stringify(dataDir) + "): "
          + engine.errorText());
      }
    } finally {
      M._free(p);
    }
    engine.checkLayout();
    return engine;
  }

  /* The module itself, for a test that needs MEMFS or a memory reading.  Nothing
     in the normal path should want it. */
  get wasm(): PokydWasm { return this.M; }

  /* Swap the output listener out at runtime.  Setting it to null is not just
     tidiness: the per-character hook returns immediately when there is no
     listener, so an engine nobody is watching decodes nothing at all -- which
     matters, because vstup.fu:801-809 prints every base form it recognises on
     every sentence. */
  set onOutput(fn: ((text: string) => void) | null) { this.outputHook.fn = fn; }
  get onOutput(): ((text: string) => void) | null { return this.outputHook.fn; }

  /* ------------------------------------------------------------ life cycle */

  /* SLOVNIK.TMP, installed before the load looks for it.  After load() this
     would write 18 MB that nothing will ever read, so it throws instead. */
  importCache(blob: Uint8Array): void {
    this.requireAlive("importCache");
    this.require(!this.loaded,
      "importCache: the dictionary is already loaded, so the cache would not be read");
    if (blob.length === 0) throw new Error("importCache: the blob is empty");
    const p = this.M._malloc(blob.length);
    if (p === 0) throw new Error("importCache: out of wasm memory for "
      + blob.length + " bytes");
    try {
      this.M.HEAPU8.set(blob, p);
      if (this.M._pokyd_import_cache(p, blob.length) !== 0) {
        throw new Error("pokyd_import_cache: " + this.errorText());
      }
    } finally {
      this.M._free(p);
    }
  }

  load(): void {
    this.requireAlive("load");
    this.require(!this.loaded, "load: already loaded");
    if (this.M._pokyd_load_dictionaries() !== 0) {
      throw new Error("pokyd_load_dictionaries: " + this.errorText());
    }
    const phase = this.M._pokyd_phase();
    if (phase !== POKYD_PHASE_DONE) {
      throw new Error("pokyd_load_dictionaries succeeded but pokyd_phase() is "
        + phase + ", expected " + POKYD_PHASE_DONE);
    }
    this.loaded = true;
  }

  /* Blocks the engine did not account for; it should be 0.  Nothing works after
     this, and calling it twice is an error rather than a second teardown.

     It also refuses to run before a successful load(), and that is not
     fastidiousness -- it is fatal.  UVOLNI_VESKEROU_DYNAMICKOU_PAMET walks
     g_vetacloveka calling Typ_slova::VYMAZ_OBSAH (INTELIG.FT:54), which frees
     some twenty pointers unconditionally, and UVOLNI_X(NULL) is a fatal error
     by design (SKLONOV.FU:1348).  Those pointers are allocated while the base
     dictionary is read, so on an engine that never loaded they are all NULL and
     the call aborts the whole wasm module.  A load that never happened has
     nothing to tear down anyway: drop the instance, or terminate the worker. */
  shutdown(): number {
    this.requireAlive("shutdown");
    this.require(this.loaded,
      "shutdown: the dictionary was never loaded, and tearing down a half-built"
      + " engine aborts it (UVOLNI_X(NULL) is fatal -- SKLONOV.FU:1348)."
      + "  Drop the instance instead, or terminate the worker.");
    this.closed = true;
    this.loaded = false;
    this.outputHook.fn = null;
    return this.M._pokyd_shutdown() >>> 0;
  }

  get isLoaded(): boolean { return this.loaded; }

  /* --------------------------------------------------------- conversation */

  /* One sentence in, one answer out.  The string is CP1250 on the way in and on
     the way out, and the codec is the only thing between the two -- which is
     what test/web/engine.test.ts proves against the golden transcript. */
  say(text: string): string {
    this.requireAlive("say");
    this.require(this.loaded, "say: the dictionary is not loaded");
    const p = this.store(encodeCp1250Z(text));
    try {
      const q = this.M._pokyd_say(p);
      if (q === 0) throw new Error("pokyd_say returned NULL: " + this.errorText());
      return decodeCp1250(this.readBytes(q));
    } finally {
      this.M._free(p);
    }
  }

  /* g_pocetrecenychvet.  Rules test it, so it is conversation state and not a
     statistic. */
  sentenceCount(): number {
    this.requireAlive("sentenceCount");
    return this.M._pokyd_sentence_count() >>> 0;
  }

  /* srand(), and it belongs after load(): the cold path reseeds from the clock
     on its way out (SLOVNIK.FU:1732), so a seed set before it does not survive.
     Same seed, same conversation, on any toolchain -- src/shim/nahoda.h is what
     makes that true, and test/golden/ is what checks it. */
  seed(value: number): void {
    this.requireAlive("seed");
    this.require(this.loaded,
      "seed: seeding before load() does not survive a cold start (SLOVNIK.FU:1732)");
    this.M._pokyd_seed(value >>> 0);
  }

  /* ------------------------------------------------------------- settings */

  getSettings(): PokydSettings {
    this.requireAlive("getSettings");
    const p = this.M._malloc(POKYD_SETTINGS_SIZE);
    if (p === 0) throw new Error("getSettings: out of wasm memory");
    try {
      this.M._pokyd_get_settings(p);
      return this.readSettings(p);
    } finally {
      this.M._free(p);
    }
  }

  /* Copies every field verbatim, moodPoints included.  To change the mood rather
     than restore a saved one, use setMood: mood is recomputed from moodPoints
     after every sentence (INTELIG.FU:1047), so writing it here alone is undone. */
  setSettings(settings: PokydSettings): void {
    this.requireAlive("setSettings");
    const p = this.M._malloc(POKYD_SETTINGS_SIZE);
    if (p === 0) throw new Error("setSettings: out of wasm memory");
    try {
      this.writeSettings(p, settings);
      this.M._pokyd_set_settings(p);
    } finally {
      this.M._free(p);
    }
  }

  /* mood 1..5, with moodPoints recomputed from it -- Nastaveni.cpp:167.  The
     engine ignores anything outside 1..5; this says so instead. */
  setMood(mood: number): void {
    this.requireAlive("setMood");
    if (!Number.isInteger(mood) || mood < 1 || mood > 5) {
      throw new RangeError("setMood: mood is 1..5, got " + mood);
    }
    this.M._pokyd_set_mood(mood);
  }

  /* naladabody 0..90, with mood recomputed from it -- the direction
   CDebugNastaveni::OnOK takes (debugnastaveni.cpp:220-224).  His own dialog
   refuses anything outside 0..90 with a MessageBox; this throws, and
   src/app/debug.ts says the same thing in his words before it ever gets here. */
  setMoodPoints(points: number): void {
    this.requireAlive("setMoodPoints");
    if (!Number.isInteger(points) || points < 0 || points > 90) {
      throw new RangeError("setMoodPoints: naladabody is 0..90, got " + points);
    }
    this.M._pokyd_set_mood_points(points);
  }

  /* ---------------------------------------------------------- debug info */

  /* The ten globals IDD_DEBUGNASTAVENI showed, in one snapshot.  Safe before a
     load, which matters: Ctrl+Shift+Alt+D works while the dictionary is still
     inflecting, and it did in 2005 too. */
  debugInfo(): PokydDebugInfo {
    this.requireAlive("debugInfo");
    const p = this.M._malloc(POKYD_DEBUG_SIZE);
    if (p === 0) throw new Error("debugInfo: out of wasm memory");
    try {
      this.M._pokyd_debug_info(p);
      return this.readDebug(p);
    } finally {
      this.M._free(p);
    }
  }

  /* ------------------------------------------------------------- progress */

  /* g_praveprovadenaakce and g_procentanacitani.  Read this from an output
     callback if you want it during a load -- see PROGRESS in protocol.ts for
     why the percentage is flat through the step that takes the time. */
  progress(): PokydProgress {
    this.requireAlive("progress");
    return { phase: this.M._pokyd_phase(), percent: this.M._pokyd_progress() };
  }

  /* ---------------------------------------------------------------- cache */

  /* SLOVNIK.TMP as bytes, or null when there is none -- which is normal before a
     cold load has written one, and always under cmdReadOnly.  The copy
     handed back is ours; the engine's is freed here. */
  exportCache(): Uint8Array | null {
    this.requireAlive("exportCache");
    const pLen = this.M._malloc(4);
    if (pLen === 0) throw new Error("exportCache: out of wasm memory");
    try {
      const block = this.M._pokyd_export_cache(pLen);
      if (block === 0) return null;
      try {
        /* unsigned long * is 32 bits little endian on wasm32.  Read off HEAPU8
           rather than HEAPU32 so the module needs only the one view exported. */
        const h = this.M.HEAPU8;
        const n = h[pLen] | (h[pLen + 1] << 8) | (h[pLen + 2] << 16)
          | (h[pLen + 3] * 0x1000000);
        return this.M.HEAPU8.slice(block, block + n);
      } finally {
        this.M._pokyd_free(block);
      }
    } finally {
      this.M._free(pLen);
    }
  }

  /* Which dictionary this engine is holding, as sixteen hex digits -- phase
     4.4's cache key, and the only thing that can tell a stored SLOVNIK.TMP from
     one inflected out of a different SLOVNIK.IQP.  The engine cannot: it
     checksums the cache and rejects a damaged one, but a *wrong* one checksums
     perfectly well and it would answer out of it all session (pokyd_api.h, at
     pokyd_export_cache).

     Read out of MEMFS rather than taken on trust, because that is the copy the
     engine will actually inflect: tools/build.py embeds the file into pokyd.wasm
     with --embed-file, so there is no separately served dictionary for a page to
     hash instead.  Available from create() onwards -- the file is in MEMFS before
     the module resolves -- and the answer is cached because it cannot change
     while the module lives. */
  dictionaryHash(): string {
    this.requireAlive("dictionaryHash");
    if (this.cachedHash !== null) return this.cachedHash;
    const path = this.dataDir.replace(/\/+$/, "") + "/" + DICTIONARY_FILE;
    let bytes: Uint8Array;
    try {
      bytes = this.M.FS.readFile(path);
    } catch (e) {
      throw new Error("dictionaryHash: cannot read " + path + " out of MEMFS ("
        + (e instanceof Error ? e.message : String(e))
        + ") -- tools/build.py embeds it there with --embed-file");
    }
    if (bytes.length === 0) {
      throw new Error("dictionaryHash: " + path + " is empty");
    }
    this.cachedHash = fnv1a64(bytes);
    return this.cachedHash;
  }

  /* ------------------------------------------------------------- internals */

  private store(bytes: Uint8Array): number {
    const p = this.M._malloc(bytes.length);
    if (p === 0) throw new Error("out of wasm memory for " + bytes.length + " bytes");
    this.M.HEAPU8.set(bytes, p);
    return p;
  }

  /* A NUL-terminated string out of the heap, copied: the engine's own buffer is
     overwritten by the next call, and the heap underneath it can move. */
  private readBytes(p: number): Uint8Array {
    const heap = this.M.HEAPU8;
    let end = p;
    while (heap[end] !== 0) end++;
    return heap.slice(p, end);
  }

  private errorText(): string {
    const p = this.M._pokyd_error();
    return p === 0 ? "(no message)" : decodeCp1250(this.readBytes(p));
  }

  private require(cond: boolean, message: string): void {
    if (!cond) throw new Error(message);
  }

  private requireAlive(what: string): void {
    if (this.closed) {
      throw new Error(what + ": the engine has been shut down");
    }
  }

  private readSettings(p: number): PokydSettings {
    const h = this.M.HEAPU8;
    const out: Record<string, number | string> = {};
    for (const [name, width] of SETTINGS_LAYOUT) {
      const at = p + (OFFSET[name] as number);
      out[name] = width === 1 ? h[at] : decodeCp1250(this.readBytes(at));
    }
    return out as unknown as PokydSettings;
  }

  /* The counters are little-endian unsigned 32-bit -- wasm is little-endian and
     pokyd_api.h made them `unsigned int` precisely so the width does not follow
     the data model.  Read byte by byte off HEAPU8 rather than through a
     DataView, because the heap is replaced whenever the memory grows. */
  private readDebug(p: number): PokydDebugInfo {
    const h = this.M.HEAPU8;
    const out: Record<string, number | string> = {};
    for (const [name, width] of DEBUG_LAYOUT) {
      const at = p + (DEBUG_OFFSET[name] as number);
      if (width === 1) { out[name] = h[at]; continue; }
      if (width === 4) {
        out[name] = (h[at] | (h[at + 1] << 8) | (h[at + 2] << 16)
          | (h[at + 3] << 24)) >>> 0;
        continue;
      }
      out[name] = decodeCp1250(this.readBytes(at));
    }
    return out as unknown as PokydDebugInfo;
  }

  private writeSettings(p: number, settings: PokydSettings): void {
    const h = this.M.HEAPU8;
    /* The whole struct, not just the fields that changed: pokyd_set_settings
       copies all 220 bytes, so anything left over from a previous malloc would
       go straight into the engine. */
    h.fill(0, p, p + POKYD_SETTINGS_SIZE);
    for (const [name, width] of SETTINGS_LAYOUT) {
      const at = p + (OFFSET[name] as number);
      const value = settings[name];
      if (width === 1) {
        h[at] = (value as number) & 0xff;
        continue;
      }
      /* char[101], so 100 bytes and a terminator.  Truncating on a byte count
         rather than a character count is the right thing for a C array, and
         CP1250 gives one byte per character, so the two agree anyway. */
      const bytes = encodeCp1250(String(value));
      const n = Math.min(bytes.length, width - 1);
      h.set(bytes.subarray(0, n), at);
      h[at + n] = 0;
    }
  }

  private checkLayout(): void {
    /* NASTAV_STANDARDNE has just run inside pokyd_init, so what it wrote is
       known.  Reading those defaults back through the offsets above is a real
       check of the table against the engine, and it costs one malloc. */
    const p = this.M._malloc(POKYD_SETTINGS_SIZE);
    if (p === 0) throw new Error("out of wasm memory checking the settings layout");
    try {
      this.M._pokyd_get_settings(p);
      const h = this.M.HEAPU8;
      for (const [name, expected] of DEFAULTS) {
        const got = h[p + (OFFSET[name] as number)];
        if (got !== expected) {
          throw new Error("struct pokyd_settings does not match pokyd_api.h -- "
            + name + " reads " + got + ", NASTAV_STANDARDNE wrote " + expected);
        }
      }
      if (h[p + (OFFSET.humanName as number)] !== 0
          || h[p + (OFFSET.computerName as number)] !== 0) {
        throw new Error("struct pokyd_settings: the name fields are not where"
          + " pokyd_api.h says they are");
      }
    } finally {
      this.M._free(p);
    }
  }
}
