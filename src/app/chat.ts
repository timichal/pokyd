/* IQ Pokyd - src/app/chat.ts - phase 5.1 of PLAN.md: the conversation, as a page.

   The plainest thing that can hold a conversation with the engine: a transcript
   and a line to type into.  Everything underneath it was built in phase 4 and is
   used here unchanged -- src/web/client.ts for the worker, src/web/cache.ts for
   the eighteen megabytes that make a second visit instant, src/web/loading.ts
   for the fifteen seconds of the first one.  What is left for this file is the
   part none of them would do: append two lines to a list, and keep the visitor
   from typing while the engine is busy.

   It is deliberately not the exhibit.  Phase 6 rebuilds the author's window --
   the background, the menu, the panes, the welcome line -- and when it does it
   replaces the markup below rather than wraps it.  Two things here are already
   his, because they cost nothing to get right: the label beside the input and
   the word on the button are IQPokyd.rc:110-115, IDD_HLAVNI_OKNO.

   mountChat(document.body, urls) is the whole of using it, and it mirrors
   mountLoading: build it, attach it, hand back a handle that can take it off
   again.  The two urls are not optional and deliberately so -- see the note on
   them below.

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code -- every Czech letter the visitor sees is a \uXXXX
   escape, with the author's own spelling in the comment beside it.
*/

import { PokydClient } from "../web/client.ts";
import { mountLoading } from "../web/loading.ts";
import { startCached } from "../web/cache.ts";
import type { PokydCacheReport, PokydCachedStartOptions } from "../web/cache.ts";

/* IDD_HLAVNI_OKNO, IQPokyd.rc:106-115.  His words, not ours. */
const TITLE = "IQ Pokyd v0.15";
const INPUT_LABEL = "Tv\u00e1 v\u011bta";     /* "Tva veta" */
const SEND_LABEL = "\u0158ekni";              /* "Rekni" */

/* Ours, and only until phase 6 gives the window its own way of saying so. */
const FAILED_TITLE = "IQ Pokyd se nespustil.";           /* "did not start" */
const FAILED_SAY = "(IQ Pokyd neodpov\u011bd\u011bl.)";  /* "did not answer" */

export interface PokydChatOptions extends PokydCachedStartOptions {
  /** Where src/web/worker.ts and build/wasm/pokyd.mjs are served from.
   *
   *  Required, with no default, and that is the interesting part: a default
   *  would have to be written `new URL("../web/worker.ts", import.meta.url)`,
   *  and Vite rewrites exactly that expression at build time into an emitted
   *  asset -- so the bundle would carry a second, unbundled copy of the worker
   *  and of the 137 KB Emscripten glue whether or not anything ever loaded
   *  them.  Where the two files landed is a property of the build, so the
   *  caller that knows says it: src/app/main.ts for the exhibit, and the page
   *  itself for a test served by test/browser.mjs. */
  workerUrl: string | URL;
  moduleUrl: string | URL;
  /** Every state change, in the order the root element's `data-state` shows
   *  them.  For a page that wants to react to one; the DOM is the other half of
   *  this and says the same thing. */
  onState?: (state: PokydChatState) => void;
}

/** What `data-state` on the root element says. */
export type PokydChatState = "loading" | "ready" | "busy" | "failed";

export interface PokydChatHandle {
  element: HTMLElement;
  client: PokydClient;
  /** Resolves once the engine has loaded and the input is live; rejects with
   *  whatever stopped it.  The report is phase 4.4's: which key this visit
   *  used, whether it was a hit, and how long the load took. */
  ready: Promise<PokydCacheReport>;
  /** The same path the form takes -- the visitor's line into the transcript,
   *  the engine's answer under it.  Resolves with the answer. */
  say(text: string): Promise<string>;
  state(): PokydChatState;
  /** Shut the engine down and take the page off.  pokyd_api.h allows the
   *  shutdown only after a load that succeeded, so a failed start terminates
   *  the worker instead -- src/web/engine.ts is what refuses the other way. */
  close(): Promise<void>;
}

