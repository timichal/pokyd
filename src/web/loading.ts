/* IQ Pokyd - src/web/loading.ts - the loading window, on a page.

   Phase 4.3 of PLAN.md, the half of it that is visible.  src/web/progress.ts
   turns the engine's console into a state; this draws that state, and
   mountLoading() at the foot is the whole of it in one call.

   The layout is not invented.  IDD_NACITANI (IQPokyd.rc:122-132) is an exact
   spec for what a person saw while IQ Pokyd started in 2005, and phase 6.1 is
   going to read that file properly, so there is no reason to guess now:

       CAPTION "Spoustim IQ Pokyd..."                  the window
       LTEXT   "Spoustim IQ Pokyd...", IDC_TEXT        7,7   200x8
       CONTROL msctls_progress32, PBS_SMOOTH|WS_BORDER 7,19  170x11
       RTEXT   "0.0%", IDC_PROCENTA                    178,19 29x12
       PUSHBUTTON "Prerusit", IDCANCEL                 78,34  50x14

   So: a caption on its own line, a bordered smooth bar with the percentage
   right-aligned beside it, and one decimal place.  Those proportions are kept
   -- the bar takes 170 of the 200 units of content width and the number takes
   the rest -- and the pixel sizes follow from 214 dialog units being about
   320 px in the System font the dialog asked for.

   The one control that is missing is IDCANCEL.  "Prerusit" set
   g_zavritvlaknoprocesu and the loader checked it between every step
   (PROSTRED.FU:562, :570, :578); a BEZ_PROSTREDI build compiles those checks out
   with everything else behind IQPOKYDWINMFC, so there is nothing for a button to
   set.  The only cancel this port can offer is PokydClient.terminate(), which
   kills the thread outright -- a page that wants one can draw its own and call
   it, and this does not pretend to.

   What this is not is the retro skin.  Phase 6 has the background bitmap, the
   font and the colours; everything here is plain, sized in ems, and styled
   through six custom properties so that 6.3 can restyle it without touching a
   line of this file.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

import {
  PokydLoadingTracker,
  POKYD_COLD_NOTICE,
  POKYD_STEP_CAPTIONS,
  POKYD_STEP_IDLE,
  formatPercent,
} from "./progress.ts";
import type {
  PokydLoadingState,
  PokydLoadingTrackerOptions,
  PokydOutputSource,
} from "./progress.ts";

/* One class prefix for the lot, so a page can restyle or hide all of it with a
   single selector and nothing here collides with anything else. */
const CLASS = "pokyd-loading";
const STYLE_ID = "pokyd-loading-style";

/* The bar is 170 of the 200 dialog units of content width and the number has
   the remaining 29 plus its gap; 11 vertical units of a 55-unit dialog is
   about 14 px at the size that dialog came out.  Custom properties, not
   constants, because phase 6.3 will want every one of them different. */
const STYLE = `
.${CLASS} {
  --pokyd-loading-width: 20em;
  --pokyd-loading-bar-height: 0.9em;
  --pokyd-loading-ink: #000;
  --pokyd-loading-track: #fff;
  --pokyd-loading-fill: #316ac5;
  --pokyd-loading-border: #7f9db9;
  box-sizing: border-box;
  width: var(--pokyd-loading-width);
  max-width: 100%;
  color: var(--pokyd-loading-ink);
  font: 1em/1.35 system-ui, sans-serif;
}
.${CLASS}-caption { margin-bottom: 0.45em; }
.${CLASS}-row { display: flex; align-items: center; gap: 0.5em; }
.${CLASS}-track {
  flex: 1 1 auto;
  height: var(--pokyd-loading-bar-height);
  border: 1px solid var(--pokyd-loading-border);
  background: var(--pokyd-loading-track);
  overflow: hidden;
}
.${CLASS}-fill {
  height: 100%;
  width: 0%;
  background: var(--pokyd-loading-fill);
  transition: width 120ms linear;
}
/* POKYD_STEP_WRITING publishes no number at all, so the bar would sit still for
   a quarter of a second and look stuck.  This says "working" without claiming
   any particular progress. */
.${CLASS}.is-indeterminate .${CLASS}-fill {
  background-image: linear-gradient(100deg,
    transparent 40%, rgba(255, 255, 255, 0.45) 50%, transparent 60%);
  background-size: 300% 100%;
  animation: pokyd-loading-sheen 900ms linear infinite;
}
@keyframes pokyd-loading-sheen {
  from { background-position: 150% 0; }
  to   { background-position: -150% 0; }
}
.${CLASS}-percent {
  flex: 0 0 auto;
  min-width: 3.2em;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.${CLASS}-notice { margin-top: 0.45em; }
@media (prefers-reduced-motion: reduce) {
  .${CLASS}-fill { transition: none; }
  .${CLASS}.is-indeterminate .${CLASS}-fill { animation: none; }
}
`;

function installStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID) !== null) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

export interface PokydLoadingViewOptions {
  /** Which document to build in.  Defaults to the ambient one; a test with its
   *  own DOM passes its own. */
  document?: Document;
  /** Put the stylesheet in the document's head.  Off for a page that ships its
   *  own CSS for these class names and would rather not fight a `<style>`. */
  styled?: boolean;
  /** Show POKYD_COLD_NOTICE -- the author's "Vytvarim slovni zasobu, prosim
   *  cekejte..." -- once the load turns out to be the fifteen-second one.
   *  On by default: that notice is the one thing a first-time visitor needs. */
  notice?: boolean;
}

