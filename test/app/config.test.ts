/* IQ Pokyd - test/app/config.test.ts - phase 7.3 of PLAN.md.

   src/app/config.ts claims to write and read the author's own IQPOKYD.CFG.
   This holds it to that the same way test/app/settings.test.ts holds the
   dialog: by parsing his two functions back out of src/engine/slovnik/ and
   comparing, rather than by comparing the module with a second copy of itself.

     1. **the file is his file.**  Every label ZAPIS_NASTAVENI_DO_SOUBORU
        fprintf()s is read out in order and compared with the lines `write`
        produces -- header included, and it is his header with his years in it.
     2. **the reader and the writer agree.**  Every `strcmp(parametr,"...")` in
        PRECTI_NASTAVENI_ZE_SOUBORU is a line the writer writes, and every line
        the writer writes is one of those parameters.  A file this port wrote
        would be read by the 2005 binary, and the other way about.
     3. **the vocabularies are his.**  The seven characters, the five moods, the
        three keyboards and the two genders are parsed out of his strcmp chains
        with the numbers he maps them to -- and they are *not* the words the
        dialog shows: he wrote his settings file without diacritics, so
        "prumerny" here and "pr\u016fm\u011brn\u00fd" on the screen.
     4. **it round-trips.**  Every character, every mood, every keyboard, the
        names with diacritics, and the debug triple with its check digit.
     5. **a broken file is refused the way he refuses one.**  Nine ways to break
        it, each of them one of his `goto CHYBAVSOUBORU`s, and the three return
        values are his three.

   Run it:   node test/app/config.test.ts

   Needs nothing but node: no browser, no engine, no build, and no localStorage
   -- `read` and `write` are functions of text, which is what makes them
   testable here at all.  Written by us, not ported.
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { decodeCp1250, encodeCp1250 } from "../../src/web/cp1250.ts";
import {
  CONFIG_BROKEN, CONFIG_KEY, CONFIG_MISSING, CONFIG_OK, read, write,
} from "../../src/app/config.ts";
import type { PokydSettings } from "../../src/web/protocol.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SLOVNIK = join(ROOT, "src", "engine", "slovnik", "slovnik.fu");
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

console.log("IQ Pokyd - phase 7.3, IQPOKYD.CFG read back out of the engine\n");

/* src/engine/ is UTF-8; what the compiler sees is CP1250, and the settings file
   is the one place in this port where the two are the same, because the author
   wrote every word of it without a diacritic.  It goes through the codec
   anyway, so that a word that grew one would be noticed. */
const slovnik = decodeCp1250(encodeCp1250(readFileSync(SLOVNIK, "utf8")));

/** One function of his, from its opening line to the next definition at column
 *  zero.  The end has to be a *definition* and not just a line that starts with
 *  a type: `BYTE debuginfoznak,debuginfosoucet;` is the second line of the
 *  writer, and looking for "\nBYTE " alone cut the body off there. */
