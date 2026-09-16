/* IQ Pokyd - test/app/settings.test.ts - phase 7.1 of PLAN.md.

   src/app/settings.ts claims to be CNastaveni with the window taken off.  This
   is what holds it to that, and it does to !Prostre/Nastaveni.cpp what
   test/app/caption.test.ts does to PROSTRED.FU: it parses the author's own
   functions back out of the file and compares them with the module, rather than
   comparing the module with a second copy of itself.

     1. **the two list boxes are his two lists.**  The twelve LB_ADDSTRING calls
        at :72-86 are read out in order and compared with CHARACTERS and MOODS
        -- which src/app/caption.ts already holds against the menu's status
        line, so this is what says the dialog and the menu bar name a character
        the same way.  A list that slipped by one would show a visitor the wrong
        word for a setting that was right.
     2. **pohlavi is 1 or 2.**  Three witnesses out of three different files,
        because this is the number every comment in the port had wrong until
        phase 6.3 got half of it and 7.1 got the rest.
     3. **the two pages are his two pages.**  Every ZOBRAZ_NA_DIALOGU_POLICKO
        call in OnZakladniNastaveni and OnRozsireneNastaveni is parsed back out
        with its 0 or 1, compared with BASIC_CONTROLS and ADVANCED_CONTROLS in
        his order, and checked to cover IDD_NASTAVENI exactly: the two lists
        plus the four controls that are on neither page are all 33 of them.
     4. **a name is what ZKONTROLUJ_SPRAVNOST_ZNAKU_VE_JMENE says it is.**  The
        cases his loop distinguishes, including the two nobody would guess: a
        trailing space truncates and an inner space refuses.
     5. **OnOK writes what he writes.**  Field by field against a settings
        struct, and the one that is not a field: the mood goes through
        pokyd_set_mood only when the list box moved, which is what keeps twenty
        sentences of drift from being undone by an OK on a name.
     6. **nothing was invented.**  All four Czech strings this port spells by
        hand are looked for in Nastaveni.cpp as runs of CP1250 bytes, and the
        two group captions the basic page puts back are compared with the
        template's own.

   Run it:   node test/app/settings.test.ts

   Needs nothing but node: no browser, no engine, no build.  Written by us, not
   ported; the Czech in here is read out of the archive, never typed.
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { decodeCp1250, encodeCp1250 } from "../../src/web/cp1250.ts";
import {
  ADVANCED_CONTROLS, ADVANCED_GROUP_CAPTIONS, BASIC_CONTROLS, CHARACTERS,
  COMPUTER_NAME_ERROR, FEMALE, HUMAN_NAME_ERROR, MALE, MOODS, NAME_ERROR_TITLE,
  NAME_LIMIT, checkName, edit, formFromSettings, moodForPoints, moodPointsFor,
  truncateName,
} from "../../src/app/settings.ts";
import { DIALOGS } from "../../src/app/resources.ts";
import type { PokydSettings } from "../../src/web/protocol.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const NASTAVENI = join(ROOT, "original", "IQ Pokyd", "!Prostre", "Nastaveni.cpp");
const PROSTRED = join(ROOT, "src", "engine", "prostred", "prostred.fu");
const SLOVNIK = join(ROOT, "src", "engine", "slovnik", "slovnik.fu");
const VSTUP = join(ROOT, "src", "engine", "vstup", "vstup.fu");
const NASTAVEN = join(ROOT, "src", "engine", "vstup", "nastaven.pr");
const KONSTANT = join(ROOT, "src", "engine", "konstant.k");

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

function heading(text: string): void { console.log("\n" + text); }

/** What a Czech string looks like written as this repository writes it. */
function escape(text: string): string {
  return Array.from(text).map((ch) => {
    const code = ch.charCodeAt(0);
    return code > 0x7e ? "\\u" + code.toString(16).padStart(4, "0") : ch;
  }).join("");
}

console.log("IQ Pokyd - phase 7.1, CNastaveni read back out of the archive\n");

/* Nastaveni.cpp is CP1250 on disk and never went through tools/transcode.py --
   it is one of the !Prostre files BEZ_PROSTREDI leaves behind -- so it is
   decoded rather than read as text. */
const cpp = decodeCp1250(readFileSync(NASTAVENI));
/* The engine's own files are UTF-8 in src/engine/, so they go the other way:
   encode, decode, and search the bytes the compiler actually sees. */
