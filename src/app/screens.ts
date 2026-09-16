/* IQ Pokyd - src/app/screens.ts - IDD_TEXT and IDD_ABOUTBOX, drawn.

   Phase 8.2 of PLAN.md.  src/app/help.ts holds the words; this holds the two
   windows they go in, and the split is the one the port has made three times
   already -- the file with the DOM in it is the file a node test cannot have.

   **IDD_TEXT is a rich edit and nothing else.**  Two controls: a RICHEDIT with
   ES_READONLY | WS_VSCROLL and an OK button under it.  CText::OnInitDialog
   (!Prostre/Text.cpp:48) sets the caption, hands the text to
   NAPIS_FORMATOVANY_TEXT_NAPOVEDY and gets out of the way.  So the window is
   four numbers out of the resource script and the interesting half is what that
   function does to the text, which is `markup()` in src/app/help.ts: this file
   turns each of its runs into a <span> and the four flags into four
   declarations.  Their values are the author's own EM_SETCHARFORMAT arguments,
   in twips where he used twips:

       <b>  FW_BOLD                  font-weight: bold
       <u>  CFU_UNDERLINEDOUBLE      a double underline, not a single one
       <c>  crBackColor 0x00FFE0D0   #d0e0ff -- a COLORREF, so byte-reversed
       <h>  yHeight 350 against 220  17.5pt against 11pt

   The edit is white (g_stetecbilepozadi, Text.cpp:76) and the rest of the
   dialog wears the grey tile, like every other sub-window of his.

   **IDD_ABOUTBOX is thirteen controls and two of them are filled in code.**
   The template has the whole of it -- the KYBLSoft logo, the two group boxes,
   the copyright line, ":: freeware ::", "1. vydani", the web and e-mail
   addresses -- and CAboutDlg::OnInitDialog (mfcDlg.cpp:669) adds three fonts
   and the paragraph of thanks.  All three fonts are his and are set here the
   same way: Times New Roman at lfHeight -12 on IDC_PODEKOVANI, Courier New at
   a *positive* lfHeight of 20 and FW_BLACK on IDC_NADPIS -- a cell height, so
   it goes through emForCellHeight like the transcript's font in
   src/app/chat.ts -- and an underline on IDC_INTERNET.

   **The one thing that is not honoured is that underline's click.**
   ON_BN_CLICKED(IDC_INTERNET, OnKliknutiNaInternet) opened
   http://iqpokyd.kyblsoft.cz (mfcDlg.cpp:1009), and that address has not
   answered in twenty years.  Phase 8.2 dropped the menu item that did the same
   thing -- DROPPED_COMMANDS in src/app/caption.ts has the argument -- and
   dropping one while keeping the other would be pointless.  So the address is
   still on the screen in his blue and his underline, and it is text.

   Written by us, not ported.  English identifiers and ASCII only; every Czech
   letter drawn here comes from src/app/resources.ts or src/app/help.ts.
*/

import { DIALOGS, dluToPx } from "./resources.ts";
import type { DialogBaseUnits, RcDialog } from "./resources.ts";
import { BITMAP_ASSETS } from "./assets.ts";
import { dialogBaseUnits, emForCellHeight } from "./dlu.ts";
import {
  DIALOG_CLASS, DIALOG_FONT, controlOf, makeStatic, mountFrame, placeControl,
} from "./frame.ts";
import { markup } from "./help.ts";

/* ------------------------------------------------------------ the two fonts */

/** mfcDlg.cpp:698 -- IDC_PODEKOVANI is Times New Roman.  A stack, for the same
 *  reason every other font in this port is one. */
const SERIF = "\"Times New Roman\", \"Liberation Serif\", Georgia, serif";

/** mfcDlg.cpp:723 -- IDC_NADPIS is Courier New, FW_BLACK, lfHeight 20.  A
 *  positive lfHeight is a *cell* height, so the em size that produces it has to
 *  be measured; :721 is the number, not the answer. */
const MONO = "\"Courier New\", \"Liberation Mono\", monospace";

/* ------------------------------------------------------------------ IDD_TEXT */

