/* IQ Pokyd - src/web/client.ts - the page's half of the worker boundary.

   Phase 4.2 of PLAN.md.  src/web/worker.ts runs the engine; this turns its
   message protocol back into something a page can call and await.  One method
   per request, an id on every call so replies cannot be mixed up, and the
   ordering rules of src/api/pokyd_api.h expressed once, in start(), so that no
   caller has to remember them.

   What it is not: it is not a place for policy.  It does not decide what a
   loading screen looks like (phase 4.3), it does not know about IndexedDB
   (src/web/cache.ts does, and startCached() there is start() with the cache in
   it) and it holds no conversation state of its own -- the engine's
   settings and sentence count are the truth, and they are one await away.  The
   one convenience it does offer is start(), because getting init/import/load/
   seed out of order is silent rather than loud: a seed set before a cold load
   does not survive it, and a cache imported after one is never read.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

import type {
  PokydCall,
  PokydProgress,
  PokydReply,
  PokydRequest,
  PokydRequestType,
  PokydResultOf,
  PokydSettings,
} from "./protocol.ts";

export interface PokydClientOptions {
  /** Where src/web/worker.ts is served from.  It is started as a module worker,
   *  so whatever builds the page has to keep it a module. */
  workerUrl: string | URL;
  /** Where build/wasm/pokyd.mjs is served from.  The worker imports it by this
   *  URL at init; it is not baked in, because the answer differs between the
   *  static test server and the phase 5.1 Vite build. */
  moduleUrl: string | URL;
  /** The directory pokyd_init() enters inside MEMFS.  tools/build.py embeds the
   *  data files at /pokyd/, which is the default and almost certainly right. */
  dataDir?: string;
  /** Everything the engine writes to its console, decoded from CP1250 and
   *  throttled by the worker.  This is the loading progress -- see PROGRESS in
   *  src/web/protocol.ts for why it arrives as text. */
  onOutput?: (text: string, progress: PokydProgress) => void;
}

/** What start() does, in the order pokyd_api.h requires. */
export interface PokydStartOptions {
  /** A SLOVNIK.TMP blob from a previous visit.  Turns a fourteen-second cold
   *  load into a fifth of a second; phase 4.4 is what keeps one. */
  cache?: Uint8Array;
  /** Hand the cache's buffer to the worker instead of copying it.  Cheaper by
   *  18 MB, and it detaches the caller's view -- so only pass true if this is
   *  the last thing you were going to do with the blob. */
  transferCache?: boolean;
  settings?: PokydSettings;
  /** nalada 1..5, applied through pokyd_set_mood rather than through settings,
   *  because writing nalada alone is undone after the next sentence. */
  mood?: number;
  /** srand(), applied after the load, which is the only place it survives. */
  seed?: number;
}

const VYCHOZI_ADRESAR = "/pokyd";

interface Cekajici {
  splni: (hodnota: unknown) => void;
  odmitni: (duvod: Error) => void;
}

export class PokydClient {
  private readonly worker: Worker;
  private readonly moduleUrl: string;
  private readonly dataDir: string;
  private readonly cekajici = new Map<number, Cekajici>();
  private dalsiId = 1;
  private mrtvy: Error | null = null;

  /** Everything the engine wrote to its console.  Settable after construction
   *  so a page can attach a loading screen and drop it again. */
  onOutput: ((text: string, progress: PokydProgress) => void) | null;

  constructor(volby: PokydClientOptions) {
    /* Absolute, because the worker resolves it against its own URL and not
       against the page's -- a relative path that worked here would quietly
       point somewhere else there. */
    this.moduleUrl = new URL(String(volby.moduleUrl), self.location.href).href;
    this.dataDir = volby.dataDir ?? VYCHOZI_ADRESAR;
    this.onOutput = volby.onOutput ?? null;

    this.worker = new Worker(volby.workerUrl, { type: "module" });
    this.worker.onmessage = (udalost: MessageEvent): void => {
      this.prijmi(udalost.data as PokydReply);
    };
    /* A worker that fails to start -- a bad URL, a syntax error, a module the
       browser would not load -- never answers anything.  Without this every
       call would hang instead of failing. */
    this.worker.onerror = (udalost: ErrorEvent): void => {
      this.zabij(new Error("the IQ Pokyd worker failed to start: "
        + (udalost.message || "no message")
        + (udalost.filename ? " (" + udalost.filename + ":" + udalost.lineno + ")" : "")));
    };
  }

  /* ------------------------------------------------------------- transport */