/** The three lines of IDD_NACITANI, as an element a page can put anywhere.
 *
 *  It holds no state of its own beyond the DOM: update() is a pure function of
 *  the state it is handed, so it can be driven by a tracker, by an animation
 *  frame, or by a test with a state it made up. */
export class PokydLoadingView {
  readonly element: HTMLElement;

  private readonly captionEl: HTMLElement;
  private readonly fillEl: HTMLElement;
  private readonly percentEl: HTMLElement;
  private readonly noticeEl: HTMLElement;
  private readonly showNotice: boolean;

  constructor(options: PokydLoadingViewOptions = {}) {
    const doc = options.document
      ?? (globalThis as { document?: Document }).document;
    if (!doc) {
      throw new Error("PokydLoadingView: there is no document to build in"
        + " -- pass one as options.document");
    }
    if (options.styled !== false) installStyle(doc);
    this.showNotice = options.notice !== false;

    const root = doc.createElement("div");
    root.className = CLASS;
    /* The bar is the progressbar, not the box around it, but the caption is
       what says which step it belongs to -- so the role goes on the root and
       the caption labels it.  A screen reader then reads "Sklonuji slovnik...,
       41 percent" rather than a bare number. */
    root.setAttribute("role", "progressbar");
    root.setAttribute("aria-valuemin", "0");
    root.setAttribute("aria-valuemax", "100");

    const caption = doc.createElement("div");
    caption.className = CLASS + "-caption";
    caption.textContent = POKYD_STEP_CAPTIONS[POKYD_STEP_IDLE];

    const row = doc.createElement("div");
    row.className = CLASS + "-row";

    const track = doc.createElement("div");
    track.className = CLASS + "-track";
    const fill = doc.createElement("div");
    fill.className = CLASS + "-fill";
    track.appendChild(fill);

    const percent = doc.createElement("div");
    percent.className = CLASS + "-percent";
    percent.textContent = formatPercent(0);

    row.appendChild(track);
    row.appendChild(percent);

    const notice = doc.createElement("div");
    notice.className = CLASS + "-notice";
    notice.textContent = POKYD_COLD_NOTICE;
    notice.hidden = true;

    root.appendChild(caption);
    root.appendChild(row);
    root.appendChild(notice);

    this.element = root;
    this.captionEl = caption;
    this.fillEl = fill;
    this.percentEl = percent;
    this.noticeEl = notice;

    this.update({
      step: POKYD_STEP_IDLE,
      caption: POKYD_STEP_CAPTIONS[POKYD_STEP_IDLE],
      stepPercent: null,
      percent: 0,
      cold: null,
      done: false,
    });
  }

  /** Draw a state.  Every assignment is idempotent, so calling this on every
   *  output event costs nothing when nothing moved. */
  update(state: PokydLoadingState): void {
    const text = formatPercent(state.percent);

    if (this.captionEl.textContent !== state.caption) {
      this.captionEl.textContent = state.caption;
    }
    if (this.percentEl.textContent !== text) this.percentEl.textContent = text;
    this.fillEl.style.width = state.percent.toFixed(2) + "%";

    /* The step is running but says nothing about how far it has got.  Not the
       same as nothing happening, and not the same as done. */
    const blind = state.stepPercent === null && !state.done
      && state.step !== POKYD_STEP_IDLE;
    this.element.classList.toggle("is-indeterminate", blind);

    this.element.setAttribute("aria-valuenow", state.percent.toFixed(1));
    this.element.setAttribute("aria-valuetext", state.caption + " " + text);

    /* Only while it is actually being waited for: the notice explains fifteen
       seconds, and after finish() there are none left to explain. */
    this.noticeEl.hidden =
      !(this.showNotice && state.cold === true && !state.done);
  }

  /** Take it off the page.  The stylesheet stays: it is 40 lines, it is shared,
   *  and the next load would only put it back. */
  remove(): void {
    this.element.remove();
  }
}

/* ------------------------------------------------------------- the one call */

export interface PokydLoadingHandle {
  tracker: PokydLoadingTracker;
  view: PokydLoadingView;
  /** load() has returned: take the bar to 100 and stop listening to the
   *  engine, which goes on talking during a conversation
   *  (VSTUP.FU:801-809).  Idempotent. */
  finish(): void;
  /** finish(), and then take the element off the page. */
  remove(): void;
}

export interface PokydLoadingOptions
  extends PokydLoadingViewOptions, PokydLoadingTrackerOptions {}

/** Put a loading window in `parent` and point it at `source` -- a PokydClient,
 *  or anything else that publishes the engine's console.
 *
 *  The whole of a loading screen, in the order it has to happen:
 *
 *      const loading = mountLoading(document.body, client);
 *      try { await startCached(client, { seed }); }
 *      finally { loading.remove(); }
 *
 *  finally, not after: a load that throws should take its loading window with
 *  it rather than leave a bar stopped at 41% on the screen. */
export function mountLoading(
  parent: Element,
  source: PokydOutputSource,
  options: PokydLoadingOptions = {},
): PokydLoadingHandle {
  const view = new PokydLoadingView(options);
  const tracker = new PokydLoadingTracker({
    onChange: (state: PokydLoadingState): void => {
      view.update(state);
      if (options.onChange) options.onChange(state);
    },
  });
  const detach = tracker.attach(source);
  parent.appendChild(view.element);

  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    detach();
    tracker.finish();
  };

  return {
    tracker,
    view,
    finish,
    remove: (): void => { finish(); view.remove(); },
  };
}