export interface PokydTextOptions {
  /** `dlg.nadpis` -- what CText::OnInitDialog puts in the title bar. */
  caption: string;
  /** `dlg.text`, tags and all.  markup() is what reads them. */
  text: string;
  /** OK, the X, or Escape.  CText has one button and it closes the window
   *  (Text.cpp:71), so there is only ever the one way out. */
  onClose(): void;
  /** IDD_TEXT by default; a test can hand in another. */
  dialog?: RcDialog;
}

export interface PokydScreenHandle {
  element: HTMLElement;
  /** Take it off the page without running the handler. */
  remove(): void;
}

export function mountText(
  parent: Element, options: PokydTextOptions,
): PokydScreenHandle {
  const dialog = options.dialog ?? DIALOGS["IDD_TEXT"]!;
  const base = dialogBaseUnits(DIALOG_FONT, dialog.font!.size);
  const size = dluToPixels(dialog, base);

  const button = controlOf(dialog.controls, "IDC_BUTTON", dialog.id);
  const edit = controlOf(dialog.controls, "IDC_TEXT", dialog.id);

  /* CText::OnClose, Text.cpp:71: every way out of this window is the same
     WM_CLOSE.  It takes the window off the page *and* tells the caller, which
     is why nothing below hands `options.onClose` to anything directly -- a
     handler that only reported would leave the dialog on the screen. */
  let close = (): void => {};

  const frame = mountFrame(parent, {
    /* The caption is the *caller's*, not the template's: CText is one dialog
       used for two screens and SetWindowText(nadpis) is the first thing
       OnInitDialog does (Text.cpp:52). */
    caption: options.caption,
    /* IDD_TEXT has no IDCANCEL -- the one button is IDC_BUTTON and it says OK,
       so that is the name the close box carries. */
    closeLabel: button.text ?? "OK",
    width: size.width,
    height: size.height,
    fontSize: dialog.font!.size,
    onCancel: (): void => { close(); },
    modifier: DIALOG_CLASS + "--text",
  });

  close = (): void => {
    frame.close();
    options.onClose();
  };

  /* The RICHEDIT.  ES_READONLY | WS_VSCROLL, so it scrolls and nothing can be
     typed into it; tabIndex keeps it reachable by keyboard, which a scrollable
     region in Chrome needs -- the same point phase 6.5 made about the
     transcript. */
  const view = document.createElement("div");
  view.className = DIALOG_CLASS + "-richedit " + DIALOG_CLASS + "-item";
  view.tabIndex = 0;
  view.setAttribute("role", "document");
  for (const run of markup(options.text)) {
    const span = document.createElement("span");
    if (run.bold) span.classList.add(DIALOG_CLASS + "-b");
    if (run.underline) span.classList.add(DIALOG_CLASS + "-u");
    if (run.highlight) span.classList.add(DIALOG_CLASS + "-c");
    if (run.large) span.classList.add(DIALOG_CLASS + "-h");
    /* His \r\n are line breaks in a rich edit; `white-space: pre-wrap` in the
       stylesheet is what makes them line breaks here, so the text goes in as
       text and nothing has to be split. */
    span.textContent = run.text;
    view.appendChild(span);
  }
  placeControl(view, edit.rect, base, edit.id);

  const ok = document.createElement("button");
  ok.type = "button";
  ok.className = DIALOG_CLASS + "-button " + DIALOG_CLASS + "-item";
  ok.textContent = button.text ?? "OK";
  placeControl(ok, button.rect, base, button.id);
  ok.addEventListener("click", (): void => { close(); });

  frame.body.append(view, ok);
  ok.focus();

  return { element: frame.element, remove: frame.close };
}

/* -------------------------------------------------------------- IDD_ABOUTBOX */

export interface PokydAboutOptions {
  /** The paragraph CAboutDlg::OnInitDialog puts in IDC_PODEKOVANI -- THANKS in
   *  src/app/help.ts.  Passed in rather than imported so that this file draws
   *  and does not also decide. */
  thanks: string;
  onClose(): void;
  /** IDD_ABOUTBOX by default. */
  dialog?: RcDialog;
}