  private prijmi(zprava: PokydReply): void {
    if (zprava.kind === "output") {
      const posluchac = this.onOutput;
      if (posluchac) {
        posluchac(zprava.text, { phase: zprava.phase, percent: zprava.percent });
      }
      return;
    }
    const cekajici = this.cekajici.get(zprava.id);
    if (cekajici === undefined) return;     /* a reply to a terminated call */
    this.cekajici.delete(zprava.id);
    if (zprava.kind === "ok") cekajici.splni(zprava.result);
    else cekajici.odmitni(new Error(zprava.message));
  }

  private zabij(duvod: Error): void {
    this.mrtvy = duvod;
    for (const cekajici of this.cekajici.values()) cekajici.odmitni(duvod);
    this.cekajici.clear();
  }

  private posli<K extends PokydRequestType>(
    pozadavek: PokydRequest & { type: K },
    prevod: Transferable[] = [],
  ): Promise<PokydResultOf<K>> {
    if (this.mrtvy !== null) return Promise.reject(this.mrtvy);
    const id = this.dalsiId++;
    const volani: PokydCall = { id, request: pozadavek };
    return new Promise<PokydResultOf<K>>((splni, odmitni) => {
      this.cekajici.set(id, {
        splni: splni as (hodnota: unknown) => void,
        odmitni,
      });
      this.worker.postMessage(volani, prevod);
    });
  }

  /* -------------------------------------------------------- one per request */

  init(): Promise<null> {
    return this.posli({
      type: "init", moduleUrl: this.moduleUrl, dataDir: this.dataDir,
    });
  }

  importCache(blob: Uint8Array, transfer = false): Promise<null> {
    return this.posli({ type: "importCache", blob },
      transfer ? [blob.buffer] : []);
  }

  load(): Promise<null> { return this.posli({ type: "load" }); }

  seed(value: number): Promise<null> {
    return this.posli({ type: "seed", value });
  }

  say(text: string): Promise<string> {
    return this.posli({ type: "say", text });
  }

  sentenceCount(): Promise<number> {
    return this.posli({ type: "sentenceCount" });
  }

  getSettings(): Promise<PokydSettings> {
    return this.posli({ type: "getSettings" });
  }

  setSettings(settings: PokydSettings): Promise<null> {
    return this.posli({ type: "setSettings", settings });
  }

  setMood(mood: number): Promise<null> {
    return this.posli({ type: "setMood", mood });
  }

  progress(): Promise<PokydProgress> {
    return this.posli({ type: "progress" });
  }

  /** The 18 MB SLOVNIK.TMP, or null if there is none yet.  The worker transfers
   *  it rather than copying it. */
  exportCache(): Promise<Uint8Array | null> {
    return this.posli({ type: "exportCache" });
  }

  /** Which SLOVNIK.IQP the worker is holding, as sixteen hex digits.  Valid
   *  from init() onwards; src/web/cache.ts turns it into the IndexedDB key. */
  dictionaryHash(): Promise<string> {
    return this.posli({ type: "dictionaryHash" });
  }

  /** Blocks the engine did not account for; it should be 0. */
  shutdown(): Promise<number> { return this.posli({ type: "shutdown" }); }

  /* ---------------------------------------------------------- the sequence */

  /* init, settings, mood, cache, load, seed -- the order test/wasm/bench-core.mjs
     drives the engine in, which is the order the golden transcript was recorded
     under.  Two steps of it are load-bearing and pokyd_api.h says why: the cache
     has to be in place before the load looks for it, and the seed has to come
     after, because ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU reseeds from the
     clock on its way out (SLOVNIK.FU:1732). */
  async start(volby: PokydStartOptions = {}): Promise<void> {
    await this.init();
    if (volby.settings !== undefined) await this.setSettings(volby.settings);
    if (volby.mood !== undefined) await this.setMood(volby.mood);
    if (volby.cache !== undefined) {
      await this.importCache(volby.cache, volby.transferCache === true);
    }
    await this.load();
    if (volby.seed !== undefined) await this.seed(volby.seed);
  }

  /** Shut the engine down cleanly and then stop the thread.  Returns the unfreed
   *  block count, which should be 0. */
  async close(): Promise<number> {
    const neuvolneno = await this.shutdown();
    this.terminate();
    return neuvolneno;
  }

  /** Stop the thread now, without asking the engine.  Every call still waiting
   *  is rejected rather than left hanging. */
  terminate(): void {
    this.worker.terminate();
    this.zabij(new Error("the IQ Pokyd worker was terminated"));
  }
}
