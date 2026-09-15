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

import { decodeCp1250, encodeCp1250, encodeCp1250Z } from "./cp1250.ts";
import type { PokydProgress, PokydSettings } from "./protocol.ts";
import { POKYD_PHASE_DONE } from "./protocol.ts";

/* ------------------------------------------------------- the module as it is */

/* What tools/build.py exports, and nothing more -- the EXPORTY list in that file
   is the other half of this interface.  The leading underscore is the C symbol
   as the linker sees it. */
export interface PokydWasm {
  HEAPU8: Uint8Array;
  _malloc(bajtu: number): number;
  _free(ukazatel: number): void;

  _pokyd_init(adresar: number): number;
  _pokyd_load_dictionaries(): number;
  _pokyd_shutdown(): number;
  _pokyd_error(): number;

  _pokyd_say(veta: number): number;
  _pokyd_sentence_count(): number;
  _pokyd_seed(semeno: number): void;

  _pokyd_get_settings(ven: number): void;
  _pokyd_set_settings(sem: number): void;
  _pokyd_set_mood(nalada: number): void;

  _pokyd_progress(): number;
  _pokyd_phase(): number;

  _pokyd_export_cache(delka: number): number;
  _pokyd_import_cache(data: number, delka: number): number;
  _pokyd_free(blok: number): void;
}

/* The default export of build/wasm/pokyd.mjs -- MODULARIZE=1, EXPORT_NAME
   PokydModule.  The options bag is Emscripten's; the two this file passes are
   `stdout` and `stderr`, per-character callbacks that Emscripten invokes
   synchronously from inside whatever C call is doing the writing. */
export type PokydModuleFactory =
  (volby?: Record<string, unknown>) => Promise<PokydWasm>;

/* ------------------------------------------------------- the settings struct */

/* struct pokyd_settings, in declaration order.  Every member is a char or an
   array of char, so the layout is a running sum: no padding anywhere and no
   alignment to reason about.  Typed against PokydSettings so a misspelled field
   is a compile error rather than a silently wrong offset. */
const POLE_NASTAVENI: ReadonlyArray<readonly [keyof PokydSettings, number]> = [
  ["pohlavicloveka", 1], ["pohlavipocitace", 1],
  ["jmenocloveka", 101], ["jmenopocitace", 101],
  ["charakter", 1], ["nalada", 1], ["naladabody", 1],
  ["ukladatrozhovor", 1], ["pouzivatzvuky", 1], ["pouzivatefekty", 1],
  ["spisovnacestina", 1], ["zobrazovatpopisky", 1],
  ["debug_rychleukoncovani", 1], ["debug_tolerancepravopisu", 1],
  ["debug_pravopisnarekurze", 1],
  ["emulovatklavesnici", 1], ["klavesniceqwerty", 1], ["standardnikurzor", 1],
  ["prikaz_readonlymod", 1], ["prikaz_nezobrazovatpozadi", 1],
];

const POSUN: Partial<Record<keyof PokydSettings, number>> = {};
let VELIKOST_NASTAVENI = 0;
for (const [jmeno, sirka] of POLE_NASTAVENI) {
  POSUN[jmeno] = VELIKOST_NASTAVENI;
  VELIKOST_NASTAVENI += sirka;
}

/* Two numbers written down rather than derived, so that adding a field to the
   interface and forgetting the table -- or the other way round -- stops the
   module from loading instead of corrupting every setting at once. */
export const POKYD_SETTINGS_FIELDS = 20;
export const POKYD_SETTINGS_SIZE = 220;
if (POLE_NASTAVENI.length !== POKYD_SETTINGS_FIELDS
    || VELIKOST_NASTAVENI !== POKYD_SETTINGS_SIZE) {
  throw new Error("src/web/engine.ts: the settings table is "
    + POLE_NASTAVENI.length + " fields and " + VELIKOST_NASTAVENI
    + " bytes, but struct pokyd_settings is " + POKYD_SETTINGS_FIELDS
    + " and " + POKYD_SETTINGS_SIZE);
}

/* What NASTAV_STANDARDNE writes (NASTAVEN.PR:25-43).  Read back through the
   offsets above immediately after pokyd_init, this is a real check of the
   layout against the engine that produced it -- and the one thing that could
   corrupt every setting at once without any other symptom. */
