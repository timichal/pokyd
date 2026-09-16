/* IQ Pokyd - test/app/caption.test.ts - phase 6.3 of PLAN.md.

   src/app/caption.ts is the only file phase 6 added that spells Czech words out
   by hand, and it does so because the author did too: the menu's status line is
   `strcat`ed together in ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI out of two
   switches full of string literals, and there is no resource script to read
   them from.  So this test does to it what test/app/resources.test.ts does to
   the .rc, and for the same reason:

     1. **nothing was invented.**  All fourteen words are looked for in
        src/engine/prostred/prostred.fu -- as CP1250 bytes, through phase 4.1's
        encoder, not as text -- and each one has to appear in the right switch,
        in the author's own order.  A diacritic lost between the codepage and a
        \uXXXX escape fails here.
     2. **nothing was reordered.**  The two switches are parsed out of the
        function again, case by case, and compared with the arrays position for
        position -- so a character list that slipped by one, which would show a
        visitor the wrong word for a setting that was right, is caught.
     3. **pohlavi 1 is male.**  The one thing the comments in the C headers had
        backwards since phase 3.1, now read straight off the `if` that prints it
        and off the debug dump that agrees with it (SLOVNIK.FU:2091).
     4. **the seven menu bitmaps are the seven mfcDlg.cpp hangs there.**  The
        SetMenuItemBitmaps calls are read back out of the file, paired with the
        LoadBitmap above each of them, and compared with MENU_BITMAPS.

   And then the whole caption, for every one of the 7 x 5 combinations, against
   a shape built from the same two arrays.

   Run it:   node test/app/caption.test.ts

   Needs nothing but node: no browser, no engine, no build.  Written by us, not
   ported; ASCII only, so every Czech letter in here is a \u escape.
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { decodeCp1250, encodeCp1250 } from "../../src/web/cp1250.ts";
import {
  CHARACTERS, GENDERS, MOODS, MENU_BITMAPS, settingsCaption,
} from "../../src/app/caption.ts";
import { MENUS, BITMAPS } from "../../src/app/resources.ts";
import type { PokydSettings } from "../../src/web/protocol.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FU = join(ROOT, "src", "engine", "prostred", "prostred.fu");
const SLOVNIK = join(ROOT, "src", "engine", "slovnik", "slovnik.fu");
const MFC = join(ROOT, "original", "IQ Pokyd", "!Prostre", "mfcDlg.cpp");

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

console.log("IQ Pokyd - phase 6.3, the menu's status line read back\n");

/* src/engine/ is UTF-8 (tools/transcode.py made it so), but the bytes that
   matter are the CP1250 ones the compiler sees, so every search below goes
   through the encoder in both directions -- the same round trip phase 4.1
   proved is lossless on this archive. */
const fuText = readFileSync(FU, "utf8");
const fuBytes = encodeCp1250(fuText);
const fuAsBytes = decodeCp1250(fuBytes);

/* ---------------------------------------- 1. the function, as the author wrote it */

heading("ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI, straight out of PROSTRED.FU");

const start = fuText.indexOf("void ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI(void) {");
ok("the function is still in prostred.fu", start !== -1);
const body = fuText.slice(start, fuText.indexOf("\nvoid ", start + 1));

/** Every `case N: strcat(conapsat,"...")` in a slice of the function, in order. */
function cases(text: string): { at: number; word: string }[] {
  const out: { at: number; word: string }[] = [];
  const re = /case (\d+): strcat\(conapsat,"([^"]*)"\); break;/g;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    out.push({ at: Number(m[1]), word: m[2] });
  }
  return out;
}

const characterSwitch = body.slice(body.indexOf("switch(g_nastaveni.charakter)"));
const moodSwitch = body.slice(body.indexOf("switch(g_nastaveni.nalada)"));

const foundCharacters = cases(characterSwitch.slice(0, characterSwitch.indexOf("switch(g_nastaveni.nalada)")));
const foundMoods = cases(moodSwitch);

eq("charakter has seven cases, 0..6", foundCharacters.map((c) => c.at),
  [0, 1, 2, 3, 4, 5, 6]);
eq("and CHARACTERS is those seven words, in that order",
  CHARACTERS.map(escape), foundCharacters.map((c) => escape(c.word)));

eq("nalada has five cases, 1..5", foundMoods.map((c) => c.at), [1, 2, 3, 4, 5]);
eq("and MOODS is those five words, in that order",
  MOODS.map(escape), foundMoods.map((c) => escape(c.word)));

/* --------------------------------------------------------- 2. the two genders */

heading("pohlavi, which the C headers had backwards until this phase");
{
  /* PROSTRED.FU:255 and :263: `== 1` is the branch that prints "muz". */
  const male = /pohlavicloveka == 1\) strcat\(conapsat,"([^"]*)"\);\s*\r?\n\s*else strcat\(conapsat,"([^"]*)"\);/
    .exec(body);
  ok("the human's branch is still an if/else on `== 1`", male !== null);
  if (male !== null) {
    eq("  pohlavi 1 says", escape(male[1]), escape(GENDERS[1]));
    eq("  and anything else says", escape(male[2]), escape(GENDERS[0]));
  }

  const computer = /pohlavipocitace == 1\) strcat\(conapsat,"([^"]*)"\);/.exec(body);
  ok("the computer's branch is the same word", computer !== null
    && computer[1] === GENDERS[1]);

  /* SLOVNIK.FU:2091 writes the same fact into the debug dump, in ASCII, which
     is the second independent witness that 1 is male. */
  const dump = readFileSync(SLOVNIK, "utf8");
  ok("SLOVNIK.FU's debug dump agrees that 1 is `muz`",
    dump.includes("nast.pohlavicloveka == 1 ? \"muz\" : \"zena\""));
}

