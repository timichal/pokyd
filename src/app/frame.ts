/* IQ Pokyd - src/app/frame.ts - the window a modal dialog of his sits in.

   Phase 8.2 of PLAN.md, and it is an extraction rather than a new idea.  Phase
   7.1 drew IDD_NASTAVENI and had to invent exactly one thing to do it -- the
   frame, because a DS_MODALFRAME | WS_CAPTION | WS_SYSMENU popup had a title
   bar, a close box and a border, and all three were the theme's rather than the
   program's.  Phase 8 has three more of his dialogs to draw -- IDD_TEXT (twice
   over), IDD_ABOUTBOX and IDD_DEBUGNASTAVENI -- and every one of them wants
   that same frame, the same Escape, the same Tab trap and the same
   MapDialogRect arithmetic.  So it lives here once, and src/app/dialog.ts is a
   caller like the other three.

   What "the same" means, precisely:

     - **the frame is ours and every word in it is his.**  The strip says the
       template's own CAPTION, and the close box carries IDCANCEL's own caption
       as its accessible name, because the X and Storno were one command.
     - **the body is the client rectangle**, and every control is placed
       absolutely inside it at the author's own dialog units, turned into pixels
       by src/app/dlu.ts against the font the visitor really got.  There is not
       one measurement in this file either.
     - **Escape is IDCANCEL and Tab cannot leave.**  ON_COMMAND(ID_ZKRATKA_
       SMAZRADEK, OnClose) is on his dialogs one by one (Nastaveni.cpp:42,
       debugnastaveni.cpp:64) and on the main window it is OnZkratkaSmazradek,
       which closes whichever of the five is open by title (mfcDlg.cpp:857-864).
       A modal that can be tabbed out of is not one.

   Written by us, not ported.  English identifiers and ASCII only -- every Czech
   letter that reaches the screen through this file arrived as an argument.
*/

import { WINDOW_LAYOUT, dluToPx } from "./resources.ts";
import type { RcControl, RcRect } from "./resources.ts";
import type { DialogBaseUnits } from "./resources.ts";

/* ----------------------------------------------------------------- the font */

/* The templates ask for 12-point "System" (IDD_NASTAVENI, IDD_ABOUTBOX,
   IDD_DEBUGNASTAVENI at 10) or 14-point Tahoma (IDD_TEXT).  Nothing has the
   first any more -- it is the bitmap face Windows dialogs wore before Tahoma --
   so this is a stack of the faces that replaced it, and it does not have to be
   the same face: only the face the base units are measured from, which is what
   MapDialogRect guarantees.  Measure the font the visitor really got and his
   rectangles come out the right size for it.  Same argument as SANS in
   src/app/chat.ts, same mechanism. */
export const DIALOG_FONT =
  "Tahoma, \"Segoe UI\", \"DejaVu Sans\", system-ui, sans-serif";

/** Every dialog in this port wears the same class family, because every one of
 *  them is the same XP window; a caller adds a modifier of its own. */
export const DIALOG_CLASS = "pokyd-dialog";

/* ------------------------------------------------------------- the fitting */

/* The one thing in this file that a 2005 desktop never had to answer: a screen
   smaller than the window.  His four dialogs are 394 to 568 pixels across and
   318 to 564 down once MapDialogRect has had the visitor's font -- a phone is
   390 by about 660 -- and IDD_TEXT does not fit either way.

   What used to happen is what `max-width`/`max-height` in src/app/chat.css did:
   the frame was cut to the screen and the body, which is `overflow: hidden`
   over absolutely placed controls, simply lost whatever was past the cut.  The
   right-hand third of the help text was not scrolled off, it was gone.

   So the window is scaled instead -- all of it, on both axes by the same
   factor, which is exactly what a visitor would do with a pinch if we let the
   page be pinched.  Nothing about his geometry changes: every rectangle is
   still MapDialogRect's, every ratio between them is still his, and on any
   screen the window already fits on the factor is 1 and there is no transform
   at all.  The margin it keeps is OKRAJE, the same fifteen pixels the main
   window holds its own headings off the edge by. */
function fitToScreen(overlay: HTMLElement, frame: HTMLElement): void {
  /* The overlay is `height: 100dvh`, so this is the band that is really on the
     screen -- and, unlike visualViewport, it does not shrink under the on-screen
     keyboard, which would otherwise squeeze the window while a name is typed. */
  const room = overlay.getBoundingClientRect();
  /* offsetWidth/offsetHeight and not getBoundingClientRect: the first pair is
     the layout box, which is what the factor has to be measured against, and
     the second is already scaled by whatever this function set last time. */
  const width = frame.offsetWidth;
  const height = frame.offsetHeight;
  if (width === 0 || height === 0 || room.width === 0 || room.height === 0) return;

  const margin = 2 * WINDOW_LAYOUT.margin;
  const factor = Math.min(1,
    (room.width - margin) / width, (room.height - margin) / height);
  frame.style.transform = factor < 1 ? "scale(" + factor.toFixed(4) + ")" : "";
}

/* --------------------------------------------------------------- the labels */

/** A caption split the way Windows reads it: `&` marks the mnemonic.  The same
 *  reading src/app/menu.ts does of a menu item, which needs the tab as well; a
 *  control's caption has no accelerator text in it. */
export function renderLabel(raw: string): { node: DocumentFragment; key: string } {
  const fragment = document.createDocumentFragment();
  const at = raw.indexOf("&");
  if (at === -1 || at === raw.length - 1) {
    fragment.append(raw);
    return { node: fragment, key: "" };
  }
  fragment.append(raw.slice(0, at));
  const mnemonic = document.createElement("u");
  mnemonic.textContent = raw[at + 1]!;
  fragment.append(mnemonic, raw.slice(at + 2));
  return { node: fragment, key: raw[at + 1]!.toLowerCase() };
}

