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

   **The dialog wears the grey tile**, which is in Nastaveni.cpp rather than in
   the script: OnCtlColor (:306-312) hands back g_stetecpozadipodokna for
   everything except the edits and the list boxes -- the IDB_POZADIMALE pattern
   brush, which is the same one the loading window wears, with
   SetBkMode(TRANSPARENT) over it.

   **The second page is not drawn at all, and that is the one real cut in this
   file.**  IDC_ZAKLADNINASTAVENI and IDC_ROZSIRENENASTAVENI were two buttons
   across the top that showed one set of controls and hid the other (:337-424);
   `DROPPED` below is both of them and everything the second one showed, and the
   reason each control went is written there.  What follows from it:

     - **there is no ZOBRAZ_NA_DIALOGU_POLICKO.**  His (:314-335) walked a
       caption and swapped `&` for `~` on the way out and back on the way in,
       because an Alt+key that reaches a hidden control is a bug.  With one page
       nothing is ever hidden, so every mnemonic is set once and stays.
     - **there is no OnNastavDisableEmulace** (:426-437), because the checkbox
       it hung the keyboard radios off is gone with them.
     - **nothing on this dialog is greyed any more.**  Every control that was
       drawn and could not be honoured was on that page, so the rule the menu
       keeps -- a command with no handler is greyed rather than a lie -- has
       nothing left to grey here.
     - **the dialog is 13 dialog units shorter**, which is the height of the row
       those two buttons stood in, taken off the top.  Everything else keeps the
       template's own rectangle, moved up by that one number and by nothing
       else; the 5-unit gap under it is the template's gap between that row and
       the first group box.

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
  DIALOG_CLASS, DIALOG_FONT, makeStatic, mountFrame, placeControl, renderLabel,
} from "./frame.ts";
import {
  ADVANCED_CONTROLS, CHARACTERS, FEMALE, MALE, MOODS, NAME_LIMIT, edit,
  formFromSettings,
} from "./settings.ts";
import type { PokydSettingsEdit, PokydSettingsForm } from "./settings.ts";
import type { PokydSettings } from "../web/protocol.ts";

const CLASS = DIALOG_CLASS;

/* ------------------------------------------------------------ what is dropped */

/* IDC_ROZSIRENENASTAVENI, the second page, and the two buttons that switched
   between them.  Nothing here is drawn, and it is the one thing on this dialog
   that the archive says should be: it is a cut, not a port.

   What was on it, and why each one has nothing left to say in a browser:

     - the four keyboard controls and the paragraph of text under them, because
       EMULUJ_KLAVESNICI is a whole keyboard layout (VSTUP.FU) that is not
       ported.  A tick that did not change what a keystroke produces is worse
       than no tick.
     - the standard-cursor one, because the caret it switches to is the DOS
       underscore the program drew itself, and a page does not draw the caret.
     - the tool tips, because the twenty-odd bubbles are Nastaveni.cpp literals
       and nothing here shows one.
     - the read-only one, because prikaz_readonlymod guards fopen() -- KYDY.TXT,
       PROFIL.IQP, the settings file, the dictionary cache -- and none of the
       four is a file here.  The engine still carries the flag and the settings
       file still writes it; what is gone is the checkbox.
     - the background one, because turning the photograph off is the author's
       own command-line switch and stays one: `?bezpozadi` (src/app/main.ts,
       ROZEBER_PRIKAZOVY_RADEK at PROSTRED.FU:100).

   The values behind all of them survive an OK untouched -- `read()` below asks
   the settings, not the missing control -- so a visit started with ?bezpozadi
   keeps its black background through as many trips to this dialog as it likes.

   **Phase 8 added a ninth, and it is the first one taken off the page that is
   drawn**: IDC_UKLADATROZHOVOR, "Ukladat rozhovor do souboru".  ukladatrozhovor
   switched the KYDY.TXT conversation log (ZAPIS_DO_SOUBORU_TEXTOVY_ZAZNAM), and
   phase 8 dropped the log: there is no file to write next to a page, an
   in-memory transcript offered as a download is a feature of ours rather than
   his, and the conversation is already on the screen and scrolls back a hundred
   sentences.  A tick for a file nobody can ever look at is the same broken
   promise as a greyed menu item pretending to be live.  The setting itself
   stays where it always was -- NASTAV_STANDARDNE still sets it to 1, the engine
   still carries it and src/app/config.ts still writes "Ukladat rozhovor: ano"
   into IQPOKYD.CFG, because that file is his format and not ours to edit.

   Everything left is live: the engine reads it, the window shows it, or phase
   7.3 stores it. */