const asBytes = (path: string): string =>
  decodeCp1250(encodeCp1250(readFileSync(path, "utf8")));

/** One function of his, from its opening line to the next one at column 0. */
function body(text: string, signature: string): string {
  const start = text.indexOf(signature);
  if (start === -1) return "";
  const end = text.indexOf("\nvoid ", start + 1);
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

/* --------------------------------------------- 1. the two lists, as he fills them */

heading("IDC_CHARAKTER and IDC_NALADA, filled by twelve LB_ADDSTRINGs");
{
  const init = body(cpp, "BOOL CNastaveni::OnInitDialog() {");
  ok("OnInitDialog is still in Nastaveni.cpp", init.length > 0);

  const added = (id: string): string[] => {
    const out: string[] = [];
    const re = new RegExp(
      "SendDlgItemMessage\\(" + id + ",LB_ADDSTRING,0,\\(LPARAM\\)\"([^\"]*)\"\\);",
      "g");
    for (let m = re.exec(init); m !== null; m = re.exec(init)) out.push(m[1]!);
    return out;
  };

  eq("the seven characters, in his order",
    added("IDC_CHARAKTER").map(escape), CHARACTERS.map(escape));
  eq("the five moods, in his order",
    added("IDC_NALADA").map(escape), MOODS.map(escape));

  /* :80 and :88 -- the two selections are not indexed the same way, which is
     the one thing about these lists that is easy to get wrong. */
  ok("charakter is selected by its own value",
    init.includes("LB_SETCURSEL,g_nastaveni.charakter"));
  ok("and nalada by its value minus one",
    init.includes("LB_SETCURSEL,g_nastaveni.nalada-1"));
}

/* ----------------------------------------------------- 2. pohlavi is 1 or 2 */

heading("pohlavi, from three files that have no reason to agree by accident");
{
  const onOk = body(cpp, "void CNastaveni::OnOK() {");
  /* :140-143.  The test is on the *female* radio, so the male branch is the
     `== 0`, and the two numbers are what the whole port turns on. */
  const written = /IsDlgButtonChecked\(IDC_CLOVEKZENA\) == 0\) g_nastaveni\.pohlavicloveka=(\d);\s*\r?\n\s*else g_nastaveni\.pohlavicloveka=(\d);/
    .exec(onOk);
  ok("OnOK writes the human's gender as two numbers", written !== null);
  if (written !== null) {
    eq("  not-female is", Number(written[1]), MALE);
    eq("  and female is", Number(written[2]), FEMALE);
  }

  /* SLOVNIK.FU:1922-1923 and :1970 -- MUZ__ 3, ZENA__ 4, and the value stored
     is kodhodnoty - MUZ__ + 1, which is 1 and 2. */
  const slovnik = asBytes(SLOVNIK);
  ok("the settings file reader defines MUZ__ 3 and ZENA__ 4",
    slovnik.includes("#define MUZ__ 3") && slovnik.includes("#define ZENA__ 4"));
  ok("and stores kodhodnoty-MUZ__+1, which is 1 for a man and 2 for a woman",
    slovnik.includes("g_nastaveni.pohlavicloveka=kodhodnoty-MUZ__+1;"));

  /* VSTUP.FU:1070 -- and this is why it matters: the number is a rod. */
  ok("VSTUP.FU assigns pohlavi straight into Typ_slova::rod",
    asBytes(VSTUP).includes(
      "nova_trida.rod[poziceslova]=g_nastaveni.pohlavicloveka;"));

  /* NASTAVEN.PR:26, the default both the golden conversation and phase 6.4's
     greeting are recorded under. */
  ok("NASTAV_STANDARDNE starts both of them at 1",
    asBytes(NASTAVEN).includes("pohlavicloveka=1; pohlavipocitace=1;"));

  /* PROSTRED.FU:779 is the fourth witness and the only one that names the 2. */
  ok("and PROSTRED.FU inflects on `== 2` for the feminine",
    asBytes(PROSTRED).includes("g_nastaveni.pohlavicloveka == 2"));
}

/* --------------------------------------------------------- 3. the two pages */