function body(signature: string): string {
  const start = slovnik.indexOf(signature);
  if (start === -1) return "";
  const next = /\r?\n(?:BYTE|void|int|DWORD|WORD|char|FILE) +\*?\w+\(/g;
  next.lastIndex = start + signature.length;
  const found = next.exec(slovnik);
  return found === null ? slovnik.slice(start) : slovnik.slice(start, found.index);
}

const writer = body("void ZAPIS_NASTAVENI_DO_SOUBORU(Nastaveni nast) {");
const reader = body("BYTE PRECTI_NASTAVENI_ZE_SOUBORU(void) {");

/* The settings NASTAV_STANDARDNE leaves behind (NASTAVEN.PR:25-43), which is
   what a first run writes. */
const DEFAULTS: PokydSettings = {
  humanGender: 1, computerGender: 1, humanName: "", computerName: "",
  character: 3, mood: 3, moodPoints: 52,
  saveConversation: 1, useSounds: 1, useEffects: 0, formalCzech: 0,
  showLabels: 1, debugFastExit: 0, debugSpellingTolerance: 1,
  debugSpellingRecursion: 11, emulateKeyboard: 0, keyboardQwerty: 1,
  standardCursor: 0, cmdReadOnly: 0, cmdNoBackground: 0,
};

/* ------------------------------------------------------ 1. the file is his */

heading("what ZAPIS_NASTAVENI_DO_SOUBORU writes, line for line");
{
  ok("both functions are still in slovnik.fu",
    writer.length > 0 && reader.length > 0);

  /* His header, with the years in it, read out of the fprintf rather than
     copied. */
  const header = /fprintf\(soubor,"(IQ Pokyd[^"\\]*)/.exec(writer);
  ok("the header line is in the file", header !== null);
  const lines = write(DEFAULTS).split("\r\n");
  eq("and it is the first line of what `write` produces", lines[0], header?.[1]);
  eq("with his own empty second line", lines[1], "");

  /* Every label he fprintf()s, in his order.  Two of them are written as
     "\nNalada: " because the value before them was written on its own. */
  const labels: string[] = [];
  const re = /fprintf\(soubor,"(?:\\n)?([A-Z][A-Za-z ]+): /g;
  for (let m = re.exec(writer); m !== null; m = re.exec(writer)) {
    labels.push(m[1]!);
  }
  const written = lines.slice(2).filter((line) => line.length > 0)
    .map((line) => line.slice(0, line.indexOf(":")));
  eq("seventeen labels, in his order", written, labels);

  /* :2148 -- the last line ends with a newline too, so the text ends with one
     and his reader's "parameter of length zero at EOF" is what stops it. */
  ok("the file ends with a newline", write(DEFAULTS).endsWith("\r\n"));
  eq("and there is nothing after it", lines[lines.length - 1], "");

  /* KONSTANT.K:28 -- the storage key is his file name. */
  ok("the storage key is JMENO_SOUBORU_S_NASTAVENIM",
    decodeCp1250(encodeCp1250(readFileSync(KONSTANT, "utf8")))
      .includes("#define JMENO_SOUBORU_S_NASTAVENIM \"" + CONFIG_KEY + "\""));
}

/* ------------------------------------------- 2. the reader and the writer */

heading("every parameter his reader knows is one his writer writes");
{
  const parameters: string[] = [];
  const re = /strcmp\(parametr,"([^"]+)"\)/g;
  for (let m = re.exec(reader); m !== null; m = re.exec(reader)) {
    parameters.push(m[1]!);
  }
  const written = write(DEFAULTS).split("\r\n").slice(2)
    .filter((line) => line.length > 0)
    .map((line) => line.slice(0, line.indexOf(":")));

  eq("the two lists are the same, in the same order", written, parameters);
  eq("and there are seventeen of them", parameters.length, 17);
}

/* ------------------------------------------------ 3. the vocabularies are his */

