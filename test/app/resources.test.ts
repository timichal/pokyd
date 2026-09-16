/* IQ Pokyd - test/app/resources.test.ts - phase 6.1 of PLAN.md.

   src/app/resources.ts claims to be `original/IQ Pokyd/!Prostre/IQPokyd.rc`.
   This is what makes that claim checkable.  In order of how much it would hurt
   to be wrong:

     1. **nothing was invented.**  Every string in the module is looked for in
        the original file as a run of CP1250 bytes -- not as text, as bytes, with
        phase 4.1's encoder pointed the other way.  A caption that drifted by one
        letter, or a diacritic quietly lost somewhere between the codepage and a
        \uXXXX escape, fails here.
     2. **nothing was dropped.**  The controls of each dialog are counted again
        straight off the file, by a rule this test states itself -- a statement
        keyword four spaces in -- and compared with what the module holds.
     3. **the committed file is the parse.**  The extractor is re-run in memory
        and its output compared with what is on disk, so "generated" cannot
        quietly become "hand-edited".
     4. **the two constants tables are the engine's.**  PALETTE and
        WINDOW_LAYOUT are not in the .rc at all -- they are COLORREFs in
        PROSTRED.PR and pixel arithmetic in PROSTRED.FU -- so both are read back
        out of src/engine/ here, byte-reversal and all.

   Run it:   node test/app/resources.test.ts

   Needs nothing but node: no browser, no engine, no build.  Written by us, not
   ported; ASCII only, so every Czech letter in here is a \u escape.
*/

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { decodeCp1250, encodeCp1250 } from "../../src/web/cp1250.ts";
import {
  DIALOGS, MENUS, ACCELERATORS, BITMAPS, ICONS, VERSION, SHARED_IDS,
  PALETTE, WINDOW_LAYOUT, RES_DIR, dluToPx,
} from "../../src/app/resources.ts";
import type { RcControl, RcMenuItem } from "../../src/app/resources.ts";
import { readRc, renderModule } from "../../tools/extract-rc.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RC_PATH = join(ROOT, "original", "IQ Pokyd", "!Prostre", "IQPokyd.rc");
const MODULE_PATH = join(ROOT, "src", "app", "resources.ts");

/* ------------------------------------------------------------- the harness */

let failures = 0;
let checks = 0;

function ok(label: string, cond: boolean, detail?: string): void {
  checks++;
  if (cond) {
    console.log("  ok    " + label);
  } else {
    failures++;
    console.log("  FAIL  " + label + (detail === undefined ? "" : "\n          " + detail));
  }
}

function eq(label: string, got: unknown, expected: unknown): void {
  const a = JSON.stringify(got);
  const b = JSON.stringify(expected);
  ok(label, a === b, a === b ? undefined : "got " + a + "\n          expected " + b);
}

function heading(text: string): void {
  console.log("\n" + text);
}

console.log("IQ Pokyd - phase 6.1, IQPokyd.rc read back\n");

/* ------------------------------------------------------------- the sources */

const rcBytes = readFileSync(RC_PATH);
const rcText = decodeCp1250(rcBytes);
const rcLines = rcText.split(/\r?\n/);

/** Does this run of CP1250 bytes occur in the file?  Buffer.indexOf over the
 *  raw archive bytes -- no decoding on this side of the comparison. */
function occursInRc(text: string): boolean {
  return rcBytes.indexOf(Buffer.from(encodeCp1250(text))) !== -1;
}

/* ------------------------------------------------ 1. nothing was invented */

