/* IQ Pokyd - src/app/chat.ts - the author's main window, holding a conversation.

   Phase 6.3 of PLAN.md.  Phase 5.1 put the plainest possible chat page here and
   said phase 6 would replace it rather than wrap it; this is that replacement.
   What the engine does is unchanged -- src/web/client.ts, src/web/cache.ts and
   src/web/loading.ts are used exactly as phases 4 and 5 left them -- and what
   changed is everything a visitor sees.

   **The layout is not invented, and it is not in IQPokyd.rc either.**  The
   template gives the inventory and nothing else: IDD_HLAVNI_OKNO has eight
   controls and the conversation is not one of them.  The conversation is a
   hundred STATIC children created at runtime by
   PREFORMATUJ_TEXTY_CLOVEKA_A_POCITACE_NA_OBRAZOVCE (PROSTRED.FU:904), and the
   eight that *are* in the template are re-anchored the first time the window is
   sized by PREKRESLI_PRVKY_V_OKNE_PRI_ZMENE_VELIKOSTI (:1022).  So the numbers
   below come from those two functions, through WINDOW_LAYOUT and PALETTE in
   src/app/resources.ts, and every one of them is a named constant there rather
   than a literal here.

   Four things that took reading the engine to get right, each of them one
   declaration in src/app/chat.css:

     - **the transcript grows upwards, and in 2005 it was cut off at the top.**
       :923-924 set the box, :944 walks the sentences newest-first from the
       bottom, and :962 breaks out of the loop the moment one would cross the top
       inset.  There was no scrollbar and the height of the window *was* how much
       history there was.  **Phase 6.5 kept everything about that except the
       last clause**: the box scrolls, and it is the one deliberate deviation in
       the window.  The resting view is his to the pixel, because `scrollToEnd`
       below pins it there after every sentence; what a visitor who drags
       upwards now reaches is the hundred of `g_poslednich100vet` rather than
       nothing.  `src/app/chat.css` has the reasoning and PLAN.md 6.5 has the
       argument.
     - **the wrap is 15 px narrower than the box**, and the author did not know
       why either: "rezerva (nevim, proc musi byt, ale jinak to obcas zalomi
       zbytecne!!!)", :856.
     - **the background is stretched, not tiled**: PREKRESLI_OBRAZOVKU (:827)
       reloads IDB_POZADIHLAVNIHOOKNA at okno.right x okno.bottom on every
       resize, so a 900x459 photograph takes whatever shape the window is.
       IDB_POZADIMALE is the opposite -- CreatePatternBrush at :348 -- and tiles
       behind the sub-window, which here is the loading dialog.
     - **the colours are COLORREFs**, 0x00BBGGRR, and PALETTE has already turned
       them round: what you say is yellow, what IQ Pokyd says is green.
       VRAT_BARVU_TEXTU (:108) is what picks between them, off `puvodcevety`.

   The line you type into is the one control that keeps a background of its own:
   CMfcDlg::OnCtlColor (mfcDlg.cpp:917-922) gives CTLCOLOR_EDIT the near-black
   g_barvapozadizadavanivety and the same yellow the human's sentences are in.

   mountChat(document.body, urls) is still the whole of using it, and the four
   states are still published as `data-state` on the root.

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code -- every Czech letter the visitor sees is read from
   src/app/resources.ts, which is generated from the author's own CP1250 bytes.
*/

import { PokydClient } from "../web/client.ts";
import { mountLoading } from "../web/loading.ts";
import { startCached } from "../web/cache.ts";
import type { PokydCacheReport, PokydCachedStartOptions } from "../web/cache.ts";
import type { PokydSettings } from "../web/protocol.ts";

import { DIALOGS, PALETTE, WINDOW_LAYOUT, dluToPx } from "./resources.ts";
import { BITMAP_ASSETS } from "./assets.ts";
import { mountMenu } from "./menu.ts";
import { settingsCaption } from "./caption.ts";
import { openingGreeting } from "./greeting.ts";
import { dialogBaseUnits, emForCellHeight } from "./dlu.ts";

/* ----------------------------------------------------- the author's strings */

/* IDD_HLAVNI_OKNO, read rather than copied.  Phase 5.1 had these three as
   literals with the .rc line numbers beside them; 6.1 made the file a module,
   so the literals are gone and a caption that moved in the archive moves here. */
const MAIN = DIALOGS["IDD_HLAVNI_OKNO"];

function control(id: string) {
  const found = MAIN.controls.find((c) => c.id === id);
  if (found === undefined) throw new Error(id + " is not in IDD_HLAVNI_OKNO");
  return found;
}