heading("the words he stores each value as");
{
  /** A `strcmp(hodnota,"x") == 0) g_nastaveni.FIELD=N` chain, as a list. */
  function chain(field: string): string[] {
    const out: string[] = [];
    const re = new RegExp(
      "strcmp\\(hodnota,\"([^\"]+)\"\\) == 0\\) g_nastaveni\\." + field
      + "=(\\d+);", "g");
    for (let m = re.exec(reader); m !== null; m = re.exec(reader)) {
      out[Number(m[2])] = m[1]!;
    }
    return out;
  }

  const characters = chain("charakter");
  const moods = chain("nalada");
  const keyboards = chain("emulovatklavesnici");

  /* What `write` says for each one, taken off the line it puts it on. */
  const valueOf = (settings: PokydSettings, label: string): string => {
    const line = write(settings).split("\r\n")
      .find((l) => l.startsWith(label + ": "));
    return line === undefined ? "" : line.slice(label.length + 2);
  };

  eq("the seven characters", characters.map((_, i) =>
    valueOf({ ...DEFAULTS, character: i }, "Charakter")), characters);
  eq("the five moods", moods.slice(1).map((_, i) =>
    valueOf({ ...DEFAULTS, mood: i + 1 }, "Nalada")), moods.slice(1));
  eq("the three keyboards", keyboards.map((_, i) =>
    valueOf({ ...DEFAULTS, emulateKeyboard: i }, "Emulovat klavesnici")),
    keyboards);

  /* And they are *not* the words on the screen: his settings file has no
     diacritics in it at all, which is the reason this module spells Czech
     without breaking the rule the rest of src/app/ keeps. */
  ok("none of them carries a diacritic",
    [...characters, ...moods, ...keyboards].every(
      (word) => /^[\x20-\x7e]*$/.test(word)));

  /* ano/ne, and the two genders. */
  eq("a checkbox that is off", valueOf({ ...DEFAULTS, useEffects: 0 },
    "Pouzivat efekty"), "ne");
  eq("and one that is on", valueOf({ ...DEFAULTS, useEffects: 1 },
    "Pouzivat efekty"), "ano");
  eq("a man", valueOf({ ...DEFAULTS, humanGender: 1 }, "Pohlavi cloveka"),
    "muz");
  eq("and a woman", valueOf({ ...DEFAULTS, humanGender: 2 }, "Pohlavi cloveka"),
    "zena");
  ok("which is what his own fprintf says",
    writer.includes("nast.pohlavicloveka == 1 ? \"muz\" : \"zena\""));
}

/* -------------------------------------------------------- 4. the round trip */

heading("write, read, and get the same settings back");
{
  const trip = (settings: PokydSettings) => read(write(settings), DEFAULTS);

  const first = trip(DEFAULTS);
  eq("a default engine's file is read as a file", first.status, CONFIG_OK);
  eq("  and says what it was given", first.settings, DEFAULTS);

  let wrong = 0;
  for (let character = 0; character < 7; character++) {
    for (let mood = 1; mood <= 5; mood++) {
      const settings = { ...DEFAULTS, character, mood, moodPoints: mood * 15 + 7 };
      const back = trip(settings);
      if (back.status !== CONFIG_OK
        || JSON.stringify(back.settings) !== JSON.stringify(settings)) wrong++;
    }
  }
  eq("all 35 characters and moods", wrong, 0);

  /* nalada is the one field the reader computes a second field from
     (SLOVNIK.FU:1999), so a file that says "dobra" comes back with naladabody
     37 whatever the engine's was. */
  const drifted = read(write({ ...DEFAULTS, mood: 2, moodPoints: 37 }),
    { ...DEFAULTS, moodPoints: 19 });
  eq("naladabody is recomputed from nalada, not stored", drifted.settings.moodPoints,
    2 * 15 + 7);

  for (let keyboard = 0; keyboard <= 2; keyboard++) {
    const back = trip({ ...DEFAULTS, emulateKeyboard: keyboard });
    eq("emulovatklavesnici " + keyboard, back.settings.emulateKeyboard, keyboard);
  }

  /* The names are the only field that can carry a byte over 0x7e, and they go
     to storage as text -- so the round trip that matters is through the codec
     as well as through the format. */
  const named = { ...DEFAULTS, humanName: "Žofie", computerName: "Pokyd" };
  const back = trip(named);
  eq("a name with diacritics survives", back.settings.humanName, "Žofie");
  ok("  and the file is CP1250-safe",
    decodeCp1250(encodeCp1250(write(named))) === write(named));
  eq("an empty name is a line with nothing after the space",
    write(DEFAULTS).includes("Jmeno cloveka: \r\n"), true);
  eq("  and reads back as empty", trip(DEFAULTS).settings.humanName, "");

  /* The debug triple and its check digit, all five recursion depths. */
  for (const [depth, digit] of [[0, "0"], [7, "1"], [11, "2"], [15, "3"],
    [100, "9"]] as [number, string][]) {
    const settings = { ...DEFAULTS, debugSpellingRecursion: depth };
    const text = write(settings);
    ok("debug_pravopisnarekurze " + depth + " is written as " + digit,
      text.includes("Debug nastaveni: 09" + digit));
    eq("  and read back", trip(settings).settings.debugSpellingRecursion, depth);
  }
  const fast = trip({ ...DEFAULTS, debugFastExit: 1, debugSpellingTolerance: 0 });
  eq("and so is the rest of the triple",
    [fast.settings.debugFastExit, fast.settings.debugSpellingTolerance], [1, 0]);
}

