/* IQ Pokyd - src/app/config.ts - IQPOKYD.CFG, kept in localStorage.

   Phase 7.3 of PLAN.md.  The settings dialog is phase 7.1; this is the half
   that makes it worth opening, and it is a port of two functions rather than a
   design of ours:

       ZAPIS_NASTAVENI_DO_SOUBORU    SLOVNIK.FU:2081-2151
       PRECTI_NASTAVENI_ZE_SOUBORU   SLOVNIK.FU:1911-2079

   **The stored settings are his file, not JSON.**  That is the whole decision
   in this file, and it is not sentiment: his format is a specification with a
   parser already written against it, and writing that parser is how the port
   learns what the settings actually are.  JSON would have been a schema of our
   invention, with our own idea of what a valid mood is.  Instead the text below
   is byte for byte what IQ Pokyd wrote next to itself in 2005 --

       IQ Pokyd v0.15 - soubor s nastavenim - Ales Janda (C) KYBLSoft 1999-2005
       <blank>
       Pohlavi cloveka: muz
       ...
       Debug nastaveni: 0921

   -- and `read` is his own state machine, refusals included: an unknown
   parameter, a value he does not recognise, a missing space after the colon or
   a line longer than MAX_DELKA_JMENA all give 2, "somebody has been playing
   with the settings", and the caller starts from NASTAV_STANDARDNE.  That is
   what mfcDlg.cpp:435-442 does with the same three return values.

   **Where the file goes.**  There is no directory next to the executable, so
   the one thing that had to be chosen is localStorage under his own file name.
   Not IndexedDB, which is where phase 4.4 keeps the 18 MB dictionary: this is
   half a kilobyte of text read once at startup, and localStorage is the thing
   a browser has that is shaped like a small file.

   Two consequences of it being a browser, both written down rather than fixed:
   the stored settings are per origin and per browser profile, so a visitor who
   clears site data is a first run again; and localStorage can throw or be
   empty in a private window, so every access here is wrapped and a failure
   means "no file", which is a state the author already had a case for.

   **CRLF, and CP1250.**  He opened the file with "w" on Windows, so every \n he
   wrote reached the disk as \r\n; his reader takes either (:1960, and the
   comment "kompatibilni s Windows i Linuxem" is his).  What is written here is
   therefore CRLF, so that the text in storage is the byte stream the file had.
   The only field that can hold a non-ASCII byte is a name, and a name is
   CP1250 -- test/app/config.test.ts is what checks the whole thing survives a
   trip through phase 4.1's codec.

   Written by us, not ported.  English identifiers and ASCII only -- and unlike
   the rest of src/app/ that is not a rule being kept here, it is simply what
   the format is: the author wrote his own settings file without diacritics.
*/

import type { PokydSettings } from "../web/protocol.ts";

/** JMENO_SOUBORU_S_NASTAVENIM, KONSTANT.K:28 -- his file name, used as the
 *  storage key.  Nothing else in this port writes to localStorage. */
export const CONFIG_KEY = "IQPOKYD.CFG";

/** MAX_DELKA_JMENA, KONSTANT.K:18: the reader's buffer for both halves of a
 *  line, and it refuses anything longer. */
const FIELD_LIMIT = 50;

/** SLOVNIK.FU:2089, and the year in it is his. */
const HEADER =
  "IQ Pokyd v0.15 - soubor s nastavenim - Ales Janda (C) KYBLSoft 1999-2005";

/* The value vocabularies, each one a switch of his.  Written as arrays indexed
   by the number they stand for, because that is what both directions need. */

/** :2091-2092 writing, :1964-1974 reading.  Index 1 is a man -- see the note on
 *  MALE in src/app/settings.ts for why there is no index 0. */
const GENDERS = ["", "muz", "zena"];

/** :2096-2105 and :1983-1989, charakter 0..6. */
const CHARACTERS = ["stroj", "naivni", "klidny", "prumerny", "neduverivy",
  "naladovy", "vybusny"];