const INPUT = control("IDC_VETA");
const SEND = control("IDC_NOVAVETA");
const LABEL = control("IDC_NAPISTVAVETA");
const HEADING_LEFT = control("IDC_NADPIS1");    /* Ales Janda */
const HEADING_TITLE = control("IDC_NADPIS2");   /* the title in the middle */
const HEADING_RIGHT = control("IDC_NADPIS3");   /* KYBLSoft 2005 */

/* Ours, and the only two strings on the page that are not the author's: he had
   a MessageBox for this and a BEZ_PROSTREDI build has neither. */
const FAILED_TITLE = "IQ Pokyd se nespustil.";           /* "did not start" */
const FAILED_SAY = "(IQ Pokyd neodpověděl.)";  /* "did not answer" */

/* Phase 6.5, and the third -- but the only one of the three that never reaches
   the screen.  Making the transcript scrollable made it a focusable region (see
   `transcript.tabIndex` below), and a focusable region needs a name; nothing but
   assistive technology ever reads this one.  The word is the author's own for
   the thing, out of IDD_NASTAVENI's "Ukladat rozhovor do souboru". */
const TRANSCRIPT_LABEL = "Rozhovor";

/* mfcDlg.cpp:1005.  The one command in IDR_MENU that phase 6.3 can honour --
   the rest open dialogs that belong to phases 7 and 8, and src/app/menu.ts
   greys out anything with no handler.  His spelling, his scheme. */
const HOMEPAGE = "http://iqpokyd.kyblsoft.cz";

/* The fonts, and the whole of the font work in this phase: iqpokyd.ttf turned
   out to be a .FOT stub pointing at Microsoft's Arial CE Bold Italic, which is
   not in the archive, and every face the program actually asks for is a Windows
   face (phase 6.2).  So these are stacks, and src/app/dlu.ts measures whichever
   one the visitor really got -- which is the point: the author's lfHeight of 20
   is a *cell* height, so a fallback face lands on his 20 pixels too. */
const SANS = "\"Trebuchet MS\", \"Lucida Grande\", \"Lucida Sans Unicode\", "
  + "\"DejaVu Sans\", Verdana, sans-serif";
const SERIF = "Garamond, \"EB Garamond\", \"Palatino Linotype\", Palatino, "
  + "\"Book Antiqua\", Georgia, serif";

/* ------------------------------------------------------------- the options */