/* --------------------------------------------------- 5. and a broken file */

heading("the three return values, and nine ways to earn the third");
{
  eq("no file at all is 0, and the settings are untouched",
    read(null, DEFAULTS).status, CONFIG_MISSING);
  eq("  and it hands back what it was given", read(null, DEFAULTS).settings,
    DEFAULTS);

  const good = write(DEFAULTS);
  const broken: [string, string][] = [
    ["a parameter nobody knows",
      good.replace("Pouzivat zvuky", "Pouzivat neco")],
    ["a value nobody knows", good.replace("Charakter: prumerny", "Charakter: bozi")],
    ["ano or ne, misspelt", good.replace("Pouzivat zvuky: ano", "Pouzivat zvuky: jo")],
    ["a gender that is not one", good.replace("Pohlavi cloveka: muz",
      "Pohlavi cloveka: ano")],
    ["no space after the colon", good.replace("Nalada: ", "Nalada:")],
    ["a file of one line", good.split("\r\n")[0] + "\r\n"],
    ["the last line cut off", good.slice(0, good.length - 2)],
    ["a check digit that does not add up",
      good.replace(/Debug nastaveni: (\d\d\d)\d/, "Debug nastaveni: $10")],
    ["a line longer than MAX_DELKA_JMENA",
      good.replace("Jmeno cloveka: ", "Jmeno cloveka: " + "x".repeat(60))],
  ];
  for (const [what, text] of broken) {
    const result = read(text, DEFAULTS);
    eq(what + " is a 2", result.status, CONFIG_BROKEN);
    if (result.status === CONFIG_BROKEN) {
      eq("  and nothing from it is applied", result.settings, DEFAULTS);
    }
  }

  /* And the one place the format is more trusting than it looks, found by
     expecting a refusal and not getting one: :1931-1934 skips the first two
     lines *without reading them*, so a file that has lost its header is not
     refused -- the third line is eaten in the header's place and whatever it
     said is quietly not applied.  That is his behaviour and it is kept. */
  const beheaded = read(good.split("\r\n").slice(1).join("\r\n"),
    { ...DEFAULTS, humanGender: 2 });
  eq("a file with no header line is still a file", beheaded.status, CONFIG_OK);
  eq("  but the setting that moved up into the header's place is lost",
    beheaded.settings.humanGender, 2);
  eq("  and everything after it is read", beheaded.settings.computerGender, 1);

  /* The two parameters that are only honoured if the command line has not
     already set them -- his own comment, :2033 and :2038. */
  const off = write({ ...DEFAULTS, cmdNoBackground: 0 });
  const fromSwitch = read(off, { ...DEFAULTS, cmdNoBackground: 1 });
  eq("-bezpozadi wins over a file that says otherwise",
    fromSwitch.settings.cmdNoBackground, 1);
  const fromFile = read(write({ ...DEFAULTS, cmdNoBackground: 1 }), DEFAULTS);
  eq("  but a file can turn it on when the switch did not",
    fromFile.settings.cmdNoBackground, 1);
  ok("which is what his two comments say",
    reader.includes("//jen pokud to neni dane z prikazoveho radku"));
}

/* ------------------------------------------------------------------- the end */

console.log(failures === 0
  ? "\nPASS -- " + checks + " checks.  The settings this port stores are the"
    + " file IQ Pokyd wrote next to itself in 2005."
  : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
process.exit(failures === 0 ? 0 : 1);