export function mountAbout(
  parent: Element, options: PokydAboutOptions,
): PokydScreenHandle {
  const dialog = options.dialog ?? DIALOGS["IDD_ABOUTBOX"]!;
  const base = dialogBaseUnits(DIALOG_FONT, dialog.font!.size);
  const size = dluToPixels(dialog, base);

  const okButton = controlOf(dialog.controls, "IDOK", dialog.id);

  /* The same rule as CText above: OK, the X and Escape are one command, and it
     closes the window as well as reporting it. */
  let close = (): void => {};

  const frame = mountFrame(parent, {
    caption: dialog.caption!,
    closeLabel: okButton.text ?? "OK",
    width: size.width,
    height: size.height,
    fontSize: dialog.font!.size,
    onCancel: (): void => { close(); },
    modifier: DIALOG_CLASS + "--about",
  });

  close = (): void => {
    frame.close();
    options.onClose();
  };

  let okNode: HTMLButtonElement | null = null;

  for (const rc of dialog.controls) {
    let node: HTMLElement;

    if (rc.id === "IDC_PODEKOVANI") {
      /* ES_MULTILINE | ES_READONLY | WS_VSCROLL, filled at :705.  A read-only
         multi-line edit that scrolls is a scrollable box, so it is one; it is
         not an <input> and it is not editable. */
      const box = document.createElement("div");
      box.className = DIALOG_CLASS + "-thanks";
      box.tabIndex = 0;
      box.style.fontFamily = SERIF;
      /* lfHeight -12: negative, so it is already an em size. */
      box.style.fontSize = "12px";
      box.textContent = options.thanks;
      node = box;
    } else if (rc.class === "Static" && rc.styles.includes("SS_BITMAP")) {
      /* CONTROL ... #139, which is IDB_KYBLSOFT -- the logo, and the only
         picture in this dialog.  The template's rectangle is 66x22 dialog
         units and the bitmap is 132x44 pixels; it is drawn to the rectangle,
         which is what a SS_BITMAP static does. */
      const symbol = rc.textResource?.symbol ?? null;
      const asset = symbol === null ? undefined : BITMAP_ASSETS[symbol];
      const img = document.createElement("img");
      if (asset !== undefined) img.src = asset.url;
      img.alt = "KÝBLSoft";
      node = img;
    } else if (rc.kind === "GROUPBOX") {
      const group = document.createElement("fieldset");
      group.className = DIALOG_CLASS + "-group";
      const legend = document.createElement("legend");
      legend.textContent = rc.text ?? "";
      if ((rc.text ?? "") === "") legend.hidden = true;
      group.appendChild(legend);
      node = group;
    } else if (rc.kind === "PUSHBUTTON" || rc.kind === "DEFPUSHBUTTON") {
      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = DIALOG_CLASS + "-button";
      if (rc.kind === "DEFPUSHBUTTON") ok.classList.add(DIALOG_CLASS + "-default");
      ok.textContent = rc.text ?? "OK";
      ok.addEventListener("click", (): void => { close(); });
      okNode = ok;
      node = ok;
    } else {
      node = makeStatic(rc);
      if (rc.id === "IDC_NADPIS") {
        /* :718-726.  Courier New, FW_BLACK, and lfHeight 20 is a cell height:
           measure the face the visitor got and the 20 pixels come out right. */
        node.style.fontFamily = MONO;
        node.style.fontWeight = "900";
        node.style.fontSize = emForCellHeight(MONO, 20).toFixed(2) + "px";
      }
      if (rc.id === "IDC_INTERNET") {
        /* :679-683 and :931: underlined, and blue -- 0x00FF0000 is a COLORREF,
           so it is #0000ff and not red.  Not a link; see the header. */
        node.classList.add(DIALOG_CLASS + "-www");
      }
    }

    node.classList.add(DIALOG_CLASS + "-item");
    placeControl(node, rc.rect, base, rc.id);
    frame.body.appendChild(node);
  }

  if (okNode !== null) okNode.focus();

  return { element: frame.element, remove: frame.close };
}

/* ------------------------------------------------------------------ the size */

/** The dialog's own rectangle in pixels.  Neither of these two drops anything
 *  off the top, so unlike src/app/dialog.ts it is the template's own. */
function dluToPixels(dialog: RcDialog, base: DialogBaseUnits): {
  width: number; height: number;
} {
  return dluToPx(dialog.rect, base);
}