export function mountChat(
  parent: Element,
  options: PokydChatOptions,
): PokydChatHandle {
  const { workerUrl, moduleUrl, onState, ...startOptions } = options;

  /* ----------------------------------------------------------------- the DOM */

  const element = document.createElement("div");
  element.className = "pokyd";
  element.dataset["state"] = "loading";

  const heading = document.createElement("h1");
  heading.className = "pokyd-title";
  heading.textContent = TITLE;

  const transcript = document.createElement("ol");
  transcript.className = "pokyd-transcript";
  /* The engine answers at its own pace and the visitor is looking at the input,
     not at the list, so the answer has to announce itself. */
  transcript.setAttribute("aria-live", "polite");

  const form = document.createElement("form");
  form.className = "pokyd-form";

  const label = document.createElement("label");
  label.className = "pokyd-label";
  label.htmlFor = "pokyd-veta";
  label.textContent = INPUT_LABEL;

  /* IDC_VETA is an ES_AUTOHSCROLL edit with no length of its own, and
     pokyd_say copies into a buffer the API sizes -- so there is no cap to put
     here that the engine does not already have. */
  const input = document.createElement("input");
  input.className = "pokyd-input";
  input.id = "pokyd-veta";
  input.type = "text";
  input.autocomplete = "off";
  input.disabled = true;

  const send = document.createElement("button");
  send.className = "pokyd-send";
  send.type = "submit";
  send.textContent = SEND_LABEL;
  send.disabled = true;

  const failure = document.createElement("p");
  failure.className = "pokyd-failure";
  failure.hidden = true;

  /* Where IDD_NACITANI goes while it is on the screen.  mountLoading appends to
     whatever it is handed, so the only way to put it above the input rather
     than below it is to hand it a place of its own. */
  const loadingSlot = document.createElement("div");
  loadingSlot.className = "pokyd-loading-slot";

  form.append(label, input, send);
  element.append(heading, loadingSlot, transcript, form, failure);
  parent.appendChild(element);

  /* --------------------------------------------------------------- the state */

  let state: PokydChatState = "loading";

  function setState(next: PokydChatState): void {
    state = next;
    element.dataset["state"] = next;
    const live = next === "ready";
    input.disabled = !live;
    send.disabled = !live;
    if (onState) onState(next);
  }

  function turn(who: "human" | "pokyd", text: string): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "pokyd-turn";
    li.dataset["who"] = who;

    const marker = document.createElement("span");
    marker.className = "pokyd-marker";
    /* The two characters test/golden/rozhovor.txt is written with, so that what
       is on the screen and what is in the golden file read as one thing. */
    marker.textContent = who === "human" ? ">" : "<";
    marker.setAttribute("aria-hidden", "true");

    const body = document.createElement("span");
    body.className = "pokyd-text";
    body.textContent = text;

    li.append(marker, body);
    transcript.appendChild(li);
    /* The transcript scrolls, the page does not: scrollIntoView would drag the
       input off the screen on a phone. */
    transcript.scrollTop = transcript.scrollHeight;
    return li;
  }

  function fail(error: Error): void {
    setState("failed");
    failure.hidden = false;
    failure.textContent = FAILED_TITLE + " " + error.message;
  }

  /* -------------------------------------------------------------- the engine */

  const client = new PokydClient({ workerUrl, moduleUrl });

  /* mountLoading listens to the engine's console; finish() stops it, because the
     engine goes on printing all through the conversation (VSTUP.FU:801-809).
     In a finally, not after: a load that throws should take its loading window
     with it rather than leave a bar stopped at 41% on the screen. */
  const loading = mountLoading(loadingSlot, client);

  const ready = (async (): Promise<PokydCacheReport> => {
    try {
      /* srand(time(NULL)): mfcDlg.cpp:363, and again at PROSTRED.FU:307 after
         the load, where the greeting is drawn.  Without it a visit off the
         cache would hold the same conversation every time -- nothing else seeds
         a warm start, and the cold path's own reseed (SLOVNIK.FU:1732) never
         happens on one. */
      const seed = startOptions.seed ?? Math.floor(Date.now() / 1000);
      const report = await startCached(client, { ...startOptions, seed });
      setState("ready");
      input.focus();
      return report;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      fail(error);
      throw error;
    } finally {
      loading.remove();
      loadingSlot.remove();
    }
  })();
  /* The handle carries the rejection; this is only so that a page which never
     looks at `ready` does not take an unhandled one with it. */
  ready.catch((): void => {});

  /* ----------------------------------------------------------- the two lines */

  async function say(text: string): Promise<string> {
    /* mfcDlg.cpp:556 -- an empty sentence is not one. */
    const sentence = text.trim();
    if (sentence.length === 0) return "";
    if (state !== "ready") {
      throw new Error("IQ Pokyd is not listening (state: " + state + ")");
    }

    turn("human", sentence);
    setState("busy");
    try {
      const answer = await client.say(sentence);
      turn("pokyd", answer);
      setState("ready");
      input.focus();
      return answer;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      turn("pokyd", FAILED_SAY);
      fail(error);
      throw error;
    }
  }

  form.addEventListener("submit", (event: SubmitEvent): void => {
    event.preventDefault();
    const text = input.value;
    if (text.trim().length === 0) return;
    input.value = "";
    say(text).catch((): void => {});     /* it is already on the screen */
  });

  /* --------------------------------------------------------------- the handle */

  return {
    element,
    client,
    ready,
    say,
    state: (): PokydChatState => state,
    close: async (): Promise<void> => {
      loading.remove();
      loadingSlot.remove();
      try {
        await ready;
        await client.close();
      } catch {
        /* A load that never finished has nothing to tear down -- pokyd_api.h,
           and src/web/engine.ts refuses the call rather than let the engine
           abort on it. */
        client.terminate();
      }
      element.remove();
    },
  };
}
