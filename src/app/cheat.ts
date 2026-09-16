/* IQ Pokyd - src/app/cheat.ts - IDD_DEBUGNASTAVENI, drawn.

   Phase 8.4 of PLAN.md.  src/app/debug.ts is CDebugNastaveni with the window
   taken off; this is the window, and between them they are
   !Prostre/debugnastaveni.cpp.  Same split as src/app/settings.ts and
   src/app/dialog.ts, same reason.

   **The layout is the resource script's, all of it.**  IDD_DEBUGNASTAVENI is
   274x159 dialog units of 10-point System, and unlike IDD_NASTAVENI there is
   nothing to drop: every one of its sixteen controls is live.  The report on
   the left is a read-only multi-line EDITTEXT, the mood is a nine-character
   edit, and the right-hand side is a check box and two radio groups.

   **Nothing is greyed and nothing is missing**, which makes this the only one
   of his four dialogs the port draws whole.  What made that possible is
   pokyd_debug_info (src/api/pokyd_api.h) -- the ten globals the report prints
   live inside the engine's own translation unit, and phase 8.4 is the first
   thing that needed them outside it.

   **The one MessageBox that is a question, not an answer.**  OnOK asks before
   saving a change to the three parameters that alter how the engine reads a
   sentence (debugnastaveni.cpp:218), and OK/Cancel there means *the whole of
   OnOK is abandoned*, the mood included.  So the dialog stays up, the warning
   appears over the buttons the way the two refusals do, and the second press of
   OK is the confirmation.  src/app/debug.ts returns `warns` and decides
   nothing; this is what asks.

   **The tooltips are his.**  Twelve paragraphs out of BublinkovaNapoveda, as
   `title` attributes, shown only when zobrazovatpopisky is 1 -- which is his own
   m_oNapoveda.Activate condition (:156), and the setting the report's own
   closing note is about.  They are the only tool tips anywhere in this port;
   the twenty-odd in Nastaveni.cpp are on the page phase 7.1 does not draw.

   Written by us, not ported.  English identifiers and ASCII only -- every Czech
   letter here comes from src/app/resources.ts or src/app/debug.ts.
*/

import { DIALOGS, dluToPx } from "./resources.ts";
import type { DialogBaseUnits, RcControl, RcDialog } from "./resources.ts";
import { dialogBaseUnits } from "./dlu.ts";
import {
  DIALOG_CLASS, DIALOG_FONT, controlOf, makeStatic, mountFrame, placeControl,
  renderLabel,
} from "./frame.ts";
import {
  RECURSIONS, TOLERANCES, WARNING_TITLE, edit, formFromSettings, report,
  tooltips, warningText,
} from "./debug.ts";
import type { PokydDebugEdit } from "./debug.ts";
import type { PokydDebugInfo, PokydSettings } from "../web/protocol.ts";

/* -------------------------------------------------------------- the options */

export interface PokydCheatOptions {
  /** What the engine says now.  OnInitDialog fills the four controls from it
   *  and OnOK writes its answer against it. */
  settings: PokydSettings;
  /** The snapshot the report is made of -- one pokyd_debug_info call. */
  info: PokydDebugInfo;
  /** OK, with everything OnOK worked out and the warning already agreed to.
   *  The dialog is off the page by the time this runs. */
  onAccept(result: PokydDebugEdit): void;
  /** Storno, Escape, or the close box.  IDCANCEL changes nothing. */
  onCancel?(): void;
  /** IDD_DEBUGNASTAVENI by default; a test can hand in another. */
  dialog?: RcDialog;
}

export interface PokydCheatHandle {
  element: HTMLElement;
  remove(): void;
}

/* ------------------------------------------------------------- the mounting */

