/* IQ Pokyd - src/app/main.ts - phase 5.1 of PLAN.md: what index.html runs.

   Three things src/app/chat.ts deliberately does not know, because they are
   properties of the build and not of the conversation:

     - where the worker is.  Vite bundles src/web/worker.ts into a module chunk
       of its own and hands back its URL; `?worker&url` is the only import in
       this repository that a plain browser could not follow, which is why it
       is in this file and not in chat.ts.
     - where the engine is.  vite.config.ts emits build/wasm/pokyd.mjs and its
       pokyd.wasm under <base>/pokyd/, unprocessed and together, and
       ENGINE_URL_DIR there is the other half of the path below.
     - what the visitor asked for in the query string.

   The query string is a developer's door, not a feature: ?seed= pins the
   conversation to one rand() sequence, which is how a transcript is reproduced
   (test/golden/README.md), and ?cache=no or ?cache=rebuild get at the fifteen
   seconds phase 4.4 makes disappear.  One of them is the author's own, spelled
   the way he spelled it: ?bezpozadi is the switch ROZEBER_PRIKAZOVY_RADEK read
   in 2005.  Phase 7 is where settings become a dialog.

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code.
*/

import workerUrl from "../web/worker.ts?worker&url";
import { mountChat } from "./chat.ts";
import type { PokydChatHandle, PokydChatOptions } from "./chat.ts";

/* vite.config.ts: ENGINE_URL_DIR.  Resolved against the document rather than
   taken as a path, so the exhibit runs from a subdirectory as happily as from
   the root of a domain -- `base: "./"` is what makes BASE_URL relative. */
const moduleUrl = new URL(
  import.meta.env.BASE_URL + "pokyd/pokyd.mjs", document.baseURI);

/** An integer in [lo, hi] from the query string, or undefined if it is not
 *  there or not one.  A bad value is ignored rather than fatal: the visitor
 *  should get a conversation, not an error page. */
function number(params: URLSearchParams, name: string,
                lo: number, hi: number): number | undefined {
  const raw = params.get(name);
  if (raw === null) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value)) return undefined;
  if (value < lo || value > hi) return undefined;
  return value;
}

/** Everything the query string can say -- which is everything mountChat takes
 *  except the two URLs, because those are the build's business and not the
 *  visitor's. */
export type PokydQueryOptions = Omit<PokydChatOptions, "workerUrl" | "moduleUrl">;

export function optionsFromQuery(search: string): PokydQueryOptions {
  const params = new URLSearchParams(search);
  const options: PokydQueryOptions = {};

  /* pokyd_seed takes an unsigned long; the engine's rand() is a 32-bit LCG. */
  const seed = number(params, "seed", 0, 0xffffffff);
  if (seed !== undefined) options.seed = seed;

  /* nalada: 1 best .. 5 worst (NASTAVEN.PR:20-24). */
  const mood = number(params, "mood", 1, 5);
  if (mood !== undefined) options.mood = mood;

  const cache = params.get("cache");
  if (cache === "no") { options.ignoreStored = true; options.doNotSave = true; }
  if (cache === "rebuild") options.ignoreStored = true;

  /* ROZEBER_PRIKAZOVY_RADEK (PROSTRED.FU:83-106) read "-bezpozadi" off the
     command line and turned the photograph and the tile off in favour of plain
     black; a page's command line is its query string, so it keeps his spelling.
     Phase 7.1 is where prikaz_nezobrazovatpozadi becomes a checkbox. */
  if (params.has("bezpozadi")) options.noBackground = true;

  return options;
}

export function startPokyd(parent: Element = document.body): PokydChatHandle {
  return mountChat(parent, {
    ...optionsFromQuery(location.search),
    workerUrl,
    moduleUrl,
  });
}

/* Hung on the window so that a browser console -- and test/app/chat.test.mjs --
   can reach the handle without the page having to hand it anywhere. */
declare global {
  interface Window { pokyd?: PokydChatHandle }
}

const app = document.getElementById("app") ?? document.body;
window.pokyd = startPokyd(app);
