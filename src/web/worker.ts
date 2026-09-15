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
  onmessage: ((udalost: { data: unknown }) => void) | null;
  postMessage(zprava: unknown, prevod?: unknown[]): void;
}

const kontext = globalThis as unknown as WorkerScope;

let motor: PokydEngine | null = null;

/* -------------------------------------------------------------- the output */

/* At most one output message per this many milliseconds.  The engine emits a
   segment every tenth word through the inflection loop -- about 1,100 of them
   over a cold load, plus everything vstup.fu:801-809 prints on every sentence --
   and a progress bar that moves more often than the screen refreshes is only
   postMessage traffic.  Whatever was dropped is sent once the request that was
   running finishes, so the last thing the engine said is never lost. */
const ODSTUP_MS = 60;

let posledniVystup = 0;
let zadrzeno: string | null = null;

function posliVystup(text: string): void {
  const ted = Date.now();
  if (ted - posledniVystup < ODSTUP_MS) {
    zadrzeno = text;
    return;
  }
  posledniVystup = ted;
  zadrzeno = null;
  /* Read the counters at the same instant as the text: during a load this runs
     on this thread from inside pokyd_load_dictionaries(), so they are as current
     as they will ever be. */
  const stav = motor === null ? { phase: 0, percent: 0 } : motor.progress();
  kontext.postMessage({
    kind: "output", text, phase: stav.phase, percent: stav.percent,
  });
}

function dorovnejVystup(): void {
  if (zadrzeno === null) return;
  const text = zadrzeno;
  zadrzeno = null;
  posledniVystup = Date.now();
  const stav = motor === null ? { phase: 0, percent: 0 } : motor.progress();
  kontext.postMessage({
    kind: "output", text, phase: stav.phase, percent: stav.percent,
  });
}

/* ------------------------------------------------------------ the dispatch */

/* Returns the result and whatever should be transferred rather than copied with
   it.  The only thing worth transferring is the cache blob: it is 18 MB, this
   side has just finished with it, and a structured clone of it is a second 18 MB
   that exists for no reason.  3.4 counted three simultaneous copies on a naive
   warm start and phase 4.4 has to live within that. */
async function vyrid(pozadavek: PokydRequest): Promise<[unknown, unknown[]]> {
  if (pozadavek.type === "init") {
    if (motor !== null) throw new Error("init: the engine is already running");
    /* A runtime URL, so bundlers must leave it alone; Vite is told explicitly. */
    const modul = await import(/* @vite-ignore */ pozadavek.moduleUrl) as
      { default: PokydModuleFactory };
    motor = await PokydEngine.create(modul.default, {
      dataDir: pozadavek.dataDir,
      onOutput: posliVystup,
    });
    return [null, []];
  }

  const M = motor;
  if (M === null) {
    throw new Error(pozadavek.type + ": the worker has not been initialised"
      + " -- send init first");
  }

  switch (pozadavek.type) {
    case "importCache": M.importCache(pozadavek.blob); return [null, []];
    case "load":        M.load();                      return [null, []];
    case "seed":        M.seed(pozadavek.value);       return [null, []];
    case "say":         return [M.say(pozadavek.text), []];
    case "sentenceCount": return [M.sentenceCount(), []];
    case "getSettings": return [M.getSettings(), []];
    case "setSettings": M.setSettings(pozadavek.settings); return [null, []];
    case "setMood":     M.setMood(pozadavek.mood);     return [null, []];
    case "progress":    return [M.progress(), []];
    case "exportCache": {
      const blob = M.exportCache();
      return blob === null ? [null, []] : [blob, [blob.buffer]];
    }
    case "shutdown": {
      const neuvolneno = M.shutdown();
      motor = null;
      return [neuvolneno, []];
    }
    default: {
      /* Exhaustiveness: if PokydRequest grows a member and this switch does not,
         `zbylo` stops being assignable to never and the build fails. */
      const zbylo: never = pozadavek;
      throw new Error("unknown request: " + JSON.stringify(zbylo));
    }
  }
}

function popisChyby(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

async function zpracuj(volani: PokydCall): Promise<void> {
  try {
    const [vysledek, prevod] = await vyrid(volani.request);
    kontext.postMessage({ kind: "ok", id: volani.id, result: vysledek }, prevod);
  } catch (e) {
    kontext.postMessage({ kind: "error", id: volani.id, message: popisChyby(e) });
  } finally {
    /* Whatever the throttle swallowed while this request was running -- for a
       load, that is the engine's last word on it. */
    dorovnejVystup();
  }
}

/* Strict FIFO.  Messages queue on the event loop anyway while a synchronous load
   holds the thread, but the dispatcher is async and without this chain a request
   whose handler awaits would let the next one start underneath it. */
let fronta: Promise<void> = Promise.resolve();

kontext.onmessage = (udalost: { data: unknown }): void => {
  const volani = udalost.data as PokydCall;
  fronta = fronta.then(() => zpracuj(volani));
};
