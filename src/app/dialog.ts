/* IQ Pokyd - src/app/dialog.ts - IDD_NASTAVENI, drawn.

   Phase 7.1 of PLAN.md.  src/app/settings.ts is CNastaveni with the window
   taken off; this is the window.  Between them they are Nastaveni.cpp, and the
   split is the one src/app/menu.ts and src/app/caption.ts already have: the
   file with the DOM in it is the file a node test cannot have.

   **The layout is the resource script's, this time, and all of it.**  The main
   window's was not -- IDD_HLAVNI_OKNO gives an inventory and PROSTRED.FU does
   the arithmetic (see src/app/chat.ts) -- but a modal dialog is laid out by
   MapDialogRect and nothing moves afterwards, so every rectangle below is the
   author's own dialog units out of src/app/resources.ts, turned into pixels by
   the same dluToPx and the same measured base units phase 6.3 uses.  There is
   not one measurement in this file.

   **Three things about the dialog are in Nastaveni.cpp rather than in the
   script**, and all three are ported:

     - **it has two pages.**  IDC_ZAKLADNINASTAVENI and IDC_ROZSIRENENASTAVENI
       are two buttons across the top that show one set of controls and hide the
       other (:337-424), relabelling both group boxes as they go.  They are not
       a tab control -- the author left his CTabCtrl commented out at :340 and
       :384 -- so they are drawn as what they are: two buttons, the current one
       held down with SetState(TRUE).
     - **hiding a control disables its mnemonic.**  ZOBRAZ_NA_DIALOGU_POLICKO
       (:314-335) walks the caption and swaps `&` for `~` on the way out and
       back on the way in, because an Alt+key that reaches a hidden control is a
       bug.  A browser spells that `accessKey`, so it is set when a control is
       shown and removed when it is hidden.
     - **the dialog wears the grey tile.**  OnCtlColor (:306-312) hands back
       g_stetecpozadipodokna for everything except the edits and the list boxes
       -- the IDB_POZADIMALE pattern brush, which is the same one the loading
       window wears, with SetBkMode(TRANSPARENT) over it.

   **What is ours, and it is the frame.**  Phase 6.5 refused to draw an XP title
   bar on the main window, because the page is a *maximized* window and a
   maximized window has none.  This one is a DS_MODALFRAME | WS_CAPTION |
   WS_SYSMENU popup: it did have a caption bar, a close box and a border, and
   they were the theme's rather than the program's.  So they are drawn here, in
   the same XP defaults src/app/chat.css already dresses IDR_MENU in, and they
   carry nothing invented: the strip says the template's own CAPTION and the
   close box is IDCANCEL, which is what the X did.

   The other deviation is the one MessageBox.  A two-word name got
   MB_ICONWARNING | MB_SYSTEMMODAL in 2005 (:148, :157); a browser's alert()
   blocks the whole page and the words would still be his, so the same two
   sentences are written into the dialog instead, over the buttons, and the
   focus goes to the edit he sent it to.

   Written by us, not ported.  English identifiers and ASCII only -- every Czech
   letter this file draws comes from src/app/resources.ts or from
   src/app/settings.ts, and neither of those invented one either.
*/

import { DIALOGS, dluToPx } from "./resources.ts";
import type { RcControl, RcDialog } from "./resources.ts";
import { dialogBaseUnits } from "./dlu.ts";
import {
  ADVANCED_CONTROLS, ADVANCED_GROUP_CAPTIONS, BASIC_CONTROLS,
  CHARACTERS, FEMALE, MALE, MOODS, NAME_LIMIT, edit, formFromSettings,
} from "./settings.ts";
import type { PokydSettingsEdit, PokydSettingsForm } from "./settings.ts";
import type { PokydSettings } from "../web/protocol.ts";

/* ----------------------------------------------------------------- the font */

/* The template asks for 12-point "System", the bitmap face Windows dialogs wore
   before Tahoma.  Nothing has it now, so this is a stack of the faces that
   replaced it -- and it does not have to be the same face, only the face the
   base units are measured from, which is what MapDialogRect guarantees: measure
   the font the visitor really got and his rectangles come out the right size
   for it.  Same argument as SANS in src/app/chat.ts, same mechanism. */