heading("every string in the module is in the file, as bytes");
{
  /* The three strings the author wrote with an escape in them: the .rc holds
     `\n`, `""` and `\t`, not a newline, a quote and a tab, so they are not byte
     runs and are checked by hand below rather than skipped quietly.  Two are
     control texts; the other seven are the menu items that print a shortcut. */
  const escaped: string[] = [];
  const missing: string[] = [];
  let looked = 0;

  const check = (text: string | null): void => {
    if (text === null || text === "") return;
    if (/[\r\n\t"]/.test(text)) { escaped.push(text); return; }
    looked++;
    if (!occursInRc(text)) missing.push(text);
  };

  for (const dialog of Object.values(DIALOGS)) {
    check(dialog.caption);
    if (dialog.font !== null) check(dialog.font.face);
    for (const control of dialog.controls) {
      check(control.text);
      /* Only a CONTROL statement names its window class in the file.  For the
         rest the resource compiler supplies it and the module says so, which is
         a claim about Windows and not about this archive. */
      if (control.kind === "CONTROL") check(control.class);
    }
  }
  const walk = (items: RcMenuItem[]): void => {
    for (const item of items) { check(item.raw); walk(item.items); }
  };
  for (const menu of Object.values(MENUS)) walk(menu.items);
  /* The paths are forward-slashed in the module and written `res\\name.bmp` in
     the script, where the backslash is a C escape -- so the byte run to look
     for has two of them. */
  for (const image of [...BITMAPS, ...ICONS]) check(image.file.replace(/\//g, "\\\\"));
  for (const value of Object.values(VERSION.strings)) check(value);

  ok("every plain string occurs verbatim in IQPokyd.rc (" + looked + " of them)",
    missing.length === 0, missing.slice(0, 3).map((s) => JSON.stringify(s)).join(", "));
  eq("nine strings carry an escape and are checked by hand", escaped.length, 9);

  /* Those three, spelled out.  IDC_STATIC's two-line label in the about box,
     the emulation note with its doubled quotes, and the tab in every menu item
     that has a shortcut. */
  ok("the about box's Web/E-mail label keeps its newline",
    DIALOGS["IDD_ABOUTBOX"].controls.some((c) => c.text === "Web:\nE-mail:"));
  ok("the keyboard-emulation note keeps its quoted word",
    DIALOGS["IDD_NASTAVENI"].controls.some((c) =>
      c.id === "IDC_TEXTKEMULACI" && c.text !== null
      && c.text.includes("\"po\u0159\u00e1d\"")));      /* "porad" */
  ok("a menu item's shortcut is after a tab, and is split off the label",
    MENUS["IDR_MENU"].items[0].items[1].raw === "&Nastaven\u00ed...\tF4"
    && MENUS["IDR_MENU"].items[0].items[1].label === "Nastaven\u00ed..."
    && MENUS["IDR_MENU"].items[0].items[1].accelerator === "F4");
}

/* -------------------------------------------------- 2. nothing was dropped */

heading("every control of every dialog is present");
{
  /* Counted off the file by this test's own rule, which is not the parser's:
     Developer Studio indents a statement by exactly four spaces and wraps a
     continuation by twenty. */
  const KEYWORDS = "LTEXT|RTEXT|CTEXT|EDITTEXT|PUSHBUTTON|DEFPUSHBUTTON|GROUPBOX"
    + "|CONTROL|LISTBOX|COMBOBOX|SCROLLBAR|ICON|CHECKBOX|RADIOBUTTON";
  const statement = new RegExp("^ {4}(" + KEYWORDS + ")\\b");

  for (const [id, dialog] of Object.entries(DIALOGS)) {
    const start = rcLines.findIndex((l) => new RegExp("^" + id + "\\s+DIALOG").test(l));
    let end = start;
    while (end < rcLines.length && rcLines[end].trim() !== "END") end++;
    const counted = rcLines.slice(start, end).filter((l) => statement.test(l)).length;
    eq(id + " has every statement the file does", dialog.controls.length, counted);
  }

  eq("six dialogs, seventy-five controls",
    [Object.keys(DIALOGS).length,
      Object.values(DIALOGS).reduce((n, d) => n + d.controls.length, 0)],
    [6, 75]);
  eq("one menu, one accelerator table",
    [Object.keys(MENUS).length, Object.keys(ACCELERATORS).length], [1, 1]);
  eq("eleven bitmaps and three icons", [BITMAPS.length, ICONS.length], [11, 3]);
}

/* --------------------------------------------- 3. the committed file is the parse */

heading("src/app/resources.ts is what tools/extract-rc.mjs produces");
{
  const rendered = renderModule(readRc());
  const committed = readFileSync(MODULE_PATH, "utf8");
  ok("the module on disk is byte-identical to a fresh parse",
    rendered === committed,
    rendered === committed ? undefined
      : "run node tools/extract-rc.mjs (lengths " + committed.length
        + " on disk, " + rendered.length + " fresh)");
  ok("and it is CRLF, like everything else here", committed.includes("\r\n"));
  ok("and ASCII, so no editor's encoding can change what it says",
    /^[\x00-\x7f]*$/.test(committed));
}

/* --------------------------------------------------------- 4. the main window */

heading("IDD_HLAVNI_OKNO, the window phase 6.3 rebuilds");
{
  const dialog = DIALOGS["IDD_HLAVNI_OKNO"];
  eq("is the only DIALOGEX", dialog.extended, true);
  eq("is 324x181 dialog units", [dialog.rect.cx, dialog.rect.cy], [324, 181]);
  eq("its font is the template's Trebuchet MS 12",
    [dialog.font?.size, dialog.font?.face], [12, "Trebuchet MS"]);
  eq("it carries IDR_MENU", dialog.menu, "IDR_MENU");
  eq("its caption is the author's", dialog.caption, "IQ Pokyd v0.15");
  eq("it is resizable (WS_THICKFRAME) and has the maximize box",
    [dialog.styles.includes("WS_THICKFRAME"), dialog.styles.includes("WS_MAXIMIZEBOX")],
    [true, true]);

  eq("eight controls, in the script's order",
    dialog.controls.map((c) => c.id),
    ["IDC_VETA", "IDC_NOVAVETA", "IDC_NADPIS2", "IDC_NADPIS1", "IDC_NADPIS3",
      "IDC_NAPISTVAVETA", "IDC_EFEKTPROGRES1", "IDC_EFEKTPROGRES2"]);

  const byId = (id: string): RcControl =>
    dialog.controls.find((c) => c.id === id)!;

  eq("IDC_NOVAVETA is the default button and says Rekni",
    [byId("IDC_NOVAVETA").kind, byId("IDC_NOVAVETA").text],
    ["DEFPUSHBUTTON", "\u0158ekni"]);                      /* Rekni */
  eq("IDC_NAPISTVAVETA is the label beside the input",
    byId("IDC_NAPISTVAVETA").text, "Tv\u00e1 v\u011bta");  /* Tva veta */
  eq("IDC_VETA is an EDITTEXT with ES_AUTOHSCROLL and no length of its own",
    [byId("IDC_VETA").kind, byId("IDC_VETA").styles], ["EDITTEXT", ["ES_AUTOHSCROLL"]]);
  eq("both effect progress bars ship invisible",
    [byId("IDC_EFEKTPROGRES1").visible, byId("IDC_EFEKTPROGRES2").visible],
    [false, false]);
  eq("and they are six units wide, down each edge",
    [byId("IDC_EFEKTPROGRES1").rect.x, byId("IDC_EFEKTPROGRES2").rect.x,
      byId("IDC_EFEKTPROGRES1").rect.cx],
    [0, 316, 6]);

  /* The finding phase 6.1 exists to write down: the conversation is not a
     control.  Nothing in this dialog is a list, a rich edit or a read-only
     multi-line box, because PROSTRED.FU builds the transcript out of a hundred
     STATIC children at runtime. */
  ok("no control in it could hold the transcript",
    dialog.controls.every((c) => c.id !== "IDC_ROZHOVOR"
      && !c.styles.includes("ES_MULTILINE") && c.class !== "RICHEDIT"));
}

heading("IDD_NACITANI, which phase 4.3 already drew");
{
  const dialog = DIALOGS["IDD_NACITANI"];
  eq("its caption is what the loading window says before the first step",
    dialog.caption, "Spou\u0161t\u00edm IQ Pokyd...");     /* Spoustim IQ Pokyd... */
  eq("four controls", dialog.controls.map((c) => c.id),
    ["IDCANCEL", "IDC_PROGRESNACITANI", "IDC_TEXT", "IDC_PROCENTA"]);
  const bar = dialog.controls.find((c) => c.id === "IDC_PROGRESNACITANI")!;
  eq("the bar is a bordered smooth msctls_progress32",
    [bar.class, bar.styles], ["msctls_progress32", ["PBS_SMOOTH", "WS_BORDER"]]);
  const percent = dialog.controls.find((c) => c.id === "IDC_PROCENTA")!;
  eq("the percentage is right-aligned and starts at 0.0%",
    [percent.kind, percent.text], ["RTEXT", "0.0%"]);
}

/* ------------------------------------------------- 5. what the page already uses */

heading("the three strings src/app/chat.ts copied by hand at phase 5.1");
{
  const chat = readFileSync(join(ROOT, "src", "app", "chat.ts"), "utf8");
  const main = DIALOGS["IDD_HLAVNI_OKNO"];
  const escape = (s: string): string => Array.from(s).map((ch) => {
    const code = ch.charCodeAt(0);
    return code > 0x7e ? "\\u" + code.toString(16).padStart(4, "0") : ch;
  }).join("");

  const wanted: [string, string][] = [
    ["the window title", main.caption!],
    ["the input label", main.controls.find((c) => c.id === "IDC_NAPISTVAVETA")!.text!],
    ["the button", main.controls.find((c) => c.id === "IDC_NOVAVETA")!.text!],
  ];
  for (const [what, text] of wanted) {
    ok("chat.ts has " + what + " exactly as IQPokyd.rc has it",
      chat.includes("\"" + escape(text) + "\""), JSON.stringify(escape(text)));
  }
}

/* --------------------------------------------------------------- 6. the ids */

heading("symbolic ids, and why nothing here is keyed by number");
{
  const header = decodeCp1250(readFileSync(
    join(ROOT, "original", "IQ Pokyd", "!Prostre", "resource.h")));
  const defined = new Set<string>();
  for (const line of header.split(/\r?\n/)) {
    const m = /^#define\s+(\w+)\s+(0x[0-9a-fA-F]+|\d+)\s*$/.exec(line.trim());
    if (m) defined.add(m[1]);
  }
  /* The three that are not in resource.h because MFC defines them. */
  const fromAfx = new Set(["IDC_STATIC", "IDOK", "IDCANCEL"]);

  const unresolved: string[] = [];
  for (const dialog of Object.values(DIALOGS)) {
    for (const control of dialog.controls) {
      if (!defined.has(control.id) && !fromAfx.has(control.id)) unresolved.push(control.id);
    }
  }
  ok("every control id is in resource.h or comes from afxres.h",
    unresolved.length === 0, unresolved.join(", "));

  eq("the three afxres ids carry their standard numbers",
    Object.values(DIALOGS).flatMap((d) => d.controls)
      .filter((c) => fromAfx.has(c.id))
      .map((c) => c.id + "=" + c.numericId)
      .filter((v, i, a) => a.indexOf(v) === i).sort(),
    ["IDCANCEL=2", "IDC_STATIC=-1", "IDOK=1"]);

  ok("fifteen numbers are shared by more than one symbol", SHARED_IDS.length === 15);
  const shared1062 = SHARED_IDS.find((s) => s.value === 1062);
  eq("1062 is IDC_EFEKTPROGRES1 in the main window and a radio button in the "
    + "debug dialog", shared1062?.names,
    ["IDC_EFEKTPROGRES1", "IDC_UPLNATOLERANCEPRAVOPISU"]);
  ok("and both of those really are in the module, in different dialogs",
    DIALOGS["IDD_HLAVNI_OKNO"].controls.some((c) => c.id === "IDC_EFEKTPROGRES1")
    && DIALOGS["IDD_DEBUGNASTAVENI"].controls
      .some((c) => c.id === "IDC_UPLNATOLERANCEPRAVOPISU"));
}

/* -------------------------------------------------- 7. the menu and the keys */

heading("IDR_MENU and IDR_ZKRATKY");
{
  const items = MENUS["IDR_MENU"].items;
  eq("two popups and one right-aligned item",
    items.map((i) => i.kind + ":" + i.label),
    ["popup:IQ Pokyd", "popup:N\u00e1pov\u011bda", "item:N\u00e1lada"]);
  eq("the last one is right-aligned by the HELP flag", items[2].flags, ["HELP"]);
  eq("and it opens the settings dialog, the same as Nastaveni does",
    [items[2].id, items[0].items[1].id], ["ID_NASTAVENI", "ID_NASTAVENI"]);

  eq("the IQ Pokyd popup: two items between three separators",
    items[0].items.map((i) => i.kind),
    ["separator", "item", "item", "separator"]);
  eq("the help popup's five items",
    items[1].items.filter((i) => i.kind === "item").map((i) => i.label),
    ["Mal\u00e1 n\u00e1pov\u011bda", "Velk\u00e1 n\u00e1pov\u011bda...",
      "IQ Pokyd na internetu...", "Informace o verzi", "O programu"]);
  eq("every item with a mnemonic keeps it",
    items[0].items.filter((i) => i.mnemonic !== null).map((i) => i.mnemonic),
    ["N", "K"]);

  const keys = ACCELERATORS["IDR_ZKRATKY"].entries;
  eq("fourteen accelerators", keys.length, 14);
  ok("all of them are VIRTKEY", keys.every((k) => k.flags.includes("VIRTKEY")));

  /* The four phase 7.4 is about, and the only way to reach any of them: no menu
     item has these commands. */
  const mood = keys.filter((k) => k.id.includes("NALADY") || k.id.includes("CHARAKTERU"));
  eq("F7/F8 move the mood, Ctrl+F7 and Ctrl+F8 the character",
    mood.map((k) => k.flags.filter((f) => f !== "VIRTKEY" && f !== "NOINVERT")
      .concat(k.key).join("+") + "=" + k.id),
    ["VK_F7=ID_ZLEPSENINALADY", "CONTROL+VK_F7=ID_ZLEPSENICHARAKTERU",
      "VK_F8=ID_ZHORSENINALADY", "CONTROL+VK_F8=ID_ZHORSENICHARAKTERU"]);
  const inMenu = new Set<string>();
  const collect = (list: RcMenuItem[]): void => {
    for (const i of list) { if (i.id !== null) inMenu.add(i.id); collect(i.items); }
  };
  collect(items);
  ok("none of those four is in the menu at all",
    mood.every((k) => !inMenu.has(k.id)));

  eq("the debug panel is Ctrl+Shift+Alt+D",
    keys.filter((k) => k.id === "ID_CHEAT_DEBUGINFO")
      .map((k) => k.flags.filter((f) => f !== "VIRTKEY" && f !== "NOINVERT")
        .concat(k.key).join("+")),
    ["SHIFT+CONTROL+ALT+D"]);
}

/* -------------------------------------------------- 8. the files phase 6.2 wants */

heading("the eighteen image files, and whether they are there");
{
  const dir = join(ROOT, RES_DIR, "res");
  const onDisk = new Map(readdirSync(dir).map((n) => [n.toLowerCase(), n]));

  const missing: string[] = [];
  const miscased: string[] = [];
  for (const image of [...BITMAPS, ...ICONS]) {
    const name = image.file.replace(/^res\//, "");
    const actual = onDisk.get(name.toLowerCase());
    if (actual === undefined) missing.push(image.file);
    else if (actual !== name) miscased.push(image.file + " -> res/" + actual);
  }
  ok("every bitmap and icon the script names is in original/", missing.length === 0,
    missing.join(", "));

  /* Not a failure, and worth knowing before phase 6.2 writes a path: the .rc
     was written on a case-insensitive filesystem and one entry does not match
     the file it loads. */
  eq("one of them is spelled in the wrong case, and 6.2 has to fold it",
    miscased, ["res/POZMALE.BMP -> res/pozmale.bmp"]);

  eq("the background is IDB_POZADIHLAVNIHOOKNA",
    BITMAPS.find((b) => b.id === "IDB_POZADIHLAVNIHOOKNA")?.file,
    "res/pozadi-iqpokyd.bmp");
  eq("the about box's logo is a bitmap referenced by number",
    DIALOGS["IDD_ABOUTBOX"].controls.find((c) => c.textResource !== null)?.textResource,
    { raw: "139", symbol: "IDB_KYBLSOFT" });
  eq("and 139 is the KYBLSoft bitmap",
    BITMAPS.find((b) => b.numericId === 139)?.file, "res/kyblsoft.bmp");
}

/* ------------------------------------------------------------ 9. the version */

heading("VS_VERSION_INFO");
{
  eq("the product is IQ Pokyd 0,1,0,0",
    [VERSION.strings["ProductName"], VERSION.fixed["FILEVERSION"]],
    ["IQ Pokyd", "0,1,0,0"]);
  eq("the company is the author's",
    VERSION.strings["CompanyName"], "K\u00ddBLSoft");       /* KYBLSoft */
  eq("the copyright runs 1999-2005",
    VERSION.strings["LegalCopyright"], "Copyright (C) K\u00ddBLSoft 1999-2005");
  eq("the translation is Czech, codepage 1200", VERSION.translation, ["0x405", "1200"]);
  ok("no VALUE kept its trailing NUL",
    Object.values(VERSION.strings).every((v) => !v.includes("\0")));
}

/* ------------------------------------------------------ 10. what the .rc omits */

heading("PALETTE, read back out of PROSTRED.PR");
{
  /* The colours are COLORREFs -- 0x00BBGGRR -- so a reader who takes them for
     #RRGGBB gets the human's yellow and the computer's green the wrong way
     round.  This does the byte reversal again, from the engine source. */
  const pr = readFileSync(join(ROOT, "src", "engine", "prostred", "prostred.pr"), "utf8");
  const colorref = (name: string): string => {
    const m = new RegExp("DWORD\\s+" + name + "\\s*=\\s*0x00([0-9A-Fa-f]{6})").exec(pr);
    if (m === null) throw new Error(name + " is no longer in prostred.pr");
    const bgr = m[1].toLowerCase();
    return "#" + bgr.slice(4, 6) + bgr.slice(2, 4) + bgr.slice(0, 2);
  };

  eq("g_barvatextucloveka is yellow, not sky blue",
    PALETTE.humanText, colorref("g_barvatextucloveka"));
  eq("g_barvatextupocitace is green", PALETTE.pokydText, colorref("g_barvatextupocitace"));
  eq("g_barvahlavickovychtextu", PALETTE.headingText, colorref("g_barvahlavickovychtextu"));
  eq("g_barvanapisuIQPokyd", PALETTE.titleText, colorref("g_barvanapisuIQPokyd"));
  eq("g_barvatextuhlavnihookna", PALETTE.windowText, colorref("g_barvatextuhlavnihookna"));
  eq("g_barvapozadizadavanivety", PALETTE.inputBackground,
    colorref("g_barvapozadizadavanivety"));
  ok("and the two that matter are genuinely different colours",
    (PALETTE.humanText as string) !== (PALETTE.pokydText as string));
}

heading("WINDOW_LAYOUT, read back out of PROSTRED.FU");
{
  const fu = readFileSync(join(ROOT, "src", "engine", "prostred", "prostred.fu"), "utf8");
  const define = (name: string): number => {
    const m = new RegExp("#define\\s+" + name + "\\s+(\\d+)").exec(fu);
    if (m === null) throw new Error(name + " is no longer in prostred.fu");
    return Number(m[1]);
  };

  eq("margin is OKRAJE", WINDOW_LAYOUT.margin, define("OKRAJE"));
  eq("spacing is ROZESTUP", WINDOW_LAYOUT.spacing, define("ROZESTUP"));

  /* PROSTRED.FU:923-924, the four insets the transcript is laid out in. */
  ok("the transcript box is OKRAJE+10 at the sides",
    fu.includes("vlevo=OKRAJE+10; vpravo=rozmery.right-OKRAJE-10;")
    && WINDOW_LAYOUT.transcript.left === WINDOW_LAYOUT.margin + 10
    && WINDOW_LAYOUT.transcript.right === WINDOW_LAYOUT.margin + 10);
  ok("OKRAJE+20 at the top and OKRAJE+45 at the bottom",
    fu.includes("nahore=OKRAJE+20; dole=rozmery.bottom-OKRAJE-45;")
    && WINDOW_LAYOUT.transcript.top === WINDOW_LAYOUT.margin + 20
    && WINDOW_LAYOUT.transcript.bottom === WINDOW_LAYOUT.margin + 45);
  ok("the transcript's font is Trebuchet MS at lfHeight 20",
    fu.includes("font.lfHeight = 20;") && fu.includes("strcpy(font.lfFaceName,\"Trebuchet MS\");")
    && WINDOW_LAYOUT.transcriptFont.lfHeight === 20);

  const dlg = readFileSync(join(ROOT, "original", "IQ Pokyd", "!Prostre", "mfcDlg.cpp"));
  const dlgText = decodeCp1250(dlg);
  ok("the window would not go below 400x220",
    dlgText.includes("ptMinTrackSize.x=400") && dlgText.includes("ptMinTrackSize.y=220")
    && WINDOW_LAYOUT.minimumSize.width === 400
    && WINDOW_LAYOUT.minimumSize.height === 220);
  ok("the title in the middle is Garamond, not the template's Trebuchet MS",
    dlgText.includes("strcpy(font.lfFaceName,\"Garamond\");")
    && WINDOW_LAYOUT.titleFont.face === "Garamond"
    && DIALOGS["IDD_HLAVNI_OKNO"].font?.face === "Trebuchet MS");
  eq("the window remembers a hundred sentences",
    WINDOW_LAYOUT.transcriptCapacity, 100);
}

/* ------------------------------------------------------- 11. dialog units */

heading("dluToPx");
{
  const base = { x: 6, y: 13 };
  eq("a rectangle converts by x*base/4 and y*base/8",
    dluToPx({ x: 0, y: 0, cx: 324, cy: 181 }, base),
    { x: 0, y: 0, width: 486, height: 294 });
  eq("and the origin stays the origin",
    dluToPx({ x: 8, y: 163, cx: 33, cy: 11 }, base),
    { x: 12, y: 265, width: 50, height: 18 });
  ok("the base units are an argument, because the .rc does not contain them",
    dluToPx({ x: 0, y: 0, cx: 4, cy: 8 }, { x: 10, y: 20 }).width === 10);
}

/* ---------------------------------------------------------- 12. round trip */

heading("everything here survives a trip back to CP1250");
{
  let strings = 0;
  const lost: string[] = [];
  const check = (text: string | null): void => {
    if (text === null || text === "") return;
    strings++;
    if (decodeCp1250(encodeCp1250(text)) !== text) lost.push(text);
  };
  for (const dialog of Object.values(DIALOGS)) {
    check(dialog.caption);
    for (const control of dialog.controls) check(control.text);
  }
  const walk = (list: RcMenuItem[]): void => {
    for (const i of list) { check(i.raw); check(i.label); walk(i.items); }
  };
  for (const menu of Object.values(MENUS)) walk(menu.items);
  for (const value of Object.values(VERSION.strings)) check(value);

  ok("all " + strings + " strings round-trip through phase 4.1's codec",
    lost.length === 0, lost.slice(0, 3).join(" | "));
}

/* ------------------------------------------------------------------ verdict */

console.log(failures === 0
  ? "\nPASS -- " + checks + " checks.  src/app/resources.ts is IQPokyd.rc, and the"
    + " two things IQPokyd.rc does not say are the engine's own."
  : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
process.exit(failures === 0 ? 0 : 1);