const DROPPED: readonly string[] = [
  "IDC_ZAKLADNINASTAVENI",
  "IDC_ROZSIRENENASTAVENI",
  "IDC_UKLADATROZHOVOR",
  ...ADVANCED_CONTROLS,
];

/* ----------------------------------------------------------- what moves up */

/** A band of the template with nothing left in it.  Everything below one moves
 *  up by its height, anything that spans one gets that much shorter, and the
 *  dialog does both.  Two of them, and both are read off the control that
 *  stood there rather than written down: this file has no measurements. */
interface DroppedRow { top: number; height: number }

function droppedRows(dialog: RcDialog): DroppedRow[] {
  /* IDC_ZAKLADNINASTAVENI and IDC_ROZSIRENENASTAVENI share one row at the top
     of the template (0..13), and the 5-unit gap under it is the template's own
     gap before the first group box.  IDC_UKLADATROZHOVOR is the first row
     inside "Prostredi", so the three check boxes under it move up into its
     place and the group box closes over them. */
  const rows: DroppedRow[] = [];
  for (const id of ["IDC_ZAKLADNINASTAVENI", "IDC_UKLADATROZHOVOR"]) {
    const rc = dialog.controls.find((c) => c.id === id);
    if (rc !== undefined) rows.push({ top: rc.rect.y, height: rc.rect.cy });
  }
  return rows;
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
  /* The two bands with nothing left in them -- see DROPPED and droppedRows. */
  const rows = droppedRows(dialog);

  /** How far up a control moves: the height of every dropped row entirely
   *  above it. */
  const shiftFor = (rc: { rect: { y: number } }): number => rows
    .filter((row) => rc.rect.y >= row.top + row.height)
    .reduce((sum, row) => sum + row.height, 0);

  /** How much shorter a control gets: the height of every dropped row it spans.
   *  Only two things do -- IDC_RAMECEK2, which closes over the check box that
   *  went, and the dialog itself, which closes over both rows. */
  const shrinkFor = (rc: { rect: { y: number; cy: number } }): number => rows
    .filter((row) => row.top >= rc.rect.y
      && row.top + row.height <= rc.rect.y + rc.rect.cy)
    .reduce((sum, row) => sum + row.height, 0);

  const size = dluToPx(
    { ...dialog.rect, cy: dialog.rect.cy - shrinkFor(dialog) }, base);

  const control = (id: string): RcControl => {
    const found = dialog.controls.find((c) => c.id === id);
    if (found === undefined) throw new Error(id + " is not in " + dialog.id);
    return found;
  };

  /* ---------------------------------------------------------------- the frame */

  /* src/app/frame.ts, and it is the same frame all four of his dialogs wear
     since phase 8.2: the XP caption bar, the close box carrying IDCANCEL's own
     name, Escape, and the Tab trap. */
  const mounted = mountFrame(parent, {
    caption: dialog.caption!,
    closeLabel: control("IDCANCEL").text!,
    width: size.width,
    height: size.height,
    fontSize: dialog.font!.size,
    onCancel: (): void => { cancel(); },
    modifier: CLASS + "--settings",
  });
  const element = mounted.element;
  const frame = mounted.frame;
  const body = mounted.body;

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

  /** Absolute at the author's rectangle, in pixels, always -- up by the rows
   *  DROPPED took out above it, and shorter by any it closes over. */
  function place(node: HTMLElement, rc: RcControl): void {
    placeControl(node, { ...rc.rect, cy: rc.rect.cy - shrinkFor(rc) },
      base, rc.id, shiftFor(rc));
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
    if (DROPPED.includes(rc.id)) continue;
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
  /* The other eight things OnInitDialog ticked are on the page that is not
     drawn (DROPPED), and their values ride through `read()` untouched. */

  /* Every mnemonic, once: with the second page gone nothing on this dialog is
     ever hidden, so there is no `&`-to-`~` to do (ZOBRAZ_NA_DIALOGU_POLICKO,
     :314-335). */
  for (const mnemonic of mnemonics.values()) {
    mnemonic.target.accessKey = mnemonic.key;
  }

  /* ------------------------------------------------------------- OnOK, :135 */

  /** What the controls say, which is what OnOK reads.
   *
   *  A control that is not on the dialog does not get a vote: `checked` falls
   *  back to what the settings already said, so the eight values DROPPED took
   *  off the window come back out of here exactly as they went in.  Without
   *  that, one OK on a name would quietly clear prikaz_nezobrazovatpozadi and
   *  the rest of them -- which is the trap in dropping a page from a dialog
   *  that writes its whole struct at once (:163-168). */
  function read(): PokydSettingsForm {
    const checked = (id: string, absent: boolean): boolean => {
      const input = inputs.get(id) as HTMLInputElement | undefined;
      return input === undefined ? absent : input.checked;
    };
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
      humanGender: checked("IDC_CLOVEKZENA", form.humanGender === FEMALE)
        ? FEMALE : MALE,
      computerGender: checked("IDC_POCITACZENA", form.computerGender === FEMALE)
        ? FEMALE : MALE,
      humanName: value("IDC_JMENOCLOVEKA"),
      computerName: value("IDC_JMENOPOCITACE"),
      character: chosen("IDC_CHARAKTER", form.character),
      mood: chosen("IDC_NALADA", form.mood),
      useSounds: checked("IDC_POUZIVATZVUKY", form.useSounds),
      useEffects: checked("IDC_POUZIVATEFEKTY", form.useEffects),
      formalCzech: checked("IDC_SPISOVNACESTINA", form.formalCzech),
      /* The nine below are DROPPED, every one of them -- eight on the page that
         is not drawn and, since phase 8, the conversation log's own tick. */
      saveConversation: checked("IDC_UKLADATROZHOVOR", form.saveConversation),
      emulateKeyboard: checked("IDC_EMULOVATKLAVESNICI", form.emulateKeyboard),
      slovakKeyboard:
        checked("IDC_EMULOVATSLOVENSKOUKLAVESNICI", form.slovakKeyboard),
      keyboardQwerty: checked("IDC_KLAVESNICEQWERTY", form.keyboardQwerty),
      standardCursor:
        checked("IDC_ZOBRAZOVATSTANDARDNIKURZOR", form.standardCursor),
      noBackground: checked("IDC_NEZOBRAZOVATPOZADI", form.noBackground),
      readOnly: checked("IDC_READONLYMOD", form.readOnly),
      showLabels: checked("IDC_ZOBRAZOVATPOPISKY", form.showLabels),
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

  /* Escape, the close box and the Tab trap are src/app/frame.ts's, and Escape
     is his as well: ON_COMMAND(ID_ZKRATKA_SMAZRADEK, OnClose) at :42 puts the
     main window's Escape accelerator on this dialog too. */
  frame.addEventListener("submit", (event: SubmitEvent): void => {
    event.preventDefault();
    accept();
  });

  boxes.get("IDCANCEL")?.addEventListener("click", cancel);

  function close(): void { mounted.close(); }

  return {
    element,
    remove: close,
  };
}