const DIALOG_FONT =
  "Tahoma, \"Segoe UI\", \"DejaVu Sans\", system-ui, sans-serif";

const CLASS = "pokyd-dialog";

/* ------------------------------------------------------- what is not honoured */

/* The menu greys a command with nothing behind it (src/app/menu.ts), and a
   checkbox with nothing behind it is the same promise broken quietly.  These
   five are drawn, ticked to whatever the settings say, and disabled:

     - the three keyboard controls, because EMULUJ_KLAVESNICI is a whole
       keyboard layout (VSTUP.FU) that is not ported, and a tick that did not
       change what a keystroke produces would be worse than a grey one.
     - the standard-cursor one, because the caret it switches to is the DOS
       underscore the program drew itself, and a page does not draw the caret.
     - the tool tips, because the twenty-odd bubbles are Nastaveni.cpp literals
       and nothing here shows one.

   Everything else on the dialog is live: the engine reads it, the window shows
   it, or phase 7.3 stores it. */
const UNIMPLEMENTED: readonly string[] = [
  "IDC_EMULOVATKLAVESNICI",
  "IDC_EMULOVATCESKOUKLAVESNICI",
  "IDC_EMULOVATSLOVENSKOUKLAVESNICI",
  "IDC_KLAVESNICEQWERTY",
  "IDC_ZOBRAZOVATSTANDARDNIKURZOR",
  "IDC_ZOBRAZOVATPOPISKY",
];

/* ---------------------------------------------------------------- the labels */

/** A caption split the way Windows reads it: `&` marks the mnemonic.  The same
 *  reading src/app/menu.ts does of a menu item, which needs the tab as well;
 *  a control's caption has no accelerator text in it. */