/** A static: CTEXT centres, RTEXT is right-aligned, LTEXT is neither. */
export function makeStatic(rc: RcControl): HTMLElement {
  const span = document.createElement("span");
  span.className = DIALOG_CLASS + "-static";
  if (rc.implicitStyles.includes("SS_CENTER")) span.style.textAlign = "center";
  if (rc.implicitStyles.includes("SS_RIGHT")) span.style.textAlign = "right";
  span.append(renderLabel(rc.text ?? "").node);
  return span;
}

/* -------------------------------------------------------------- the options */

export interface PokydFrameOptions {
  /** The template's own CAPTION. */
  caption: string;
  /** IDCANCEL's caption, ampersand and all: the close box's accessible name,
   *  because the X and Storno are one command and carry one name. */
  closeLabel: string;
  /** The client rectangle in pixels -- dluToPx of the template's own, with
   *  whatever the caller has dropped off it already taken off. */
  width: number;
  height: number;
  /** The point size of the template's FONT.  The face is DIALOG_FONT. */
  fontSize: number;
  /** The X and Escape.  A frame never decides anything itself. */
  onCancel(): void;
  /** A modifier class on the root, so a stylesheet can tell the four apart. */
  modifier?: string;
}

export interface PokydFrame {
  /** The overlay: fixed, full-page, and what DoModal's grey-out stands in for. */
  element: HTMLElement;
  /** The window.  A <form> because IDOK is a DEFPUSHBUTTON and Enter has to
   *  reach it; a dialog with no default button simply never submits. */
  frame: HTMLFormElement;
  /** The client area.  Controls go in here, positioned absolutely. */
  body: HTMLElement;
  /** Take it off the page without running either handler. */
  close(): void;
}

/* ------------------------------------------------------------- the mounting */

export function mountFrame(
  parent: Element,
  options: PokydFrameOptions,
): PokydFrame {
  const element = document.createElement("div");
  element.className = DIALOG_CLASS;
  if (options.modifier !== undefined) element.classList.add(options.modifier);
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-modal", "true");
  element.setAttribute("aria-label", options.caption);

  const frame = document.createElement("form");
  frame.className = DIALOG_CLASS + "-frame";
  frame.style.width = options.width + "px";
  frame.tabIndex = -1;

  /* WS_CAPTION and WS_SYSMENU.  Ours to draw and his to say. */
  const titleBar = document.createElement("div");
  titleBar.className = DIALOG_CLASS + "-caption";
  const title = document.createElement("span");
  title.className = DIALOG_CLASS + "-title";
  title.textContent = options.caption;
  const closeBox = document.createElement("button");
  closeBox.type = "button";
  closeBox.className = DIALOG_CLASS + "-close";
  closeBox.textContent = "x";
  closeBox.setAttribute("aria-label", options.closeLabel.replace("&", ""));
  titleBar.append(title, closeBox);

  const body = document.createElement("div");
  body.className = DIALOG_CLASS + "-body";
  body.style.height = options.height + "px";
  body.style.fontFamily = DIALOG_FONT;
  body.style.fontSize = Math.round((options.fontSize * 96) / 72) + "px";

  frame.append(titleBar, body);
  element.appendChild(frame);

  /* Escape is IDCANCEL; Tab is the modal half. */
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      options.onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const reachable = Array.from(frame.querySelectorAll<HTMLElement>(
      "button, input, select, textarea"))
      .filter((el) => !(el as HTMLInputElement).disabled
        && el.offsetParent !== null);
    if (reachable.length === 0) return;
    const first = reachable[0]!;
    const last = reachable[reachable.length - 1]!;
    const active = document.activeElement;
    if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    if (event.shiftKey && (active === first || active === frame)) {
      event.preventDefault();
      last.focus();
    }
  };
  element.addEventListener("keydown", onKeyDown);
  closeBox.addEventListener("click", (): void => { options.onCancel(); });

  parent.appendChild(element);
  /* Once it is on the page and has a size, and again whenever the screen
     changes under it -- an orientation, a resized window, and on a phone the
     browser's own toolbars sliding away, which is a resize as far as `dvh` and
     this listener are concerned. */
  fitToScreen(element, frame);
  const onResize = (): void => { fitToScreen(element, frame); };
  window.addEventListener("resize", onResize);
  frame.focus();

  return {
    element,
    frame,
    body,
    close: (): void => {
      window.removeEventListener("resize", onResize);
      element.removeEventListener("keydown", onKeyDown);
      element.remove();
    },
  };
}

/* ------------------------------------------------------------ the placement */

/** MapDialogRect: absolute at the author's rectangle, in pixels, always.
 *  `shift` is however many dialog units the caller has dropped off the top --
 *  see DROPPED in src/app/dialog.ts, which is the only caller that has any. */
export function placeControl(
  node: HTMLElement, rect: RcRect, base: DialogBaseUnits,
  id: string, shift = 0,
): void {
  const box = dluToPx({ ...rect, y: rect.y - shift }, base);
  node.style.left = box.x + "px";
  node.style.top = box.y + "px";
  node.style.width = box.width + "px";
  node.style.height = box.height + "px";
  node.dataset["control"] = id;
}

/** The one control lookup every caller needs, with the author's own error. */
export function controlOf(
  controls: readonly RcControl[], id: string, where: string,
): RcControl {
  const found = controls.find((c) => c.id === id);
  if (found === undefined) throw new Error(id + " is not in " + where);
  return found;
}