/* ------------------------------------- 3. the words are in the file as bytes */

heading("all fourteen words found in PROSTRED.FU as runs of CP1250 bytes");
{
  const missing: string[] = [];
  for (const word of [...GENDERS, ...CHARACTERS, ...MOODS]) {
    /* decodeCp1250(encodeCp1250(file)) is the file as the compiler reads it;
       finding the word in *that* is finding it as bytes, not as characters. */
    if (!fuAsBytes.includes(word)) missing.push(escape(word));
  }
  ok("fourteen for fourteen", missing.length === 0,
    "not in the file as bytes: " + missing.join(", "));

  /* And the separators, which are as easy to get wrong as the words: " x ",
     ", " and ": " are three strcats of their own (:260, :270, :281). */
  for (const piece of [" x ", ", ", ": "]) {
    ok("the separator " + JSON.stringify(piece) + " is his",
      body.includes("strcat(conapsat,\"" + piece + "\")"));
  }
}

/* ---------------------------------------------------- 4. every combination */

heading("the caption itself, for all 7 x 5 settings");
{
  const settings = (over: Partial<PokydSettings>): PokydSettings => ({
    humanGender: 1, computerGender: 1, humanName: "", computerName: "",
    character: 3, mood: 3, moodPoints: 52,
    saveConversation: 1, useSounds: 1, useEffects: 0, formalCzech: 0,
    showLabels: 1, debugFastExit: 0, debugSpellingTolerance: 1,
    debugSpellingRecursion: 11, emulateKeyboard: 0, keyboardQwerty: 1,
    standardCursor: 0, cmdReadOnly: 0, cmdNoBackground: 0,
    ...over,
  });

  /* NASTAV_STANDARDNE (NASTAVEN.PR:25-43): both genders 1, no names,
     charakter 3, nalada 3.  This is what a first visit's menu bar says. */
  eq("the default settings", escape(settingsCaption(settings({}))),
    escape("muž x muž, průměrný: normální"));

  let wrong = 0;
  for (let character = 0; character < 7; character++) {
    for (let mood = 1; mood <= 5; mood++) {
      const got = settingsCaption(settings({ character, mood }));
      const want = GENDERS[1] + " x " + GENDERS[1] + ", "
        + CHARACTERS[character] + ": " + MOODS[mood - 1];
      if (got !== want) wrong++;
    }
  }
  eq("all 35 combinations", wrong, 0);

  eq("a woman with no name", escape(settingsCaption(settings({ humanGender: 0 }))),
    escape("žena x muž, průměrný: normální"));
  eq("and a name instead of a gender, on both sides",
    settingsCaption(settings({ humanName: "Michal", computerName: "Pokyd" })),
    "Michal x Pokyd, " + CHARACTERS[3] + ": " + MOODS[2]);

  /* The author's own bounds check is a fatal NAHLAS_CHYBU on either default. */
  const throws = (over: Partial<PokydSettings>): boolean => {
    try { settingsCaption(settings(over)); return false; } catch { return true; }
  };
  ok("charakter 7 is refused", throws({ character: 7 }));
  ok("nalada 0 is refused", throws({ mood: 0 }));
  ok("nalada 6 is refused", throws({ mood: 6 }));
}

/* ------------------------------------------------------- 5. the menu bitmaps */

heading("the seven bitmaps mfcDlg.cpp hangs on the menu");
{
  const mfc = decodeCp1250(readFileSync(MFC));
  /* The pattern is always a pair: LoadBitmap into `bitmapa`, then
     SetMenuItemBitmaps of `bitmapa` onto a command (mfcDlg.cpp:388-401). */
  const re = /bitmapa=LoadBitmap\([^,]+,MAKEINTRESOURCE\((\w+)\)\);\s*\r?\n\s*SetMenuItemBitmaps\(menu,(\w+),MF_BYCOMMAND,bitmapa,NULL\);/g;
  const pairs: Record<string, string> = {};
  for (let m = re.exec(mfc); m !== null; m = re.exec(mfc)) pairs[m[2]] = m[1];

  eq("seven pairs, and MENU_BITMAPS is exactly them", MENU_BITMAPS, pairs);

  /* Every bitmap named has to be one the .rc really declares, or phase 6.2
     never extracted a picture for it. */
  const declared = new Set(BITMAPS.map((b) => b.id));
  const unknown = Object.values(MENU_BITMAPS).filter((id) => !declared.has(id));
  eq("and every one of them is a BITMAP in IQPokyd.rc", unknown, []);

  /* SetMenuItemBitmaps is MF_BYCOMMAND, so every command named has to be one
     IDR_MENU actually has an item for. */
  const commands = new Set<string>();
  const walk = (items: typeof MENUS["IDR_MENU"]["items"]): void => {
    for (const item of items) {
      if (item.id !== null) commands.add(item.id);
      walk(item.items);
    }
  };
  walk(MENUS["IDR_MENU"].items);
  const orphans = Object.keys(MENU_BITMAPS).filter((id) => !commands.has(id));
  eq("and every command is in IDR_MENU", orphans, []);

  /* 6.2 measured all eighteen pictures; these seven are the menu's, and the
     gutter in src/app/chat.css is 14 px because of it. */
  const sizes = new Set(BITMAPS.filter((b) => Object.values(MENU_BITMAPS).includes(b.id))
    .map((b) => b.id));
  eq("all seven were extracted", sizes.size, 7);
}

/* ------------------------------------------------------------------- the end */

console.log(failures === 0
  ? "\nPASS -- " + checks + " checks.  The status line is the author's words, in"
    + " his order, and the menu's bitmaps are his pairings."
  : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
process.exit(failures === 0 ? 0 : 1);