/** :2107-2114 and :1993-1997, nalada 1..5. */
const MOODS = ["", "vyborna", "dobra", "normalni", "spatna", "hrozna"];

/** :2119 and :2018-2020, emulovatklavesnici 0..2. */
const KEYBOARDS = ["zadnou", "ceskou", "slovenskou"];

/** debug_pravopisnarekurze is the one field that is not stored as itself:
 *  :2138-2143 maps five values onto five digits and :2056-2062 maps them
 *  back. */
const RECURSION: [number, string][] = [
  [0, "0"], [7, "1"], [11, "2"], [15, "3"], [100, "9"],
];

/* ------------------------------------------------------------------ writing */

const yesNo = (value: number): string => value === 0 ? "ne" : "ano";

/** ZAPIS_NASTAVENI_DO_SOUBORU, SLOVNIK.FU:2081, line for line and in his
 *  order.  The three `default: NAHLAS_CHYBU` arms are fatal errors for him and
 *  throw here, because a settings struct with a charakter of 9 in it is a bug
 *  and not a file to be written. */
export function write(settings: PokydSettings): string {
  const character = CHARACTERS[settings.character];
  const mood = MOODS[settings.mood];
  const keyboard = KEYBOARDS[settings.emulateKeyboard];
  if (character === undefined) {
    throw new RangeError("charakter is " + settings.character + ", not 0..6");
  }
  if (mood === undefined || settings.mood < 1) {
    throw new RangeError("nalada is " + settings.mood + ", not 1..5");
  }
  if (keyboard === undefined) {
    throw new RangeError("emulovatklavesnici is " + settings.emulateKeyboard);
  }

  /* :2126-2148.  Three digits and a check digit, which is the sum of their
     character codes modulo ten. */
  const fastExit = settings.debugFastExit === 0 ? "0" : "9";
  const tolerance = settings.debugSpellingTolerance === 0 ? "0" : "9";
  const recursion = RECURSION.find(
    ([value]) => value === settings.debugSpellingRecursion);
  if (recursion === undefined) {
    throw new RangeError("debug_pravopisnarekurze is "
      + settings.debugSpellingRecursion + ", not one of 0, 7, 11, 15, 100");
  }
  const digits = fastExit + tolerance + recursion[1];
  const sum = (digits.charCodeAt(0) + digits.charCodeAt(1)
    + digits.charCodeAt(2)) % 10;

  const lines = [
    HEADER,
    "",
    "Pohlavi cloveka: " + (settings.humanGender === 1 ? "muz" : "zena"),
    "Pohlavi pocitace: " + (settings.computerGender === 1 ? "muz" : "zena"),
    "Jmeno cloveka: " + settings.humanName,
    "Jmeno pocitace: " + settings.computerName,
    "Charakter: " + character,
    "Nalada: " + mood,
    "Ukladat rozhovor: " + yesNo(settings.saveConversation),
    "Pouzivat zvuky: " + yesNo(settings.useSounds),
    "Pouzivat efekty: " + yesNo(settings.useEffects),
    "Preferovat spisovnou cestinu: " + yesNo(settings.formalCzech),
    "Emulovat klavesnici: " + keyboard,
    "Klavesnice QWERTY: " + yesNo(settings.keyboardQwerty),
    "Zobrazovat standardni kurzor: " + yesNo(settings.standardCursor),
    "Nezobrazovat pozadi: " + yesNo(settings.cmdNoBackground),
    "Nezapisovat na disk: " + yesNo(settings.cmdReadOnly),
    "Zobrazovat popisky: " + yesNo(settings.showLabels),
    "Debug nastaveni: " + digits + String(sum),
  ];
  /* Every line of his ends with one, the last one included (:2148). */
  return lines.map((line) => line + "\r\n").join("");
}

/* ------------------------------------------------------------------ reading */

/** PRECTI_NASTAVENI_ZE_SOUBORU's own three return values, :1912-1914. */
export const CONFIG_MISSING = 0;
export const CONFIG_OK = 1;
export const CONFIG_BROKEN = 2;