heading("the two pages, parsed back out of his two functions");
{
  const shown = (signature: string, want: string): string[] => {
    const text = body(cpp, signature);
    const out: string[] = [];
    const re = /ZOBRAZ_NA_DIALOGU_POLICKO\(GetDlgItem\((\w+)\),(\d)\);/g;
    for (let m = re.exec(text); m !== null; m = re.exec(text)) {
      if (m[2] === want) out.push(m[1]!);
    }
    return out;
  };

  const basic = shown("void CNastaveni::OnZakladniNastaveni() {", "1");
  const advanced = shown("void CNastaveni::OnRozsireneNastaveni() {", "1");

  eq("OnZakladniNastaveni shows exactly BASIC_CONTROLS, in his order",
    basic, BASIC_CONTROLS);
  eq("OnRozsireneNastaveni shows exactly ADVANCED_CONTROLS, in his order",
    advanced, ADVANCED_CONTROLS);

  /* The two are mirror images: what one shows the other hides, and neither
     touches anything that is on both. */
  eq("and each one hides what the other shows",
    shown("void CNastaveni::OnZakladniNastaveni() {", "0"), ADVANCED_CONTROLS);
  eq("  both ways", shown("void CNastaveni::OnRozsireneNastaveni() {", "0"),
    BASIC_CONTROLS);

  /* Between them they account for the whole template but for the four that are
     never hidden -- which is what src/app/dialog.ts relies on when it sets
     their mnemonics once and never again. */
  const template = DIALOGS["IDD_NASTAVENI"]!;
  const paged = new Set([...BASIC_CONTROLS, ...ADVANCED_CONTROLS]);
  const always = template.controls.map((c) => c.id).filter((id) => !paged.has(id));
  eq("everything else on IDD_NASTAVENI is on both pages", always.sort(),
    ["IDCANCEL", "IDC_RAMECEK1", "IDC_RAMECEK2", "IDC_ROZSIRENENASTAVENI",
      "IDC_ZAKLADNINASTAVENI", "IDOK"]);
  eq("so the two lists and those six are the whole dialog",
    paged.size + always.length, template.controls.length);

  /* Every id named in either list has to be a control that exists, or the
     dialog would be showing and hiding nothing. */
  const declared = new Set(template.controls.map((c) => c.id));
  eq("and every id in them is a control of the template",
    [...paged].filter((id) => !declared.has(id)), []);
}

/* -------------------------------------------------------------- 4. the names */

heading("ZKONTROLUJ_SPRAVNOST_ZNAKU_VE_JMENE, case by case");
{
  ok("the function is still where the port says it is",
    asBytes(PROSTRED).includes("BYTE ZKONTROLUJ_SPRAVNOST_ZNAKU_VE_JMENE"));

  const cases: [string, boolean, string][] = [
    ["Michal", true, "Michal"],
    ["", true, ""],
    ["   ", true, ""],
    ["  Michal", true, "Michal"],
    ["Michal   ", true, "Michal"],
    ["  Michal  ", true, "Michal"],
    ["Michal Novak", false, "Michal Novak"],
    ["  Michal Novak  ", false, "  Michal Novak  "],
    ["Michal\tNovak", false, "Michal\tNovak"],
    /* A CP1250 letter is a negative char, which is why his loop tests for it
       separately -- and why a name of them is one word and not a space. */
    ["Žofie", true, "Žofie"],
    ["Žofie Nováková", false, "Žofie Nováková"],
  ];
  for (const [input, good, want] of cases) {
    const got = checkName(input);
    eq(JSON.stringify(escape(input)) + " is "
      + (good ? "a name" : "two words"),
      [got.ok, escape(got.name)], [good, escape(want)]);
  }

  /* MAX_DELKA_JMENA, and it is 50 rather than the struct's 100. */
  ok("MAX_DELKA_JMENA is what NAME_LIMIT says",
    asBytes(KONSTANT).includes("#define MAX_DELKA_JMENA " + NAME_LIMIT));
  eq("a long name is cut to it", truncateName("x".repeat(80)).length, NAME_LIMIT);
  eq("and a short one is not", truncateName("Michal"), "Michal");
  /* Bytes, not characters: 50 Czech letters are 50 CP1250 bytes. */
  eq("fifty accented letters still fit", truncateName("ž".repeat(50)).length, 50);
}

/* ---------------------------------------------------- 5. OnOK, field by field */