const STANDARDNE: ReadonlyArray<readonly [keyof PokydSettings, number]> = [
  ["pohlavicloveka", 1], ["pohlavipocitace", 1], ["charakter", 3], ["nalada", 3],
  ["ukladatrozhovor", 1], ["pouzivatzvuky", 1], ["pouzivatefekty", 0],
  ["spisovnacestina", 0], ["zobrazovatpopisky", 1],
  ["debug_rychleukoncovani", 0], ["debug_tolerancepravopisu", 1],
  ["debug_pravopisnarekurze", 11], ["emulovatklavesnici", 0],
  ["klavesniceqwerty", 1], ["standardnikurzor", 0],
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

const VYCHOZI_ADRESAR = "/pokyd";

/* How much the engine may write between carriage returns before the segment is
   handed over anyway.  Nothing it prints comes close; this exists so that a
   runaway printf cannot grow a buffer without bound. */
const DELKA_SEGMENTU = 1024;

/* --------------------------------------------------------------- the engine */

export class PokydEngine {
  private readonly M: PokydWasm;
  private readonly drzakVystupu: { fn: ((text: string) => void) | null };
  private nacteno = false;
  private ukonceno = false;

  private constructor(M: PokydWasm, drzak: { fn: ((text: string) => void) | null }) {
    this.M = M;
    this.drzakVystupu = drzak;
  }

  /* Instantiate the module, install the output hook, run pokyd_init and check
     the settings layout.  `factory` is the default export of pokyd.mjs; it is
     taken as an argument rather than imported so that this file has no opinion
     about where the build lives -- node passes a file: URL import, the worker
     passes whatever the page told it. */
  static async create(factory: PokydModuleFactory,
                      volby: PokydEngineOptions = {}): Promise<PokydEngine> {
    const drzak: { fn: ((text: string) => void) | null } =
      { fn: volby.onOutput ?? null };

    /* Segmentation.  CR, LF and BS all mean the same thing here -- the engine is
       about to overwrite the line it just wrote -- so each of them ends a
       segment, and none of them appears in one.  Empty segments are dropped, so
       the five backspaces the base-dictionary reader emits before every
       percentage cost nothing. */
    const zasobnik = new Uint8Array(DELKA_SEGMENTU);
    let delka = 0;
    const vyprazdni = (): void => {
      if (delka === 0) return;
      const text = decodeCp1250(zasobnik.subarray(0, delka));
      delka = 0;
      const fn = drzak.fn;
      if (fn) fn(text);
    };
    const znak = (c: number | null): void => {
      /* 2.7 million calls over a cold load, so the cheapest possible early-out
         when nobody is listening. */
      if (drzak.fn === null) return;
      if (c === null || c === 0 || c === 13 || c === 10 || c === 8) {
        vyprazdni();
        return;
      }
      if (delka === zasobnik.length) vyprazdni();
      zasobnik[delka++] = c & 0xff;
    };

    /* print/printErr as well as stdout/stderr: the first pair is Emscripten's
       line-buffered path and would never fire here, since the inflection bar
       writes no newlines for fourteen seconds, but silencing it means an
       unhooked engine cannot flood a console by accident. */
    const M = await factory({
      stdout: znak, stderr: znak,
      print: () => { /* superseded by stdout */ },
      printErr: () => { /* superseded by stderr */ },
    });

    const motor = new PokydEngine(M, drzak);
    const adresar = volby.dataDir ?? VYCHOZI_ADRESAR;
    const p = motor.uloz(encodeCp1250Z(adresar));
    try {
      if (M._pokyd_init(p) !== 0) {
        throw new Error("pokyd_init(" + JSON.stringify(adresar) + "): "
          + motor.chyba());
      }
    } finally {
      M._free(p);
    }
    motor.zkontrolujRozlozeni();
    return motor;
  }

  /* The module itself, for a test that needs MEMFS or a memory reading.  Nothing
     in the normal path should want it. */
  get wasm(): PokydWasm { return this.M; }

  /* Swap the output listener out at runtime.  Setting it to null is not just
     tidiness: the per-character hook returns immediately when there is no
     listener, so an engine nobody is watching decodes nothing at all -- which
     matters, because vstup.fu:801-809 prints every base form it recognises on
     every sentence. */
  set onOutput(fn: ((text: string) => void) | null) { this.drzakVystupu.fn = fn; }
  get onOutput(): ((text: string) => void) | null { return this.drzakVystupu.fn; }

  /* ------------------------------------------------------------ life cycle */

  /* SLOVNIK.TMP, installed before the load looks for it.  After load() this
     would write 18 MB that nothing will ever read, so it throws instead. */
  importCache(blob: Uint8Array): void {
    this.vyzadujZivy("importCache");
    this.vyzaduj(!this.nacteno,
      "importCache: the dictionary is already loaded, so the cache would not be read");
    if (blob.length === 0) throw new Error("importCache: the blob is empty");
    const p = this.M._malloc(blob.length);
    if (p === 0) throw new Error("importCache: out of wasm memory for "
      + blob.length + " bytes");
    try {
      this.M.HEAPU8.set(blob, p);
      if (this.M._pokyd_import_cache(p, blob.length) !== 0) {
        throw new Error("pokyd_import_cache: " + this.chyba());
      }
    } finally {
      this.M._free(p);
    }
  }

  load(): void {
    this.vyzadujZivy("load");
    this.vyzaduj(!this.nacteno, "load: already loaded");
    if (this.M._pokyd_load_dictionaries() !== 0) {
      throw new Error("pokyd_load_dictionaries: " + this.chyba());
    }
    const faze = this.M._pokyd_phase();
    if (faze !== POKYD_PHASE_DONE) {
      throw new Error("pokyd_load_dictionaries succeeded but pokyd_phase() is "
        + faze + ", expected " + POKYD_PHASE_DONE);
    }
    this.nacteno = true;
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
    this.vyzadujZivy("shutdown");
    this.vyzaduj(this.nacteno,
      "shutdown: the dictionary was never loaded, and tearing down a half-built"
      + " engine aborts it (UVOLNI_X(NULL) is fatal -- SKLONOV.FU:1348)."
      + "  Drop the instance instead, or terminate the worker.");
    this.ukonceno = true;
    this.nacteno = false;
    this.drzakVystupu.fn = null;
    return this.M._pokyd_shutdown() >>> 0;
  }

  get isLoaded(): boolean { return this.nacteno; }

  /* --------------------------------------------------------- conversation */

  /* One sentence in, one answer out.  The string is CP1250 on the way in and on
     the way out, and the codec is the only thing between the two -- which is
     what test/web/engine.test.ts proves against the golden transcript. */
  say(text: string): string {
    this.vyzadujZivy("say");
    this.vyzaduj(this.nacteno, "say: the dictionary is not loaded");
    const p = this.uloz(encodeCp1250Z(text));
    try {
      const q = this.M._pokyd_say(p);
      if (q === 0) throw new Error("pokyd_say returned NULL: " + this.chyba());
      return decodeCp1250(this.nactiBajty(q));
    } finally {
      this.M._free(p);
    }
  }

  /* g_pocetrecenychvet.  Rules test it, so it is conversation state and not a
     statistic. */
  sentenceCount(): number {
    this.vyzadujZivy("sentenceCount");
    return this.M._pokyd_sentence_count() >>> 0;
  }

  /* srand(), and it belongs after load(): the cold path reseeds from the clock
     on its way out (SLOVNIK.FU:1732), so a seed set before it does not survive.
     Same seed, same conversation, on any toolchain -- src/shim/nahoda.h is what
     makes that true, and test/golden/ is what checks it. */
  seed(value: number): void {
    this.vyzadujZivy("seed");
    this.vyzaduj(this.nacteno,
      "seed: seeding before load() does not survive a cold start (SLOVNIK.FU:1732)");
    this.M._pokyd_seed(value >>> 0);
  }

  /* ------------------------------------------------------------- settings */

  getSettings(): PokydSettings {
    this.vyzadujZivy("getSettings");
    const p = this.M._malloc(POKYD_SETTINGS_SIZE);
    if (p === 0) throw new Error("getSettings: out of wasm memory");
    try {
      this.M._pokyd_get_settings(p);
      return this.prectiNastaveni(p);
    } finally {
      this.M._free(p);
    }
  }

  /* Copies every field verbatim, naladabody included.  To change the mood rather
     than restore a saved one, use setMood: nalada is recomputed from naladabody
     after every sentence (INTELIG.FU:1047), so writing it here alone is undone. */
  setSettings(nastaveni: PokydSettings): void {
    this.vyzadujZivy("setSettings");
    const p = this.M._malloc(POKYD_SETTINGS_SIZE);
    if (p === 0) throw new Error("setSettings: out of wasm memory");
    try {
      this.zapisNastaveni(p, nastaveni);
      this.M._pokyd_set_settings(p);
    } finally {
      this.M._free(p);
    }
  }

  /* nalada 1..5, with naladabody recomputed from it -- Nastaveni.cpp:167.  The
     engine ignores anything outside 1..5; this says so instead. */
  setMood(nalada: number): void {
    this.vyzadujZivy("setMood");
    if (!Number.isInteger(nalada) || nalada < 1 || nalada > 5) {
      throw new RangeError("setMood: nalada is 1..5, got " + nalada);
    }
    this.M._pokyd_set_mood(nalada);
  }

  /* ------------------------------------------------------------- progress */

  /* g_praveprovadenaakce and g_procentanacitani.  Read this from an output
     callback if you want it during a load -- see PROGRESS in protocol.ts for
     why the percentage is flat through the step that takes the time. */
  progress(): PokydProgress {
    this.vyzadujZivy("progress");
    return { phase: this.M._pokyd_phase(), percent: this.M._pokyd_progress() };
  }

  /* ---------------------------------------------------------------- cache */

  /* SLOVNIK.TMP as bytes, or null when there is none -- which is normal before a
     cold load has written one, and always under prikaz_readonlymod.  The copy
     handed back is ours; the engine's is freed here. */
  exportCache(): Uint8Array | null {
    this.vyzadujZivy("exportCache");
    const pDelka = this.M._malloc(4);
    if (pDelka === 0) throw new Error("exportCache: out of wasm memory");
    try {
      const blok = this.M._pokyd_export_cache(pDelka);
      if (blok === 0) return null;
      try {
        /* unsigned long * is 32 bits little endian on wasm32.  Read off HEAPU8
           rather than HEAPU32 so the module needs only the one view exported. */
        const h = this.M.HEAPU8;
        const kolik = h[pDelka] | (h[pDelka + 1] << 8) | (h[pDelka + 2] << 16)
          | (h[pDelka + 3] * 0x1000000);
        return this.M.HEAPU8.slice(blok, blok + kolik);
      } finally {
        this.M._pokyd_free(blok);
      }
    } finally {
      this.M._free(pDelka);
    }
  }

  /* ------------------------------------------------------------- internals */

  private uloz(bajty: Uint8Array): number {
    const p = this.M._malloc(bajty.length);
    if (p === 0) throw new Error("out of wasm memory for " + bajty.length + " bytes");
    this.M.HEAPU8.set(bajty, p);
    return p;
  }

  /* A NUL-terminated string out of the heap, copied: the engine's own buffer is
     overwritten by the next call, and the heap underneath it can move. */
  private nactiBajty(p: number): Uint8Array {
    const halda = this.M.HEAPU8;
    let konec = p;
    while (halda[konec] !== 0) konec++;
    return halda.slice(p, konec);
  }

  private chyba(): string {
    const p = this.M._pokyd_error();
    return p === 0 ? "(no message)" : decodeCp1250(this.nactiBajty(p));
  }

  private vyzaduj(podminka: boolean, zprava: string): void {
    if (!podminka) throw new Error(zprava);
  }

  private vyzadujZivy(co: string): void {
    if (this.ukonceno) {
      throw new Error(co + ": the engine has been shut down");
    }
  }

  private prectiNastaveni(p: number): PokydSettings {
    const h = this.M.HEAPU8;
    const ven: Record<string, number | string> = {};
    for (const [jmeno, sirka] of POLE_NASTAVENI) {
      const kde = p + (POSUN[jmeno] as number);
      ven[jmeno] = sirka === 1 ? h[kde] : decodeCp1250(this.nactiBajty(kde));
    }
    return ven as unknown as PokydSettings;
  }

  private zapisNastaveni(p: number, nastaveni: PokydSettings): void {
    const h = this.M.HEAPU8;
    /* The whole struct, not just the fields that changed: pokyd_set_settings
       copies all 220 bytes, so anything left over from a previous malloc would
       go straight into the engine. */
    h.fill(0, p, p + POKYD_SETTINGS_SIZE);
    for (const [jmeno, sirka] of POLE_NASTAVENI) {
      const kde = p + (POSUN[jmeno] as number);
      const hodnota = nastaveni[jmeno];
      if (sirka === 1) {
        h[kde] = (hodnota as number) & 0xff;
        continue;
      }
      /* char[101], so 100 bytes and a terminator.  Truncating on a byte count
         rather than a character count is the right thing for a C array, and
         CP1250 gives one byte per character, so the two agree anyway. */
      const bajty = encodeCp1250(String(hodnota));
      const kolik = Math.min(bajty.length, sirka - 1);
      h.set(bajty.subarray(0, kolik), kde);
      h[kde + kolik] = 0;
    }
  }

  private zkontrolujRozlozeni(): void {
    /* NASTAV_STANDARDNE has just run inside pokyd_init, so what it wrote is
       known.  Reading those defaults back through the offsets above is a real
       check of the table against the engine, and it costs one malloc. */
    const p = this.M._malloc(POKYD_SETTINGS_SIZE);
    if (p === 0) throw new Error("out of wasm memory checking the settings layout");
    try {
      this.M._pokyd_get_settings(p);
      const h = this.M.HEAPU8;
      for (const [jmeno, ocekavano] of STANDARDNE) {
        const mame = h[p + (POSUN[jmeno] as number)];
        if (mame !== ocekavano) {
          throw new Error("struct pokyd_settings does not match pokyd_api.h -- "
            + jmeno + " reads " + mame + ", NASTAV_STANDARDNE wrote " + ocekavano);
        }
      }
      if (h[p + (POSUN.jmenocloveka as number)] !== 0
          || h[p + (POSUN.jmenopocitace as number)] !== 0) {
        throw new Error("struct pokyd_settings: the name fields are not where"
          + " pokyd_api.h says they are");
      }
    } finally {
      this.M._free(p);
    }
  }
}