export interface PokydConfigRead {
  /** 0 no file, 1 read, 2 the file is wrong -- his numbers. */
  status: number;
  /** What the file says, on top of what was handed in.  On 0 or 2 it is what
   *  was handed in, untouched: mfcDlg.cpp:438 calls NASTAV_STANDARDNE again on
   *  a 2, so a half-applied file is never what the engine ends up with. */
  settings: PokydSettings;
}

/** PRECTI_NASTAVENI_ZE_SOUBORU, SLOVNIK.FU:1911, as a function of the text
 *  rather than of a FILE *.  `base` is g_nastaveni as it stands -- which
 *  matters for two of the parameters, see below.
 *
 *  His parser is strict in ways worth keeping: the first two lines are skipped
 *  unread, a parameter must be followed by ": ", a line of either half may not
 *  reach MAX_DELKA_JMENA, an unknown parameter is an error rather than a thing
 *  to ignore, and the file ends when a parameter ends at EOF with nothing in
 *  it.  Everything else is a 2. */
export function read(
  text: string | null, base: PokydSettings,
): PokydConfigRead {
  if (text === null) return { status: CONFIG_MISSING, settings: base };

  const settings: PokydSettings = { ...base };
  let at = 0;
  /** getc(), with null for EOF. */
  const getc = (): string | null => at < text.length ? text[at++]! : null;
  const broken = (): PokydConfigRead =>
    ({ status: CONFIG_BROKEN, settings: base });

  /* :1931-1934 -- the header line and the empty one after it, unread. */
  for (let skipped = 0; skipped < 2; skipped++) {
    let ch = getc();
    while (ch !== null && ch !== "\n") ch = getc();
    if (ch === null) return broken();
  }

  for (;;) {
    /* :1938-1946 -- the parameter, up to the colon. */
    let parameter = "";
    for (;;) {
      const ch = getc();
      if (ch === ":") break;
      if (ch === null || parameter.length >= FIELD_LIMIT) {
        /* :1941 -- nothing before EOF is the end of the settings, and
           anything else is a broken file. */
        return parameter.length === 0 && ch === null
          ? { status: CONFIG_OK, settings }
          : broken();
      }
      parameter += ch;
    }

    /* :1948 -- and one space after it. */
    if (getc() !== " ") return broken();

    /* :1952-1960 -- the value, up to the end of the line, taking CRLF and LF
       alike. */
    let value = "";
    let end = getc();
    while (end !== null && end !== "\r" && end !== "\n") {
      if (value.length >= FIELD_LIMIT) return broken();
      value += end;
      end = getc();
    }
    if (end === null) return broken();
    if (end === "\r") getc();

    if (!apply(settings, base, parameter, value)) return broken();
  }
}

/** The body of his `if`/`else if` chain, :1968-2069.  False is his
 *  `goto CHYBAVSOUBORU`. */