const DEFAULTS: PokydSettings = {
  humanGender: 1, computerGender: 1, humanName: "", computerName: "",
  character: 3, mood: 3, moodPoints: 52,
  saveConversation: 1, useSounds: 1, useEffects: 0, formalCzech: 0,
  showLabels: 1, debugFastExit: 0, debugSpellingTolerance: 1,
  debugSpellingRecursion: 11, emulateKeyboard: 0, keyboardQwerty: 1,
  standardCursor: 0, cmdReadOnly: 0, cmdNoBackground: 0,
};

heading("OnInitDialog fills the controls and OnOK reads them back");
{
  /* NASTAV_STANDARDNE's own defaults are the ones a first visit has. */
  const form = formFromSettings(DEFAULTS);
  eq("a default engine fills the dialog as he filled it", form, {
    humanGender: MALE, computerGender: MALE, humanName: "", computerName: "",
    character: 3, mood: 3,
    saveConversation: true, useSounds: true, useEffects: false,
    formalCzech: false,
    emulateKeyboard: false, slovakKeyboard: false, keyboardQwerty: true,
    standardCursor: false, noBackground: false, readOnly: false,
    showLabels: true,
  });

  /* And back out again, untouched: an OK that changed nothing changes
     nothing. */
  const unchanged = edit(DEFAULTS, form);
  eq("OK with nothing touched writes the same settings",
    unchanged.settings, DEFAULTS);
  eq("  and does not put the mood through pokyd_set_mood", unchanged.mood, null);
  eq("  and does not redraw the background", unchanged.redrawBackground, false);
  eq("  and refuses nothing", unchanged.refused, null);
}

heading("what each control does to g_nastaveni");
{
  const after = (over: Partial<ReturnType<typeof formFromSettings>>) =>
    edit(DEFAULTS, { ...formFromSettings(DEFAULTS), ...over });

  eq("the female radio writes a 2, not a 0",
    after({ humanGender: FEMALE }).settings.humanGender, FEMALE);
  eq("  on the computer's side too",
    after({ computerGender: FEMALE }).settings.computerGender, FEMALE);
  eq("a name is trimmed on its way in",
    after({ humanName: "  Michal  " }).settings.humanName, "Michal");
  eq("  and the computer's the same",
    after({ computerName: " Pokyd " }).settings.computerName, "Pokyd");
  eq("the character is the list box's own index",
    after({ character: 6 }).settings.character, 6);
  eq("spisovna cestina is a 1",
    after({ formalCzech: true }).settings.formalCzech, 1);
  eq("ukladatrozhovor can be turned off",
    after({ saveConversation: false }).settings.saveConversation, 0);
  eq("pouzivatefekty can be turned on",
    after({ useEffects: true }).settings.useEffects, 1);

  /* :179-183 -- one field out of three controls. */
  eq("no emulation is 0", after({ emulateKeyboard: false }).settings.emulateKeyboard, 0);
  eq("the Czech keyboard is 1",
    after({ emulateKeyboard: true }).settings.emulateKeyboard, 1);
  eq("and the Slovak one is 2",
    after({ emulateKeyboard: true, slovakKeyboard: true })
      .settings.emulateKeyboard, 2);

  /* :188-197 -- `prekreslipozadi` is set only when the checkbox moved. */
  const off = after({ noBackground: true });
  eq("ticking the background off sets it", off.settings.cmdNoBackground, 1);
  eq("  and asks for the redraw", off.redrawBackground, true);
  const stays = edit({ ...DEFAULTS, cmdNoBackground: 1 },
    { ...formFromSettings({ ...DEFAULTS, cmdNoBackground: 1 }) });
  eq("leaving it where it was does not", stays.redrawBackground, false);
}

heading("the mood, which is the one setting OnOK does not simply assign");
{
  /* NASTAVEN.PR:17-24, both directions. */
  eq("naladabody is nalada*15+7", [1, 2, 3, 4, 5].map(moodPointsFor),
    [22, 37, 52, 67, 82]);
  eq("and nalada is naladabody/15, clamped",
    [0, 14, 15, 30, 52, 82, 90].map(moodForPoints), [1, 1, 1, 2, 3, 5, 5]);

  /* The conversation has drifted the engine to nalada 1 / naladabody 22, and
     the dialog is opened and OK'd without the list box being touched.  His
     `if` at :166 is what stops the drift being thrown away. */
  const drifted: PokydSettings = { ...DEFAULTS, mood: 1, moodPoints: 19 };
  const untouched = edit(drifted, formFromSettings(drifted));
  eq("an OK that does not touch the list leaves naladabody alone",
    untouched.mood, null);
  eq("  and the settings still carry the drifted points",
    untouched.settings.moodPoints, 19);

  const moved = edit(drifted, { ...formFromSettings(drifted), mood: 4 });
  eq("a moved list box is reported for pokyd_set_mood", moved.mood, 4);
  /* pokyd_set_mood is what recomputes naladabody (pokyd_api.cpp), so `edit`
     deliberately does not: the struct still carries the old pair. */
  eq("  and the struct is not the place it happens", moved.settings.mood, 1);
}

