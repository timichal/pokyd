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
  /** mood 1..5, applied through pokyd_set_mood rather than through settings,
   *  because writing mood alone is undone after the next sentence. */
  mood?: number;
  /** srand(), applied after the load, which is the only place it survives. */
  seed?: number;
}

const DEFAULT_DATA_DIR = "/pokyd";

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

export class PokydClient {
  private readonly worker: Worker;
  private readonly moduleUrl: string;
  private readonly dataDir: string;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private dead: Error | null = null;

  /** Everything the engine wrote to its console.  Settable after construction
   *  so a page can attach a loading screen and drop it again. */
  onOutput: ((text: string, progress: PokydProgress) => void) | null;

  constructor(options: PokydClientOptions) {
    /* Absolute, because the worker resolves it against its own URL and not
       against the page's -- a relative path that worked here would quietly
       point somewhere else there. */
    this.moduleUrl = new URL(String(options.moduleUrl), self.location.href).href;
    this.dataDir = options.dataDir ?? DEFAULT_DATA_DIR;
    this.onOutput = options.onOutput ?? null;

    this.worker = new Worker(options.workerUrl, { type: "module" });
    this.worker.onmessage = (event: MessageEvent): void => {
      this.receive(event.data as PokydReply);
    };
    /* A worker that fails to start -- a bad URL, a syntax error, a module the
       browser would not load -- never answers anything.  Without this every
       call would hang instead of failing. */
    this.worker.onerror = (event: ErrorEvent): void => {
      this.kill(new Error("the IQ Pokyd worker failed to start: "
        + (event.message || "no message")
        + (event.filename ? " (" + event.filename + ":" + event.lineno + ")" : "")));
    };
  }

  /* ------------------------------------------------------------- transport */

  private receive(reply: PokydReply): void {
    if (reply.kind === "output") {
      const listener = this.onOutput;
      if (listener) {
        listener(reply.text, { phase: reply.phase, percent: reply.percent });
      }
      return;
    }
    const pending = this.pending.get(reply.id);
    if (pending === undefined) return;     /* a reply to a terminated call */
    this.pending.delete(reply.id);
    if (reply.kind === "ok") pending.resolve(reply.result);
    else pending.reject(new Error(reply.message));
  }

  private kill(reason: Error): void {
    this.dead = reason;
    for (const pending of this.pending.values()) pending.reject(reason);
    this.pending.clear();
  }

  private send<K extends PokydRequestType>(
    request: PokydRequest & { type: K },
    transfer: Transferable[] = [],
  ): Promise<PokydResultOf<K>> {
    if (this.dead !== null) return Promise.reject(this.dead);
    const id = this.nextId++;
    const call: PokydCall = { id, request };
    return new Promise<PokydResultOf<K>>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.worker.postMessage(call, transfer);
    });
  }

  /* -------------------------------------------------------- one per request */

  init(): Promise<null> {
    return this.send({
      type: "init", moduleUrl: this.moduleUrl, dataDir: this.dataDir,
    });
  }

  importCache(blob: Uint8Array, transfer = false): Promise<null> {
    return this.send({ type: "importCache", blob },
      transfer ? [blob.buffer] : []);
  }

  load(): Promise<null> { return this.send({ type: "load" }); }

  seed(value: number): Promise<null> {
    return this.send({ type: "seed", value });
  }

  say(text: string): Promise<string> {
    return this.send({ type: "say", text });
  }

  sentenceCount(): Promise<number> {
    return this.send({ type: "sentenceCount" });
  }

  getSettings(): Promise<PokydSettings> {
    return this.send({ type: "getSettings" });
  }

  setSettings(settings: PokydSettings): Promise<null> {
    return this.send({ type: "setSettings", settings });
  }

  setMood(mood: number): Promise<null> {
    return this.send({ type: "setMood", mood });
  }

  progress(): Promise<PokydProgress> {
    return this.send({ type: "progress" });
  }

  /** The 18 MB SLOVNIK.TMP, or null if there is none yet.  The worker transfers
   *  it rather than copying it. */
  exportCache(): Promise<Uint8Array | null> {
    return this.send({ type: "exportCache" });
  }

  /** Which SLOVNIK.IQP the worker is holding, as sixteen hex digits.  Valid
   *  from init() onwards; src/web/cache.ts turns it into the IndexedDB key. */
  dictionaryHash(): Promise<string> {
    return this.send({ type: "dictionaryHash" });
  }

  /** Blocks the engine did not account for; it should be 0. */
  shutdown(): Promise<number> { return this.send({ type: "shutdown" }); }

  /* ---------------------------------------------------------- the sequence */

  /* init, settings, mood, cache, load, seed -- the order test/wasm/bench-core.mjs
     drives the engine in, which is the order the golden transcript was recorded
     under.  Two steps of it are load-bearing and pokyd_api.h says why: the cache
     has to be in place before the load looks for it, and the seed has to come
     after, because ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU reseeds from the
     clock on its way out (SLOVNIK.FU:1732). */
  async start(options: PokydStartOptions = {}): Promise<void> {
    await this.init();
    if (options.settings !== undefined) await this.setSettings(options.settings);
    if (options.mood !== undefined) await this.setMood(options.mood);
    if (options.cache !== undefined) {
      await this.importCache(options.cache, options.transferCache === true);
    }
    await this.load();
    if (options.seed !== undefined) await this.seed(options.seed);
  }

  /** Shut the engine down cleanly and then stop the thread.  Returns the unfreed
   *  block count, which should be 0. */
  async close(): Promise<number> {
    const unfreed = await this.shutdown();
    this.terminate();
    return unfreed;
  }

  /** Stop the thread now, without asking the engine.  Every call still waiting
   *  is rejected rather than left hanging. */
  terminate(): void {
    this.worker.terminate();
    this.kill(new Error("the IQ Pokyd worker was terminated"));
  }
}