function apply(
  settings: PokydSettings, base: PokydSettings,
  parameter: string, value: string,
): boolean {
  const gender = GENDERS.indexOf(value);
  const yes = value === "ano" ? 1 : value === "ne" ? 0 : -1;

  switch (parameter) {
    case "Pohlavi cloveka":
      if (gender < 1) return false;
      settings.humanGender = gender;
      return true;
    case "Pohlavi pocitace":
      if (gender < 1) return false;
      settings.computerGender = gender;
      return true;
    /* :1976-1981.  He does not check the name at all -- the writer wrote it and
       the length is capped by the reader's buffer above. */
    case "Jmeno cloveka":
      settings.humanName = value;
      return true;
    case "Jmeno pocitace":
      settings.computerName = value;
      return true;
    case "Charakter": {
      const character = CHARACTERS.indexOf(value);
      if (character === -1) return false;
      settings.character = character;
      return true;
    }
    case "Nalada": {
      const mood = MOODS.indexOf(value);
      if (mood < 1) return false;
      settings.mood = mood;
      /* :1999 -- and naladabody with it, which is what makes a stored mood the
         mood the conversation starts drifting from. */
      settings.moodPoints = mood * 15 + 7;
      return true;
    }
    case "Ukladat rozhovor":
      if (yes === -1) return false;
      settings.saveConversation = yes;
      return true;
    case "Pouzivat zvuky":
      if (yes === -1) return false;
      settings.useSounds = yes;
      return true;
    case "Pouzivat efekty":
      if (yes === -1) return false;
      settings.useEffects = yes;
      return true;
    case "Preferovat spisovnou cestinu":
      if (yes === -1) return false;
      settings.formalCzech = yes;
      return true;
    case "Emulovat klavesnici": {
      const keyboard = KEYBOARDS.indexOf(value);
      if (keyboard === -1) return false;
      settings.emulateKeyboard = keyboard;
      return true;
    }
    case "Klavesnice QWERTY":
      if (yes === -1) return false;
      settings.keyboardQwerty = yes;
      return true;
    case "Zobrazovat standardni kurzor":
      if (yes === -1) return false;
      settings.standardCursor = yes;
      return true;
    /* :2031-2040, and the two comments are his: "jen pokud to neni dane z
       prikazoveho radku".  The switch that turned it on before the file was
       read wins, which is why `base` is here at all -- src/app/main.ts's
       ?bezpozadi is the switch. */
    case "Nezobrazovat pozadi":
      if (yes === -1) return false;
      if (base.cmdNoBackground === 0) settings.cmdNoBackground = yes;
      return true;
    case "Nezapisovat na disk":
      if (yes === -1) return false;
      if (base.cmdReadOnly === 0) settings.cmdReadOnly = yes;
      return true;
    case "Zobrazovat popisky":
      if (yes === -1) return false;
      settings.showLabels = yes;
      return true;
    /* :2045-2068.  Three digits and the check digit they add up to. */
    case "Debug nastaveni": {
      if (value.length !== 4) return false;
      if (value[0] !== "0" && value[0] !== "9") return false;
      if (value[1] !== "0" && value[1] !== "9") return false;
      const recursion = RECURSION.find(([, digit]) => digit === value[2]);
      if (recursion === undefined) return false;
      const sum = (value.charCodeAt(0) + value.charCodeAt(1)
        + value.charCodeAt(2)) % 10;
      if (value[3] !== String(sum)) return false;
      settings.debugFastExit = value[0] === "9" ? 1 : 0;
      settings.debugSpellingTolerance = value[1] === "9" ? 1 : 0;
      settings.debugSpellingRecursion = recursion[0];
      return true;
    }
    default:
      return false;      /* :2069 -- an unknown parameter is a broken file */
  }
}

/* ------------------------------------------------------------- the storage */

/** What OTEVRI_SOUBOR(JMENO_SOUBORU_S_NASTAVENIM,"rb") comes back with, or
 *  null for "there is no file" -- which is what a browser with no storage at
 *  all also means, because his case 0 already covers it. */
export function loadStored(): string | null {
  try {
    return localStorage.getItem(CONFIG_KEY);
  } catch {
    return null;
  }
}

/** ZAPIS_NASTAVENI_DO_SOUBORU, with the one check the author made elsewhere:
 *  prikaz_readonlymod means write nothing at all, and his own bubble help for
 *  that checkbox says so in as many words -- "nastaveni taky ukladam k sobe do
 *  adresare" (Nastaveni.cpp:294).  Returns whether anything was written. */
export function store(settings: PokydSettings): boolean {
  if (settings.cmdReadOnly !== 0) return false;
  try {
    localStorage.setItem(CONFIG_KEY, write(settings));
    return true;
  } catch {
    /* A quota, a private window, a browser with storage turned off: he had
       NAHLAS_CHYBU(_CHYBA_ZAPISU_,_POKRACOVAT_) here (:2086) and carried on
       with the settings he had, which is exactly this. */
    return false;
  }
}