heading("a name that is two words, which is the one refusal he has");
{
  const refused = edit(DEFAULTS,
    { ...formFromSettings(DEFAULTS), humanName: "Michal Novak" });
  ok("the human's name is refused", refused.refused !== null);
  eq("  on his own edit control", refused.refused?.control, "IDC_JMENOCLOVEKA");
  eq("  with his title", refused.refused?.title, NAME_ERROR_TITLE);
  eq("  and his words", escape(refused.refused?.message ?? ""),
    escape(HUMAN_NAME_ERROR));
  eq("  and nothing at all is applied", refused.settings, DEFAULTS);

  const computer = edit(DEFAULTS,
    { ...formFromSettings(DEFAULTS), computerName: "IQ Pokyd" });
  eq("the computer's name has a message of its own",
    computer.refused?.control, "IDC_JMENOPOCITACE");
  eq("  and it is the second one", escape(computer.refused?.message ?? ""),
    escape(COMPUTER_NAME_ERROR));

  /* :145-159: the human's edit is read first, so a dialog with both wrong
     stops on the human's -- which is the one the focus goes to. */
  const both = edit(DEFAULTS, {
    ...formFromSettings(DEFAULTS),
    humanName: "Michal Novak", computerName: "IQ Pokyd",
  });
  eq("with both wrong it is the human's that is reported",
    both.refused?.control, "IDC_JMENOCLOVEKA");
}

/* --------------------------------------------- 6. nothing here was invented */

heading("the four Czech strings this port spells, found in Nastaveni.cpp");
{
  const wanted: [string, string][] = [
    ["the title of both messages", NAME_ERROR_TITLE],
    ["the human's name message", HUMAN_NAME_ERROR],
    ["the computer's name message", COMPUTER_NAME_ERROR],
    ["the advanced page's first group", ADVANCED_GROUP_CAPTIONS["IDC_RAMECEK1"]!],
    ["the advanced page's second group", ADVANCED_GROUP_CAPTIONS["IDC_RAMECEK2"]!],
  ];
  for (const [what, text] of wanted) {
    ok(what + " is his, byte for byte", cpp.includes(text),
      JSON.stringify(escape(text)));
  }

  /* The two captions the *basic* page puts back are not spelled in this port at
     all -- src/app/dialog.ts reads them from the template -- so what has to be
     true is that his SetWindowText says the same thing the template does. */
  const template = DIALOGS["IDD_NASTAVENI"]!;
  const caption = (id: string): string =>
    template.controls.find((c) => c.id === id)!.text!;
  for (const id of ["IDC_RAMECEK1", "IDC_RAMECEK2"]) {
    ok("the basic page puts back what IQPokyd.rc already says for " + id,
      cpp.includes("GetDlgItem(" + id + ")->SetWindowText(\""
        + caption(id) + "\");"), JSON.stringify(escape(caption(id))));
  }

  /* And the advanced ones are set the same way, so the pairing is checked
     rather than assumed. */
  for (const id of ["IDC_RAMECEK1", "IDC_RAMECEK2"]) {
    ok("and the advanced page swaps in " + escape(ADVANCED_GROUP_CAPTIONS[id]!),
      cpp.includes("GetDlgItem(" + id + ")->SetWindowText(\""
        + ADVANCED_GROUP_CAPTIONS[id]! + "\");"));
  }
}

/* ------------------------------------------------------------------- the end */

console.log(failures === 0
  ? "\nPASS -- " + checks + " checks.  The settings dialog is his dialog: his"
    + " lists, his two pages, his name check and his OnOK."
  : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
process.exit(failures === 0 ? 0 : 1);