function renderLabel(raw: string): { node: DocumentFragment; key: string } {
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

/* ---------------------------------------------------------------- the options */

export interface PokydDialogOptions {
  /** What the engine says now, which is what OnInitDialog filled the controls
   *  from and what OnOK writes its answer against. */
  settings: PokydSettings;
  /** OK, with everything CNastaveni::OnOK worked out.  The dialog is already
   *  off the page by the time this runs; a name it refused never gets here. */
  onAccept(result: PokydSettingsEdit): void;
  /** Storno, Escape, or the close box.  IDCANCEL changes nothing. */
  onCancel?(): void;
  /** IDD_NASTAVENI by default; a test can hand in another. */
  dialog?: RcDialog;
}

export interface PokydDialogHandle {
  element: HTMLElement;
  /** Take it off the page without running either handler. */
  remove(): void;
}

/* ---------------------------------------------------------------- the mounting */

export function mountSettings(
  parent: Element,
  options: PokydDialogOptions,
): PokydDialogHandle {
  const dialog = options.dialog ?? DIALOGS["IDD_NASTAVENI"]!;
  const form: PokydSettingsForm = formFromSettings(options.settings);

  const base = dialogBaseUnits(DIALOG_FONT, dialog.font!.size);
  const px = (rect: { x: number; y: number; cx: number; cy: number }) =>
    dluToPx(rect, base);
  const size = px(dialog.rect);

  const control = (id: string): RcControl => {
    const found = dialog.controls.find((c) => c.id === id);
    if (found === undefined) throw new Error(id + " is not in " + dialog.id);
    return found;
  };

  /* ---------------------------------------------------------------- the frame */

  const element = document.createElement("div");
  element.className = CLASS;
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-modal", "true");
  element.setAttribute("aria-label", dialog.caption!);

  const frame = document.createElement("form");
  frame.className = CLASS + "-frame";
  frame.style.width = size.width + "px";
  frame.tabIndex = -1;

  /* WS_CAPTION and WS_SYSMENU.  Ours to draw and his to say. */
  const titleBar = document.createElement("div");
  titleBar.className = CLASS + "-caption";
  const title = document.createElement("span");
  title.className = CLASS + "-title";
  title.textContent = dialog.caption!;
  const closeBox = document.createElement("button");
  closeBox.type = "button";
  closeBox.className = CLASS + "-close";
  closeBox.textContent = "x";
  /* The X and Storno are one command, so they carry one name -- his. */
  closeBox.setAttribute("aria-label", control("IDCANCEL").text!.replace("&", ""));
  titleBar.append(title, closeBox);

  const body = document.createElement("div");
  body.className = CLASS + "-body";
  body.style.height = size.height + "px";
  body.style.fontFamily = DIALOG_FONT;
  body.style.fontSize = Math.round((dialog.font!.size * 96) / 72) + "px";

  frame.append(titleBar, body);
  element.appendChild(frame);

  /* ------------------------------------------------------------ the controls */

  /** Every control by its symbolic id: the box it lives in, and the input
   *  inside it if it has one. */
  const boxes = new Map<string, HTMLElement>();
  const inputs = new Map<string, HTMLInputElement | HTMLSelectElement>();
  /** The `&` in a caption, and what it should reach.  For a check box or a
   *  button that is the control itself; for the four captions that belong to an
   *  edit or a list, it is the control the author expected Windows to walk to
   *  from the static he put the `&` on. */
  const mnemonics = new Map<string, { key: string; target: HTMLElement }>();

  /** Absolute at the author's rectangle, in pixels, always. */
  function place(node: HTMLElement, rc: RcControl): void {
    const box = px(rc.rect);
    node.style.left = box.x + "px";
    node.style.top = box.y + "px";
    node.style.width = box.width + "px";
    node.style.height = box.height + "px";
    node.dataset["control"] = rc.id;
  }

  /** A static: CTEXT centres, RTEXT is right-aligned, LTEXT is neither. */
  function makeStatic(rc: RcControl): HTMLElement {
    const span = document.createElement("span");
    span.className = CLASS + "-static";
    if (rc.implicitStyles.includes("SS_CENTER")) span.style.textAlign = "center";
    if (rc.implicitStyles.includes("SS_RIGHT")) span.style.textAlign = "right";
    span.append(renderLabel(rc.text ?? "").node);
    return span;
  }

  /** BS_AUTOCHECKBOX and BS_AUTORADIOBUTTON, which are the same control with a
   *  different mark and, for the radios, a group. */
  function makeButton(rc: RcControl, radioGroup?: string): HTMLElement {
    const label = document.createElement("label");
    label.className = CLASS + "-check";
    const input = document.createElement("input");
    input.type = radioGroup === undefined ? "checkbox" : "radio";
    if (radioGroup !== undefined) input.name = radioGroup;
    input.id = "pokyd-" + rc.id.toLowerCase();
    const text = document.createElement("span");
    const { node, key } = renderLabel(rc.text ?? "");
    text.append(node);
    label.append(input, text);
    inputs.set(rc.id, input);
    if (key !== "") mnemonics.set(rc.id, { key, target: input });
    return label;
  }

  for (const rc of dialog.controls) {
    let node: HTMLElement;

    switch (rc.id) {
      case "IDC_CHARAKTER":
      case "IDC_NALADA": {
        /* LBS_NOTIFY | WS_VSCROLL, filled by LB_ADDSTRING and read by
           LB_GETCURSEL: a single-selection list box, which is what a <select>
           with more than one visible row is. */
        const list = document.createElement("select");
        list.className = CLASS + "-list";
        list.size = 2;
        const words = rc.id === "IDC_CHARAKTER" ? CHARACTERS : MOODS;
        words.forEach((word, index) => {
          const option = document.createElement("option");
          /* charakter is the index itself; nalada is the index plus one
             (Nastaveni.cpp:80 against :88 and :165). */
          option.value = String(rc.id === "IDC_CHARAKTER" ? index : index + 1);
          option.textContent = word;
          list.appendChild(option);
        });
        inputs.set(rc.id, list);
        node = list;
        break;
      }

      case "IDC_JMENOCLOVEKA":
      case "IDC_JMENOPOCITACE": {
        const input = document.createElement("input");
        input.type = "text";
        input.className = CLASS + "-edit";
        input.autocomplete = "off";
        /* strncpy(...,MAX_DELKA_JMENA) -- the cut is the author's, so the edit
           may as well not let a visitor type past it. */
        input.maxLength = NAME_LIMIT;
        input.id = "pokyd-" + rc.id.toLowerCase();
        inputs.set(rc.id, input);
        node = input;
        break;
      }

      case "IDC_CLOVEKZENA":
      case "IDC_CLOVEKMUZ":
        node = makeButton(rc, "pokyd-human-gender");
        break;

      case "IDC_POCITACZENA":
      case "IDC_POCITACMUZ":
        node = makeButton(rc, "pokyd-computer-gender");
        break;

      case "IDC_EMULOVATCESKOUKLAVESNICI":
      case "IDC_EMULOVATSLOVENSKOUKLAVESNICI":
        node = makeButton(rc, "pokyd-keyboard");
        break;

      default: {
        if (rc.kind === "GROUPBOX") {
          const group = document.createElement("fieldset");
          group.className = CLASS + "-group";
          const legend = document.createElement("legend");
          legend.append(renderLabel(rc.text ?? "").node);
          group.appendChild(legend);
          node = group;
          break;
        }
        if (rc.kind === "PUSHBUTTON" || rc.kind === "DEFPUSHBUTTON") {
          const button = document.createElement("button");
          button.className = CLASS + "-button";
          /* IDOK is the DEFPUSHBUTTON; everything else on this dialog is a
             plain one and must not submit the form. */
          button.type = rc.id === "IDOK" ? "submit" : "button";
          if (rc.kind === "DEFPUSHBUTTON") button.classList.add(CLASS + "-default");
          const { node: text, key } = renderLabel(rc.text ?? "");
          button.append(text);
          if (key !== "") mnemonics.set(rc.id, { key, target: button });
          node = button;
          break;
        }
        if (rc.class === "Button") { node = makeButton(rc); break; }
        node = makeStatic(rc);
      }
    }

    node.classList.add(CLASS + "-item");
    place(node, rc);
    boxes.set(rc.id, node);
    body.appendChild(node);
  }

  /* The label of a radio, a checkbox or an edit is its own caption, except for
     the four edits and lists, whose captions are separate statics -- the
     author put the `&` on the static and Windows walked to the next control in
     tab order.  A browser needs it said out loud. */
  const labelled: [string, string][] = [
    ["IDC_JMENOCLOVEKASTATIC", "IDC_JMENOCLOVEKA"],
    ["IDC_JMENOPOCITACESTATIC", "IDC_JMENOPOCITACE"],
    ["IDC_CHARAKTERSTATIC", "IDC_CHARAKTER"],
    ["IDC_NALADASTATIC", "IDC_NALADA"],
  ];
  for (const [staticId, inputId] of labelled) {
    const box = boxes.get(staticId);
    const input = inputs.get(inputId);
    if (box === undefined || input === undefined) continue;
    if (input.id === "") input.id = "pokyd-" + inputId.toLowerCase();
    const label = document.createElement("label");
    label.htmlFor = input.id;
    while (box.firstChild !== null) label.appendChild(box.firstChild);
    box.appendChild(label);
    const { key } = renderLabel(control(staticId).text ?? "");
    if (key !== "") mnemonics.set(staticId, { key, target: input });
  }

  /* The refusal, which is the one MessageBox this dialog had.  Over the button
     row, because that is where a visitor is looking when it happens. */
  const refusal = document.createElement("div");
  refusal.className = CLASS + "-refusal";
  refusal.setAttribute("role", "alert");
  refusal.hidden = true;
  const refusalTitle = document.createElement("strong");
  const refusalText = document.createElement("p");
  refusal.append(refusalTitle, refusalText);
  body.appendChild(refusal);

  /* --------------------------------------------------------- the two pages */

  /** ZOBRAZ_NA_DIALOGU_POLICKO, :314-335: show or hide, and take the mnemonic
   *  with it. */
  function reveal(id: string, shown: boolean): void {
    const box = boxes.get(id);
    if (box === undefined) return;
    box.hidden = !shown;
    const mnemonic = mnemonics.get(id);
    if (mnemonic === undefined) return;
    if (shown) mnemonic.target.accessKey = mnemonic.key;
    else mnemonic.target.removeAttribute("accesskey");
  }

  /** OnZakladniNastaveni / OnRozsireneNastaveni, :337 and :381 -- the same
   *  function twice over, so it is written once. */
  function showPage(wantAdvanced: boolean): void {
    element.dataset["page"] = wantAdvanced ? "advanced" : "basic";
    for (const id of BASIC_CONTROLS) reveal(id, !wantAdvanced);
    for (const id of ADVANCED_CONTROLS) reveal(id, wantAdvanced);

    for (const id of ["IDC_RAMECEK1", "IDC_RAMECEK2"]) {
      const legend = boxes.get(id)?.querySelector("legend");
      if (legend == null) continue;
      const text = wantAdvanced
        ? ADVANCED_GROUP_CAPTIONS[id]! : control(id).text!;
      legend.replaceChildren(renderLabel(text).node);
    }

    /* SetState(TRUE) on the page you are on: a button held down. */
    for (const [id, on] of [
      ["IDC_ZAKLADNINASTAVENI", !wantAdvanced],
      ["IDC_ROZSIRENENASTAVENI", wantAdvanced],
    ] as [string, boolean][]) {
      const button = boxes.get(id);
      if (button === undefined) continue;
      button.classList.toggle(CLASS + "-held", on);
      button.setAttribute("aria-pressed", String(on));
    }
    disableEmulation();
  }

  /** OnNastavDisableEmulace, :426-437.  The radio pair and QWERTY are only live
   *  while the emulation checkbox is ticked -- and in this port they are never
   *  live at all, which is why this runs after UNIMPLEMENTED rather than
   *  instead of it. */
  function disableEmulation(): void {
    const on = (inputs.get("IDC_EMULOVATKLAVESNICI") as HTMLInputElement | undefined)
      ?.checked === true;
    for (const id of ["IDC_EMULOVATCESKOUKLAVESNICI",
      "IDC_EMULOVATSLOVENSKOUKLAVESNICI", "IDC_KLAVESNICEQWERTY"]) {
      const input = inputs.get(id);
      if (input === undefined) continue;
      input.disabled = !on || UNIMPLEMENTED.includes(id);
    }
  }

  /* ------------------------------------------------------ OnInitDialog, :61 */

  const check = (id: string, on: boolean): void => {
    const input = inputs.get(id) as HTMLInputElement | undefined;
    if (input !== undefined) input.checked = on;
  };
  const text = (id: string, value: string): void => {
    const input = inputs.get(id) as HTMLInputElement | undefined;
    if (input !== undefined) input.value = value;
  };
  const select = (id: string, value: number): void => {
    const list = inputs.get(id) as HTMLSelectElement | undefined;
    if (list !== undefined) list.value = String(value);
  };

  check("IDC_CLOVEKMUZ", form.humanGender === MALE);
  check("IDC_CLOVEKZENA", form.humanGender !== MALE);
  check("IDC_POCITACMUZ", form.computerGender === MALE);
  check("IDC_POCITACZENA", form.computerGender !== MALE);
  text("IDC_JMENOCLOVEKA", form.humanName);
  text("IDC_JMENOPOCITACE", form.computerName);
  select("IDC_CHARAKTER", form.character);
  select("IDC_NALADA", form.mood);
  check("IDC_UKLADATROZHOVOR", form.saveConversation);
  check("IDC_POUZIVATZVUKY", form.useSounds);
  check("IDC_POUZIVATEFEKTY", form.useEffects);
  check("IDC_SPISOVNACESTINA", form.formalCzech);
  check("IDC_EMULOVATKLAVESNICI", form.emulateKeyboard);
  check("IDC_EMULOVATSLOVENSKOUKLAVESNICI", form.slovakKeyboard);
  check("IDC_EMULOVATCESKOUKLAVESNICI", !form.slovakKeyboard);
  check("IDC_KLAVESNICEQWERTY", form.keyboardQwerty);
  check("IDC_ZOBRAZOVATSTANDARDNIKURZOR", form.standardCursor);
  check("IDC_NEZOBRAZOVATPOZADI", form.noBackground);
  check("IDC_READONLYMOD", form.readOnly);
  check("IDC_ZOBRAZOVATPOPISKY", form.showLabels);

  for (const id of UNIMPLEMENTED) {
    const input = inputs.get(id);
    if (input !== undefined) input.disabled = true;
    boxes.get(id)?.classList.add(CLASS + "-unimplemented");
  }

  /* The four controls that are on neither page -- IDOK, IDCANCEL and the two
     page buttons -- are never hidden, so their mnemonics are never swapped for
     a `~` and are set once, here. */
  for (const [id, mnemonic] of mnemonics) {
    if (BASIC_CONTROLS.includes(id) || ADVANCED_CONTROLS.includes(id)) continue;
    mnemonic.target.accessKey = mnemonic.key;
  }

  /* :124 -- the basic page is the one a visitor opens on. */
  showPage(false);

  /* ------------------------------------------------------------- OnOK, :135 */

  /** What the controls say, which is what OnOK reads. */
  function read(): PokydSettingsForm {
    const checked = (id: string): boolean =>
      (inputs.get(id) as HTMLInputElement | undefined)?.checked === true;
    const value = (id: string): string =>
      (inputs.get(id) as HTMLInputElement | undefined)?.value ?? "";
    const chosen = (id: string, fallback: number): number => {
      const list = inputs.get(id) as HTMLSelectElement | undefined;
      const n = list === undefined ? NaN : Number(list.value);
      return Number.isInteger(n) ? n : fallback;
    };
    return {
      /* :140-143.  Not "is the male one ticked" -- "is the female one not",
         which is the same thing with a radio pair and is what he wrote. */
      humanGender: checked("IDC_CLOVEKZENA") ? FEMALE : MALE,
      computerGender: checked("IDC_POCITACZENA") ? FEMALE : MALE,
      humanName: value("IDC_JMENOCLOVEKA"),
      computerName: value("IDC_JMENOPOCITACE"),
      character: chosen("IDC_CHARAKTER", form.character),
      mood: chosen("IDC_NALADA", form.mood),
      saveConversation: checked("IDC_UKLADATROZHOVOR"),
      useSounds: checked("IDC_POUZIVATZVUKY"),
      useEffects: checked("IDC_POUZIVATEFEKTY"),
      formalCzech: checked("IDC_SPISOVNACESTINA"),
      emulateKeyboard: checked("IDC_EMULOVATKLAVESNICI"),
      slovakKeyboard: checked("IDC_EMULOVATSLOVENSKOUKLAVESNICI"),
      keyboardQwerty: checked("IDC_KLAVESNICEQWERTY"),
      standardCursor: checked("IDC_ZOBRAZOVATSTANDARDNIKURZOR"),
      noBackground: checked("IDC_NEZOBRAZOVATPOZADI"),
      readOnly: checked("IDC_READONLYMOD"),
      showLabels: checked("IDC_ZOBRAZOVATPOPISKY"),
    };
  }

  function accept(): void {
    const result = edit(options.settings, read());
    if (result.refused !== null) {
      /* :149 and :158: the message, then the focus, and the dialog stays. */
      refusalTitle.textContent = result.refused.title;
      refusalText.textContent = result.refused.message;
      refusal.hidden = false;
      const input = inputs.get(result.refused.control) as HTMLInputElement | undefined;
      if (input !== undefined) { input.focus(); input.select(); }
      return;
    }
    close();
    options.onAccept(result);
  }

  function cancel(): void {
    close();
    if (options.onCancel !== undefined) options.onCancel();
  }

  /* -------------------------------------------------------------- the wiring */

  frame.addEventListener("submit", (event: SubmitEvent): void => {
    event.preventDefault();
    accept();
  });

  boxes.get("IDCANCEL")?.addEventListener("click", cancel);
  closeBox.addEventListener("click", cancel);
  boxes.get("IDC_ZAKLADNINASTAVENI")
    ?.addEventListener("click", (): void => { showPage(false); });
  boxes.get("IDC_ROZSIRENENASTAVENI")
    ?.addEventListener("click", (): void => { showPage(true); });
  inputs.get("IDC_EMULOVATKLAVESNICI")
    ?.addEventListener("change", disableEmulation);

  /* Escape is IDCANCEL, and it is his as well: ON_COMMAND(ID_ZKRATKA_SMAZRADEK,
     OnClose) at :42 puts the main window's Escape accelerator on this dialog
     too.  Tab is the modal half -- a dialog nothing can tab out of. */
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") { event.preventDefault(); cancel(); return; }
    if (event.key !== "Tab") return;
    const reachable = Array.from(frame.querySelectorAll<HTMLElement>(
      "button, input, select"))
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

  parent.appendChild(element);
  frame.focus();

  function close(): void {
    element.removeEventListener("keydown", onKeyDown);
    element.remove();
  }

  return {
    element,
    remove: close,
  };
}