export function mountCheat(
  parent: Element, options: PokydCheatOptions,
): PokydCheatHandle {
  const dialog = options.dialog ?? DIALOGS["IDD_DEBUGNASTAVENI"]!;
  const form = formFromSettings(options.settings);
  const tips = tooltips(options.settings);
  const showTips = options.settings.showLabels === 1;

  const base: DialogBaseUnits = dialogBaseUnits(DIALOG_FONT, dialog.font!.size);
  const size = dluToPx(dialog.rect, base);

  const frame = mountFrame(parent, {
    caption: dialog.caption!,
    closeLabel: controlOf(dialog.controls, "IDCANCEL", dialog.id).text ?? "Storno",
    width: size.width,
    height: size.height,
    fontSize: dialog.font!.size,
    onCancel: (): void => { cancel(); },
    modifier: DIALOG_CLASS + "--cheat",
  });

  const inputs = new Map<string, HTMLInputElement>();
  const boxes = new Map<string, HTMLElement>();

  /** BS_AUTOCHECKBOX and BS_AUTORADIOBUTTON: the same control with a different
   *  mark and, for the radios, a group. */
  function makeButton(rc: RcControl, group?: string): HTMLElement {
    const label = document.createElement("label");
    label.className = DIALOG_CLASS + "-check";
    const input = document.createElement("input");
    input.type = group === undefined ? "checkbox" : "radio";
    if (group !== undefined) input.name = group;
    input.id = "pokyd-" + rc.id.toLowerCase();
    const text = document.createElement("span");
    text.append(renderLabel(rc.text ?? "").node);
    label.append(input, text);
    inputs.set(rc.id, input);
    return label;
  }

  const toleranceIds = TOLERANCES.map(([, id]) => id);
  const recursionIds = RECURSIONS.map(([, id]) => id);

  for (const rc of dialog.controls) {
    let node: HTMLElement;

    if (rc.id === "IDC_HODNOTY") {
      /* The report.  ES_MULTILINE | ES_READONLY | WS_VSCROLL: a scrolling box
         of text, in a monospaced face because his own rules of dashes only line
         up in one. */
      const box = document.createElement("div");
      box.className = DIALOG_CLASS + "-report";
      box.tabIndex = 0;
      box.textContent = report(options.info, options.settings);
      node = box;
    } else if (rc.id === "IDC_NALADABODY") {
      const input = document.createElement("input");
      input.type = "text";
      input.className = DIALOG_CLASS + "-edit";
      input.autocomplete = "off";
      input.inputMode = "numeric";
      /* No maxLength: his edit had no EM_LIMITTEXT either, and the cut at nine
         characters happens in OnOK, where GetWindowText makes it (:196).  A
         `maxLength` here would quietly remove one of his two refusals. */
      input.id = "pokyd-" + rc.id.toLowerCase();
      inputs.set(rc.id, input);
      node = input;
    } else if (toleranceIds.includes(rc.id)) {
      node = makeButton(rc, "pokyd-tolerance");
    } else if (recursionIds.includes(rc.id)) {
      node = makeButton(rc, "pokyd-recursion");
    } else if (rc.class === "Button"
        && (rc.kind === "PUSHBUTTON" || rc.kind === "DEFPUSHBUTTON")) {
      const button = document.createElement("button");
      button.className = DIALOG_CLASS + "-button";
      button.type = rc.id === "IDOK" ? "submit" : "button";
      if (rc.kind === "DEFPUSHBUTTON") button.classList.add(DIALOG_CLASS + "-default");
      button.append(renderLabel(rc.text ?? "").node);
      node = button;
    } else if (rc.class === "Button") {
      node = makeButton(rc);
    } else {
      node = makeStatic(rc);
    }

    if (showTips && tips[rc.id] !== undefined) node.title = tips[rc.id]!;

    node.classList.add(DIALOG_CLASS + "-item");
    placeControl(node, rc.rect, base, rc.id);
    boxes.set(rc.id, node);
    frame.body.appendChild(node);
  }

  /* The refusal and the warning, over the button row: the same slot
     src/app/dialog.ts uses, and for the same reason -- that is where a visitor
     is looking when either happens. */
  const notice = document.createElement("div");
  notice.className = DIALOG_CLASS + "-refusal";
  notice.setAttribute("role", "alert");
  notice.hidden = true;
  const noticeTitle = document.createElement("strong");
  const noticeText = document.createElement("p");
  notice.append(noticeTitle, noticeText);
  frame.body.appendChild(notice);

  /* --------------------------------------------- OnInitDialog, :62-85 */

  const check = (id: string, on: boolean): void => {
    const input = inputs.get(id);
    if (input !== undefined) input.checked = on;
  };

  const moodEdit = inputs.get("IDC_NALADABODY");
  if (moodEdit !== undefined) moodEdit.value = form.moodPoints;
  check("IDC_RYCHLEUKONCOVANI", form.fastExit);
  /* His two switches have a fatal `default`; a value the archive does not know
     simply leaves the group empty here, because a dialog that cannot open is
     worse than one with nothing ticked. */
  for (const [value, id] of TOLERANCES) check(id, value === form.tolerance);
  for (const [value, id] of RECURSIONS) check(id, value === form.recursion);

  /* ------------------------------------------------------- OnOK, :186 */

  /** Whether the warning has already been shown and agreed to.  His
   *  MessageBox is modal and answers in one call; here the second press of OK
   *  is the answer, which is the only shape a page has for it. */
  let warned = false;

  function read(): { moodPoints: string; fastExit: boolean;
                     tolerance: number; recursion: number } {
    const checked = (id: string): boolean => inputs.get(id)?.checked === true;
    const pick = (table: readonly [number, string][], fallback: number): number => {
      for (const [value, id] of table) if (checked(id)) return value;
      return fallback;
    };
    return {
      moodPoints: moodEdit?.value ?? form.moodPoints,
      fastExit: checked("IDC_RYCHLEUKONCOVANI"),
      tolerance: pick(TOLERANCES, form.tolerance),
      recursion: pick(RECURSIONS, form.recursion),
    };
  }

  function accept(): void {
    const result = edit(options.settings, read());
    if (result.refused !== null) {
      /* :198 and :208: the message, then the focus, and the dialog stays. */
      noticeTitle.textContent = result.refused.title;
      noticeText.textContent = result.refused.message;
      notice.hidden = false;
      const input = inputs.get(result.refused.control);
      if (input !== undefined) { input.focus(); input.select(); }
      return;
    }
    if (result.warns && !warned) {
      /* :214-218.  MB_OKCANCEL, and Cancel abandons the whole of OnOK -- so
         nothing is applied, the dialog stays up, and pressing OK again is the
         OK of his message box. */
      warned = true;
      noticeTitle.textContent = WARNING_TITLE;
      noticeText.textContent = warningText(options.settings);
      notice.hidden = false;
      (boxes.get("IDOK") as HTMLButtonElement | undefined)?.focus();
      return;
    }
    close();
    options.onAccept(result);
  }

  function cancel(): void {
    close();
    if (options.onCancel !== undefined) options.onCancel();
  }

  /* ------------------------------------------------------- the wiring */

  frame.frame.addEventListener("submit", (event: SubmitEvent): void => {
    event.preventDefault();
    accept();
  });
  boxes.get("IDCANCEL")?.addEventListener("click", cancel);

  /* A control that moves after the warning has been agreed to un-agrees it:
     the question was about the values that were on the screen when it was
     asked. */
  for (const input of inputs.values()) {
    input.addEventListener("change", (): void => {
      if (!warned) return;
      warned = false;
      notice.hidden = true;
    });
  }

  if (moodEdit !== undefined) { moodEdit.focus(); moodEdit.select(); }

  function close(): void { frame.close(); }

  return { element: frame.element, remove: close };
}