export interface PokydChatOptions extends PokydCachedStartOptions {
  /** Where src/web/worker.ts and build/wasm/pokyd.mjs are served from.
   *
   *  Required, with no default, and that is the interesting part: a default
   *  would have to be written `new URL("../web/worker.ts", import.meta.url)`,
   *  and Vite rewrites exactly that expression at build time into an emitted
   *  asset -- so the bundle would carry a second, unbundled copy of the worker
   *  and of the 137 KB Emscripten glue whether or not anything ever loaded
   *  them.  Where the two files landed is a property of the build, so the
   *  caller that knows where says so: src/app/main.ts for the exhibit, and the
   *  page itself for a test served by test/browser.mjs. */
  workerUrl: string | URL;
  moduleUrl: string | URL;
  /** `prikaz_nezobrazovatpozadi`, the author's own `-bezpozadi` switch
   *  (PROSTRED.FU:100, :337).  Black instead of the photograph, and the standard
   *  3D face instead of the grey tile.  Phase 7.1 turns it into a checkbox;
   *  until then src/app/main.ts reads it off the query string, which is the
   *  nearest thing a page has to a command line. */
  noBackground?: boolean;
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

/* ------------------------------------------------------------ the mounting */

export function mountChat(
  parent: Element,
  options: PokydChatOptions,
): PokydChatHandle {
  const { workerUrl, moduleUrl, onState, noBackground, ...startOptions } = options;

  /* --------------------------------------------------------- the dimensions */

  /* MapDialogRect, with the base units measured off the face the visitor got
     rather than the one the author had.  Only three of the template's numbers
     survive the resize handler: the input's left edge, the gap it keeps on its
     right, and the heights of the three controls on the bottom row -- the rest
     is re-anchored in pixels against the client rectangle. */
  const base = dialogBaseUnits(SANS, MAIN.font!.size);
  const px = (rect: { x: number; y: number; cx: number; cy: number }) =>
    dluToPx(rect, base);

  const inputBox = px(INPUT.rect);
  const sendBox = px(SEND.rect);
  const labelBox = px(LABEL.rect);
  /* PREKRESLI_PRVKY_V_OKNE_PRI_ZMENE_VELIKOSTI:1065 widens the edit by exactly
     the change in window width, so what stays constant is the gap on its right
     -- the template's own 324 - (46 + 215) = 63 dialog units. */
  const inputGap = px({
    x: 0, y: 0, cx: MAIN.rect.cx - (INPUT.rect.x + INPUT.rect.cx), cy: 0,
  }).width;

  const { margin, spacing, transcript: box } = WINDOW_LAYOUT;

  /* --------------------------------------------------------------- the DOM */

  const element = document.createElement("div");
  element.className = "pokyd";
  element.dataset["state"] = "loading";
  if (noBackground === true) element.dataset["background"] = "off";

  /* Everything the stylesheet needs that only this file can know: two URLs the
     bundler fingerprinted, and five measurements. */
  const style = element.style;
  style.setProperty("--pokyd-sans", SANS);
  style.setProperty("--pokyd-serif", SERIF);
  style.setProperty("--pokyd-photo",
    "url(" + BITMAP_ASSETS["IDB_POZADIHLAVNIHOOKNA"].url + ")");
  style.setProperty("--pokyd-tile",
    "url(" + BITMAP_ASSETS["IDB_POZADIMALE"].url + ")");
  /* PROSTRED.PR:12-17, already turned round from 0x00BBGGRR by resources.ts.
     They are set from the module rather than written into the stylesheet so
     that there is still exactly one place they live: test/app/resources.test.ts
     reads PALETTE back out of the engine source, so a colour that moves in
     PROSTRED.PR moves on the page and is noticed by a test. */
  style.setProperty("--pokyd-window-bg", PALETTE.windowBackground);
  style.setProperty("--pokyd-window-text", PALETTE.windowText);
  style.setProperty("--pokyd-human-text", PALETTE.humanText);
  style.setProperty("--pokyd-pokyd-text", PALETTE.pokydText);
  style.setProperty("--pokyd-heading-text", PALETTE.headingText);
  style.setProperty("--pokyd-title-text", PALETTE.titleText);
  style.setProperty("--pokyd-input-bg", PALETTE.inputBackground);
  style.setProperty("--pokyd-margin", margin + "px");
  style.setProperty("--pokyd-spacing", spacing + "px");
  style.setProperty("--pokyd-box-side", box.left + "px");
  style.setProperty("--pokyd-box-top", box.top + "px");
  style.setProperty("--pokyd-box-bottom", box.bottom + "px");
  /* lfHeight = 20 at PROSTRED.FU:918 is a cell height, and :951 then counts the
     layout in it: vyskaznaku is GetTextExtentPoint32("a").cy, one line. */
  style.setProperty("--pokyd-turn-size",
    emForCellHeight(SANS, WINDOW_LAYOUT.transcriptFont.lfHeight).toFixed(2) + "px");
  style.setProperty("--pokyd-turn-line",
    WINDOW_LAYOUT.transcriptFont.lfHeight + "px");
  /* mfcDlg.cpp:370-383: negative lfHeights, so these two are em sizes as they
     stand and need no measuring. */
  style.setProperty("--pokyd-heading-size",
    -WINDOW_LAYOUT.headingFont.lfHeight + "px");
  style.setProperty("--pokyd-heading-weight",
    String(WINDOW_LAYOUT.headingFont.weight));
  style.setProperty("--pokyd-title-size",
    -WINDOW_LAYOUT.titleFont.lfHeight + "px");
  style.setProperty("--pokyd-title-weight",
    String(WINDOW_LAYOUT.titleFont.weight));
  style.setProperty("--pokyd-input-left", inputBox.x + "px");
  style.setProperty("--pokyd-input-gap", inputGap + "px");
  style.setProperty("--pokyd-input-height", inputBox.height + "px");
  style.setProperty("--pokyd-send-width", sendBox.width + "px");
  style.setProperty("--pokyd-send-height", sendBox.height + "px");
  style.setProperty("--pokyd-label-height", labelBox.height + "px");

  /* The menu bar is outside the client rectangle, which is why it is outside
     the element the background is painted on. */
  const menu = mountMenu(element, {
    commands: {
      /* JDI_NA_WWW_STRANKU, mfcDlg.cpp:1005.  His URL, his scheme. */
      ID_NAPOVEDA_INTERNET: (): void => {
        window.open(HOMEPAGE, "_blank", "noopener,noreferrer");
      },
    },
  });

  /* GetClientRect: everything below the menu, and what PREKRESLI_OBRAZOVKU
     stretches the photograph across. */
  const client = document.createElement("div");
  client.className = "pokyd-client";

  const headings = document.createElement("div");
  headings.className = "pokyd-headings";

  const makeHeading = (
    id: string, text: string, className: string,
  ): HTMLElement => {
    const span = document.createElement("span");
    span.className = className;
    span.dataset["control"] = id;
    span.textContent = text;
    return span;
  };
  headings.append(
    makeHeading("IDC_NADPIS1", HEADING_LEFT.text!, "pokyd-heading-left"),
    makeHeading("IDC_NADPIS3", HEADING_RIGHT.text!, "pokyd-heading-right"),
    /* Last of the three, and in its own box: the author centres it inside
       [0, right - OKRAJE] rather than inside the window (:1073), so it sits
       half the margin to the left of true centre.  A box that stops short of
       the right margin and centres its text is that arithmetic exactly. */
    makeHeading("IDC_NADPIS2", HEADING_TITLE.text!, "pokyd-title"),
  );

  const transcript = document.createElement("ol");
  transcript.className = "pokyd-transcript";
  /* The engine answers at its own pace and the visitor is looking at the input,
     not at the list, so the answer has to announce itself. */
  transcript.setAttribute("aria-live", "polite");
  /* Phase 6.5, and the other half of making the box scrollable: a scroll
     container that cannot be focused cannot be scrolled with the keyboard in
     Chrome, which would leave the history reachable by mouse alone. */
  transcript.tabIndex = 0;
  transcript.setAttribute("aria-label", TRANSCRIPT_LABEL);

  const form = document.createElement("form");
  form.className = "pokyd-form";

  const label = document.createElement("label");
  label.className = "pokyd-label";
  label.htmlFor = "pokyd-veta";
  label.textContent = LABEL.text!;

  /* IDC_VETA is an ES_AUTOHSCROLL edit with no length of its own, and
     pokyd_say copies into a buffer the API sizes -- so there is no cap to put
     here that the engine does not already have. */
  const input = document.createElement("input");
  input.className = "pokyd-input";
  input.id = "pokyd-veta";
  input.type = "text";
  input.autocomplete = "off";
  input.disabled = true;

  /* mfcDlg.cpp:421 hangs IDI_TVAR on this button with CButton::SetIcon, but the
     template is a DEFPUSHBUTTON with text and no BS_ICON, so what a person saw
     in 2005 is the word.  That is what is drawn here. */
  const send = document.createElement("button");
  send.className = "pokyd-send";
  send.type = "submit";
  send.textContent = SEND.text!;
  send.disabled = true;

  const failure = document.createElement("p");
  failure.className = "pokyd-failure";
  failure.hidden = true;

  /* Where IDD_NACITANI goes while it is on the screen.  mountLoading appends to
     whatever it is handed, and the author's loading dialog is a sub-window --
     Nacitani.cpp:77 returns g_stetecpozadipodokna, the IDB_POZADIMALE tile --
     so this is the slot that wears it. */
  const loadingSlot = document.createElement("div");
  loadingSlot.className = "pokyd-loading-slot";

  /* IDC_EFEKTPROGRES1 and IDC_EFEKTPROGRES2: two 6-pixel vertical bars down the
     window's edges, positioned at :1053-1059.  The template leaves out
     WS_VISIBLE and NASTAV_VIDITELNOST_EFEKTNICH_PROGRESSBARU (:163) only shows
     them when pouzivatefekty is 1, which NASTAV_STANDARDNE sets to 0.  They are
     in the DOM because they are two of the eight controls; VLAKNO__EFEKTY, which
     is what makes them move, is not this phase's. */
  const effects = ["IDC_EFEKTPROGRES1", "IDC_EFEKTPROGRES2"].map((id) => {
    const bar = document.createElement("div");
    bar.className = "pokyd-effect";
    bar.dataset["control"] = id;
    bar.hidden = true;
    return bar;
  });

  form.append(label, input, send);
  client.append(...effects, headings, transcript, form, loadingSlot, failure);
  element.appendChild(client);
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

  /** ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI, which the author called after every
   *  sentence because nalada moves on its own: it is recomputed from naladabody
   *  after each answer (INTELIG.FU:532), so a civil conversation visibly talks
   *  IQ Pokyd into a better mood.  A settings read that fails leaves the caption
   *  where it was; it is a status line, not the conversation.
   *
   *  It hands the settings back because phase 6.4 wants the same read: the
   *  greeting is inflected for the two pohlavi, and one round trip is enough
   *  for both. */
  async function refreshCaption(): Promise<PokydSettings | null> {
    let settings: PokydSettings;
    try {
      settings = await pokyd.getSettings();
    } catch {
      return null;      /* deliberately nothing */
    }
    try {
      menu.setCaption(settingsCaption(settings));
    } catch {
      /* charakter or nalada out of range: keep the caption we had */
    }
    return settings;
  }

  /** Phase 6.5.  The box scrolls now, and this is what keeps the view his: the
   *  newest sentence at the bottom, which is where PREFORMATUJ_TEXTY_...:944
   *  started drawing and worked backwards from.  `scrollTop` past the maximum
   *  is clamped by the browser, so the arithmetic does not have to be exact,
   *  and a box that does not overflow ignores it entirely. */
  function scrollToEnd(): void {
    transcript.scrollTop = transcript.scrollHeight;
  }

  function turn(who: "human" | "pokyd", text: string): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "pokyd-turn";
    li.dataset["who"] = who;

    /* Not the author's, and not on the screen either.  IQ Pokyd told the two
       apart by colour alone -- VRAT_BARVU_TEXTU (PROSTRED.FU:108) reads
       `puvodcevety` and hands back yellow or green -- but colour is not a
       transcript: test/golden/rozhovor.txt is written with these two
       characters, and so is the conversation IQPOKYD's own KYDY.TXT keeps.  So
       they are in the markup, out of the accessibility tree, and hidden by the
       stylesheet, which leaves the window looking like his. */
    const marker = document.createElement("span");
    marker.className = "pokyd-marker";
    marker.textContent = who === "human" ? ">" : "<";
    marker.setAttribute("aria-hidden", "true");

    const body = document.createElement("span");
    body.className = "pokyd-text";
    body.textContent = text;

    li.append(marker, body);
    transcript.appendChild(li);

    /* g_poslednich100vet holds a hundred sentences and RozvrzeniVet::PRIDEJ_VETU
       (IQPWAV.PR:85) shifts the oldest out; both speakers' lines go into the
       same hundred.  Since 6.5 that is the *only* forgetting the window does --
       his second one, :962's refusal to draw above the top inset, is now a
       scroll rather than a loss -- so the hundred is exactly how far back a
       visitor can drag. */
    while (transcript.childElementCount > WINDOW_LAYOUT.transcriptCapacity) {
      transcript.firstElementChild!.remove();
    }

    /* And the newest sentence is at the bottom of the box with the scroll at
       the bottom too, which is what makes a scrollable box look like his.  It
       is unconditional on purpose: :944 always drew from the newest backwards,
       so there was never a state in which a new sentence arrived out of view. */
    scrollToEnd();
    return li;
  }

