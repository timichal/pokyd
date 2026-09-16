/* IQ Pokyd - src/web/worker.ts - the engine, on a thread that is allowed to stop.

   Phase 4.2 of PLAN.md, and the reason the phase exists.  3.4 measured a first
   visit at 15.3 s in Chrome, and pokyd_load_dictionaries() is one synchronous
   call: on the main thread that is not a slow page, it is a page that does not
   repaint, does not scroll and does not answer the mouse for a quarter of a
   minute.  Here it blocks this thread instead, which has nothing else to do.

   The file is deliberately thin.  Everything it knows about the engine is in
   src/web/engine.ts, everything it knows about the messages is in
   src/web/protocol.ts, and what is left is three things:

     - a strict FIFO queue, so two requests can never overtake each other.  The
       dispatcher is async (the module import is), and a `load` that ran before
       the `init` it was queued behind would be a very confusing bug.
     - the output relay, throttled.  The engine writes its loading percentage to
       the console 2.7 million characters at a time and Emscripten hands them
       over synchronously from inside the blocked call, so this is the one
       progress signal that exists -- see PROGRESS in protocol.ts.
     - turning a thrown Error into a rejected reply, so that pokyd_error()'s text
       arrives with the failure rather than after it.

   It runs as a module worker: `new Worker(url, { type: "module" })`.  The
   Emscripten module is imported by URL from the init message rather than by a
   static import, because where build/wasm/pokyd.mjs sits is the page's business
   and changes between the raw static server this is tested under and the Vite
   build of phase 5.1.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

import { PokydEngine } from "./engine.ts";
import type { PokydModuleFactory } from "./engine.ts";
import type { PokydCall, PokydRequest } from "./protocol.ts";

/* The worker globals this file uses, declared rather than pulled in from
   lib.webworker -- which cannot be loaded alongside the lib.dom that
   src/web/client.ts needs.  Two members is a cheaper price than a second
   tsconfig. */
interface WorkerScope {
  onmessage: ((event: { data: unknown }) => void) | null;
  postMessage(message: unknown, transfer?: unknown[]): void;
}

const ctx = globalThis as unknown as WorkerScope;

let engine: PokydEngine | null = null;

/* -------------------------------------------------------------- the output */

/* At most one output message per this many milliseconds.  The engine emits a
   segment every tenth word through the inflection loop -- about 1,100 of them
   over a cold load, plus everything vstup.fu:801-809 prints on every sentence --
   and a progress bar that moves more often than the screen refreshes is only
   postMessage traffic.  Whatever was dropped is sent once the request that was
   running finishes, so the last thing the engine said is never lost. */
const THROTTLE_MS = 60;

let lastOutputAt = 0;
let held: string | null = null;

function sendOutput(text: string): void {
  const now = Date.now();
  if (now - lastOutputAt < THROTTLE_MS) {
    held = text;
    return;
  }
  lastOutputAt = now;
  held = null;
  /* Read the counters at the same instant as the text: during a load this runs
     on this thread from inside pokyd_load_dictionaries(), so they are as current
     as they will ever be. */
  const state = engine === null ? { phase: 0, percent: 0 } : engine.progress();
  ctx.postMessage({
    kind: "output", text, phase: state.phase, percent: state.percent,
  });
}

function flushOutput(): void {
  if (held === null) return;
  const text = held;
  held = null;
  lastOutputAt = Date.now();
  const state = engine === null ? { phase: 0, percent: 0 } : engine.progress();
  ctx.postMessage({
    kind: "output", text, phase: state.phase, percent: state.percent,
  });
}

/* ------------------------------------------------------------ the dispatch */

/* Returns the result and whatever should be transferred rather than copied with
   it.  The only thing worth transferring is the cache blob: it is 18 MB, this
   side has just finished with it, and a structured clone of it is a second 18 MB
   that exists for no reason.  3.4 counted three simultaneous copies on a naive
   warm start and phase 4.4 has to live within that. */
async function handle(request: PokydRequest): Promise<[unknown, unknown[]]> {
  if (request.type === "init") {
    if (engine !== null) throw new Error("init: the engine is already running");
    /* A runtime URL, so bundlers must leave it alone; Vite is told explicitly. */
    const mod = await import(/* @vite-ignore */ request.moduleUrl) as
      { default: PokydModuleFactory };
    engine = await PokydEngine.create(mod.default, {
      dataDir: request.dataDir,
      onOutput: sendOutput,
    });
    return [null, []];
  }

  const M = engine;
  if (M === null) {
    throw new Error(request.type + ": the worker has not been initialised"
      + " -- send init first");
  }

  switch (request.type) {
    case "importCache": M.importCache(request.blob); return [null, []];
    case "load":        M.load();                      return [null, []];
    case "seed":        M.seed(request.value);       return [null, []];
    case "say":         return [M.say(request.text), []];
    case "sentenceCount": return [M.sentenceCount(), []];
    case "getSettings": return [M.getSettings(), []];
    case "setSettings": M.setSettings(request.settings); return [null, []];
    case "setMood":     M.setMood(request.mood);     return [null, []];
    case "progress":    return [M.progress(), []];
    case "dictionaryHash": return [M.dictionaryHash(), []];
    case "exportCache": {
      const blob = M.exportCache();
      return blob === null ? [null, []] : [blob, [blob.buffer]];
    }
    case "shutdown": {
      const unfreed = M.shutdown();
      engine = null;
      return [unfreed, []];
    }
    default: {
      /* Exhaustiveness: if PokydRequest grows a member and this switch does not,
         `rest` stops being assignable to never and the build fails. */
      const rest: never = request;
      throw new Error("unknown request: " + JSON.stringify(rest));
    }
  }
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

async function handleCall(call: PokydCall): Promise<void> {
  try {
    const [result, transfer] = await handle(call.request);
    ctx.postMessage({ kind: "ok", id: call.id, result: result }, transfer);
  } catch (e) {
    ctx.postMessage({ kind: "error", id: call.id, message: describeError(e) });
  } finally {
    /* Whatever the throttle swallowed while this request was running -- for a
       load, that is the engine's last word on it. */
    flushOutput();
  }
}

/* Strict FIFO.  Messages queue on the event loop anyway while a synchronous load
   holds the thread, but the dispatcher is async and without this chain a request
   whose handler awaits would let the next one start underneath it. */
let queue: Promise<void> = Promise.resolve();

ctx.onmessage = (event: { data: unknown }): void => {
  const call = event.data as PokydCall;
  queue = queue.then(() => handleCall(call));
};