  function fail(error: Error): void {
    setState("failed");
    failure.hidden = false;
    failure.textContent = FAILED_TITLE + " " + error.message;
  }

  /* -------------------------------------------------------------- the engine */

  const pokyd = new PokydClient({ workerUrl, moduleUrl });

  /* mountLoading listens to the engine's console; finish() stops it, because the
     engine goes on printing all through the conversation (VSTUP.FU:801-809).
     In a finally, not after: a load that throws should take its loading window
     with it rather than leave a bar stopped at 41% on the screen. */
  const loading = mountLoading(loadingSlot, pokyd);

  const ready = (async (): Promise<PokydCacheReport> => {
    try {
      /* srand(time(NULL)): mfcDlg.cpp:363, and again at PROSTRED.FU:307, where
         the greeting is drawn.  Without it a visit off the cache would hold the
         same conversation every time -- nothing else seeds a warm start, and the
         cold path's own reseed (SLOVNIK.FU:1732) never happens on one. */
      const seed = startOptions.seed ?? Math.floor(Date.now() / 1000);
      const report = await startCached(pokyd, { ...startOptions, seed });
      setState("ready");
      const settings = await refreshCaption();
      /* NAPIS_UVODNI_UVITANI, mfcDlg.cpp:443 -- one turn on the screen that
         nobody typed anything to get.  He drew it *before* NactiSlovniky(), so
         it was on the window while the dictionary inflected; here it waits for
         the load, because the two pohlavi that inflect it are the engine's and
         the page cannot ask until the engine is up.  The number it is picked
         with is not the engine's rand() and never was -- see
         src/app/greeting.ts. */
      if (settings !== null) turn("pokyd", openingGreeting(seed, settings));
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
      const answer = await pokyd.say(sentence);
      turn("pokyd", answer);
      setState("ready");
      await refreshCaption();
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
    client: pokyd,
    ready,
    say,
    state: (): PokydChatState => state,
    close: async (): Promise<void> => {
      loading.remove();
      loadingSlot.remove();
      menu.remove();
      try {
        await ready;
        await pokyd.close();
      } catch {
        /* A load that never finished has nothing to tear down -- pokyd_api.h,
           and src/web/engine.ts refuses the call rather than let the engine
           abort on it. */
        pokyd.terminate();
      }
      element.remove();
    },
  };
}
