/* IQ Pokyd - src/app/settings.ts - CNastaveni, with the window taken off.

   Phase 7.1 of PLAN.md.  !Prostre/Nastaveni.cpp is 438 lines and about three
   quarters of it is MFC: CheckDlgButton, SendDlgItemMessage, ShowWindow.  What
   is left when those are gone is small, exact and worth porting on its own --
   which list goes in which order, which button writes which number, what counts
   as a name, and what OnOK does to g_nastaveni -- and that is this file.
   src/app/dialog.ts draws it.

   The split is the one src/app/caption.ts and src/app/menu.ts already have, and
   for the same reason: a node test can have this file and cannot have a DOM.

   **Four things here took reading the C to get right.**

     1. **pohlavi is 1 or 2, and never 0.**  Every comment in this port said
        "1 male, 0 female" from phase 3.1 until this one, and the zero was
        invented -- the author's own header says "0...muz, 1...zena"
        (IQPokyd.h:84), which is wrong twice over and is where it came from.
        Three witnesses say 1 and 2: NASTAV_STANDARDNE writes 1 with "muzi" in
        the margin (NASTAVEN.PR:26), PRECTI_NASTAVENI_ZE_SOUBORU computes
        `kodhodnoty-MUZ__+1` off MUZ__ 3 and ZENA__ 4 (SLOVNIK.FU:1970), and
        OnOK writes 1 or 2 (Nastaveni.cpp:140-143).  It matters because the
        number is used as a *rod*: VSTUP.FU:1070 assigns it straight into
        Typ_slova::rod, where 1 and 2 are the masculine and feminine the
        paradigms are indexed by.  A 0 there is not a gender at all.
        test/app/settings.test.ts holds all three witnesses.

     2. **the mood is written only if it moved.**  Nastaveni.cpp:165-168 reads
        the list box, and if the value differs from g_nastaveni.nalada it
        assigns it *and* calls SPOCITEJ_NALADABODY_Z_NALADY, which is
        naladabody = nalada*15+7.  If it did not move, naladabody is left where
        the conversation drifted it.  So an OK that changed only a name must not
        reset the mood the last twenty sentences earned -- which is exactly the
        difference between pokyd_set_settings and pokyd_set_mood, and why
        `edit()` below reports the two separately.

     3. **a name is one word, and the check is not a regex.**
        ZKONTROLUJ_SPRAVNOST_ZNAKU_VE_JMENE (PROSTRED.FU:56-81) trims the front,
        and then at the first space it looks at everything after it: if it is
        all spaces the name is truncated there, and if it is not, the name is
        refused.  So "  Michal  " is Michal and "Michal Novak" is an error with
        a MessageBox of its own.

     4. **the dialog truncates at 50 bytes, not at 100.**  The struct is
        char[101] on both sides of the API, but OnOK copies through
        `strncpy(...,MAX_DELKA_JMENA)` and MAX_DELKA_JMENA is 50 (KONSTANT.K:18)
        -- the same 50 PRECTI_NASTAVENI_ZE_SOUBORU parses with.  Bytes, not
        characters: a name of Czech letters is a CP1250 byte each.

   Written by us, not ported.  English identifiers, and the only Czech spelled
   by hand is the four strings Nastaveni.cpp holds as literals rather than as
   resources -- the two group captions the advanced page swaps in, and the two
   messages a two-word name gets.  test/app/settings.test.ts finds every one of
   them in that file as a run of CP1250 bytes, which is the rule
   test/app/resources.test.ts keeps for the whole of src/app/.
*/

import { decodeCp1250, encodeCp1250 } from "../web/cp1250.ts";
import type { PokydSettings } from "../web/protocol.ts";
import { CHARACTERS, MOODS } from "./caption.ts";

/* ------------------------------------------------------------- the two genders */

/** pohlavicloveka / pohlavipocitace, and see 1. in the header: these are the
 *  only two values either field ever holds. */
export const MALE = 1;
export const FEMALE = 2;

/* --------------------------------------------------------------- the two lists */

/** IDC_CHARAKTER and IDC_NALADA, filled by twelve LB_ADDSTRINGs at
 *  Nastaveni.cpp:72-86 -- the same words, in the same order, that the menu's
 *  status line is built from.  They are re-exported rather than re-spelled so
 *  that there is one place they live: test/app/caption.test.ts holds them
 *  against PROSTRED.FU, and test/app/settings.test.ts checks that his two
 *  LB_ADDSTRING runs are those same two lists. */
export { CHARACTERS, MOODS };

/* ---------------------------------------------------------------- the names */

/** MAX_DELKA_JMENA, KONSTANT.K:18.  CP1250 bytes -- see 4. in the header. */
export const NAME_LIMIT = 50;

/** What ZKONTROLUJ_SPRAVNOST_ZNAKU_VE_JMENE says about a name
 *  (PROSTRED.FU:56-81): whether it is usable, and the trimmed name if it is.
 *
 *  Done on the engine's own bytes rather than on the characters, because his
 *  tests are byte tests: `jmeno[p] > 0 && jmeno[p] <= ' '` is a space or a
 *  control character, and `jmeno[p] < 0` is a CP1250 letter with a diacritic,
 *  which is negative only because char is signed.  Unsigned, his two conditions
 *  for "this is a real character" collapse into the one below. */
export function checkName(name: string): { ok: boolean; name: string } {
  const bytes = encodeCp1250(name);

  /* :60-62 -- the leading spaces come off first, and the rest is measured
     from there. */
  let start = 0;
  while (start < bytes.length && bytes[start]! > 0 && bytes[start]! <= 0x20) start++;
  const rest = bytes.subarray(start);

  for (let at = 0; at < rest.length; at++) {
    if (rest[at]! > 0x20) continue;
    /* :66-71 -- a space.  Everything after it decides which kind: all spaces
       and the name is cut here, anything else and this is two words. */
    for (let ahead = at + 1; ahead < rest.length; ahead++) {
      if (rest[ahead]! > 0x20) return { ok: false, name };
    }
    return { ok: true, name: decodeCp1250(rest.subarray(0, at)) };
  }
  return { ok: true, name: decodeCp1250(rest) };
}

/** `strncpy(g_nastaveni.jmenocloveka, jmeno, MAX_DELKA_JMENA)` -- the cut is by
 *  byte, and every CP1250 character is one, so it is a slice of the bytes. */
export function truncateName(name: string): string {
  const bytes = encodeCp1250(name);
  return bytes.length <= NAME_LIMIT ? name
    : decodeCp1250(bytes.subarray(0, NAME_LIMIT));
}

/* ----------------------------------------------------------------- the mood */

/** Nastaveni::SPOCITEJ_NALADABODY_Z_NALADY, NASTAVEN.PR:17-19. */
export function moodPointsFor(mood: number): number {
  return mood * 15 + 7;
}

/** Nastaveni::SPOCITEJ_NALADU_PODLE_NALADABODY, NASTAVEN.PR:20-24 -- the other
 *  direction, which is what INTELIG.FU:532 runs after every sentence and what
 *  makes the mood in the menu bar drift. */
export function moodForPoints(points: number): number {
  const mood = Math.floor(points / 15);
  if (mood < 1) return 1;
  if (mood > MOODS.length) return MOODS.length;
  return mood;
}

/* ----------------------------------------------------------------- the form */

/** What is on the dialog, control by control, in the order OnInitDialog fills
 *  them.  One field per control and not one per setting -- the keyboard is
 *  three controls and one setting, prikaz_nezobrazovatpozadi is one of each --
 *  because what OnOK reads is controls. */
export interface PokydSettingsForm {
  humanGender: number;            /* IDC_CLOVEKMUZ / IDC_CLOVEKZENA */
  computerGender: number;         /* IDC_POCITACMUZ / IDC_POCITACZENA */
  humanName: string;              /* IDC_JMENOCLOVEKA */
  computerName: string;           /* IDC_JMENOPOCITACE */
  character: number;              /* IDC_CHARAKTER, 0..6 */
  mood: number;                   /* IDC_NALADA, 1..5 */

  saveConversation: boolean;      /* IDC_UKLADATROZHOVOR */
  useSounds: boolean;             /* IDC_POUZIVATZVUKY */
  useEffects: boolean;            /* IDC_POUZIVATEFEKTY */
  formalCzech: boolean;           /* IDC_SPISOVNACESTINA */

  emulateKeyboard: boolean;       /* IDC_EMULOVATKLAVESNICI */
  slovakKeyboard: boolean;        /* IDC_EMULOVATSLOVENSKOUKLAVESNICI */
  keyboardQwerty: boolean;        /* IDC_KLAVESNICEQWERTY */
  standardCursor: boolean;        /* IDC_ZOBRAZOVATSTANDARDNIKURZOR */
  noBackground: boolean;          /* IDC_NEZOBRAZOVATPOZADI */
  readOnly: boolean;              /* IDC_READONLYMOD */
  showLabels: boolean;            /* IDC_ZOBRAZOVATPOPISKY */
}

/** CNastaveni::OnInitDialog, Nastaveni.cpp:61-128, minus the tool tips.
 *
 *  His `if` on the gender is an `== 1` with an else, so anything that is not a
 *  1 puts the mark on "zena" -- kept, rather than tidied into a `=== FEMALE`,
 *  because a settings file with a 0 in it would then land where it landed in
 *  2005. */
export function formFromSettings(settings: PokydSettings): PokydSettingsForm {
  return {
    humanGender: settings.humanGender === MALE ? MALE : FEMALE,
    computerGender: settings.computerGender === MALE ? MALE : FEMALE,
    humanName: settings.humanName,
    computerName: settings.computerName,
    character: settings.character,
    mood: settings.mood,

    saveConversation: settings.saveConversation !== 0,
    useSounds: settings.useSounds !== 0,
    useEffects: settings.useEffects !== 0,
    formalCzech: settings.formalCzech !== 0,

    /* :95-105.  One checkbox for "emulate at all" and a radio pair under it,
       out of one field that is 0, 1 or 2. */
    emulateKeyboard: settings.emulateKeyboard > 0,
    slovakKeyboard: settings.emulateKeyboard === 2,
    keyboardQwerty: settings.keyboardQwerty !== 0,
    standardCursor: settings.standardCursor !== 0,
    noBackground: settings.cmdNoBackground !== 0,
    readOnly: settings.cmdReadOnly !== 0,
    showLabels: settings.showLabels !== 0,
  };
}

/** What a name that is two words gets instead of being saved. */
export interface PokydNameRefusal {
  /** IDC_JMENOCLOVEKA or IDC_JMENOPOCITACE -- his `pEdit->SetFocus()`. */
  control: string;
  title: string;
  message: string;
}

/** Everything CNastaveni::OnOK does, as a value rather than as an assignment. */
export interface PokydSettingsEdit {
  /** The whole struct, ready for pokyd_set_settings.  `mood` and `moodPoints`
   *  in it are the ones that came in: see `mood` below. */
  settings: PokydSettings;
  /** The mood to put through pokyd_set_mood, or null if the list box still says
   *  what g_nastaveni.nalada said.  Two calls rather than one because
   *  pokyd_set_settings copies naladabody verbatim and pokyd_set_mood is the
   *  only thing that recomputes it -- Nastaveni.cpp:165-168. */
  mood: number | null;
  /** `prekreslipozadi`, :188-197: the background is redrawn only when the
   *  checkbox actually changed, which is the author being careful and is worth
   *  keeping -- reloading a 900x459 bitmap is not free. */
  redrawBackground: boolean;
  /** Set when a name is two words: nothing above has been applied and the
   *  dialog stays open on that edit.  :147-150 and :156-159. */
  refused: PokydNameRefusal | null;
}

/** CNastaveni::OnOK, Nastaveni.cpp:135-212, field by field and in his order,
 *  against the settings as they stand now -- which is his g_nastaveni, since
 *  that is what he read and wrote. */
export function edit(
  base: PokydSettings, form: PokydSettingsForm,
): PokydSettingsEdit {
  const settings: PokydSettings = { ...base };

  settings.humanGender = form.humanGender === FEMALE ? FEMALE : MALE;
  settings.computerGender = form.computerGender === FEMALE ? FEMALE : MALE;

  const refusal = (control: string, message: string): PokydSettingsEdit => ({
    settings: base, mood: null, redrawBackground: false,
    refused: { control, title: NAME_ERROR_TITLE, message },
  });

  const human = checkName(form.humanName);
  if (!human.ok) return refusal("IDC_JMENOCLOVEKA", HUMAN_NAME_ERROR);
  settings.humanName = truncateName(human.name);

  const computer = checkName(form.computerName);
  if (!computer.ok) return refusal("IDC_JMENOPOCITACE", COMPUTER_NAME_ERROR);
  settings.computerName = truncateName(computer.name);

  settings.character = form.character;

  /* :165-168.  `docasnanalada` is the list box's index plus one, and the two
     lines under it run only if it is not the mood the engine is already in. */
  const mood = form.mood !== base.mood ? form.mood : null;

  settings.saveConversation = form.saveConversation ? 1 : 0;
  settings.useSounds = form.useSounds ? 1 : 0;
  settings.useEffects = form.useEffects ? 1 : 0;
  settings.formalCzech = form.formalCzech ? 1 : 0;

  settings.emulateKeyboard = form.emulateKeyboard
    ? (form.slovakKeyboard ? 2 : 1) : 0;
  settings.keyboardQwerty = form.keyboardQwerty ? 1 : 0;
  settings.standardCursor = form.standardCursor ? 1 : 0;

  const noBackground = form.noBackground ? 1 : 0;
  const redrawBackground = noBackground !== base.cmdNoBackground;
  settings.cmdNoBackground = noBackground;

  settings.cmdReadOnly = form.readOnly ? 1 : 0;
  settings.showLabels = form.showLabels ? 1 : 0;

  return { settings, mood, redrawBackground, refused: null };
}

/* ---------------------------------------------------------- the two pages */

/** IDC_ZAKLADNINASTAVENI, Nastaveni.cpp:337-379: every control it shows, in
 *  the order it shows them.  Everything not named here is hidden while the
 *  basic page is up, and the other list is the mirror image. */
export const BASIC_CONTROLS: readonly string[] = [
  "IDC_CLOVEKPOHLAVI", "IDC_POCITACPOHLAVI",
  "IDC_CLOVEKZENA", "IDC_POCITACZENA",
  "IDC_CLOVEKMUZ", "IDC_POCITACMUZ",
  "IDC_JMENOCLOVEKASTATIC", "IDC_JMENOPOCITACESTATIC",
  "IDC_JMENOCLOVEKA", "IDC_JMENOPOCITACE",
  "IDC_CHARAKTERSTATIC", "IDC_NALADASTATIC",
  "IDC_CHARAKTER", "IDC_NALADA",
  "IDC_UKLADATROZHOVOR", "IDC_POUZIVATZVUKY",
  "IDC_POUZIVATEFEKTY", "IDC_SPISOVNACESTINA",
];

/** IDC_ROZSIRENENASTAVENI, Nastaveni.cpp:381-424, the same way. */
export const ADVANCED_CONTROLS: readonly string[] = [
  "IDC_EMULOVATKLAVESNICI",
  "IDC_EMULOVATCESKOUKLAVESNICI", "IDC_EMULOVATSLOVENSKOUKLAVESNICI",
  "IDC_KLAVESNICEQWERTY", "IDC_TEXTKEMULACI",
  "IDC_ZOBRAZOVATSTANDARDNIKURZOR", "IDC_NEZOBRAZOVATPOZADI",
  "IDC_READONLYMOD", "IDC_ZOBRAZOVATPOPISKY",
];

/** The two group boxes are on both pages and are relabelled by SetWindowText
 *  when the page changes (:348, :364, :393, :409).  The basic page puts back
 *  what IQPokyd.rc already says, so only the advanced page's two words are
 *  written here -- the other two are read from src/app/resources.ts, and
 *  test/app/settings.test.ts checks that his two SetWindowText calls really do
 *  say what the template says. */
export const ADVANCED_GROUP_CAPTIONS: Record<string, string> = {
  IDC_RAMECEK1: "Emulace prostředí",   /* Emulace prostredi */
  IDC_RAMECEK2: "Jiná nastavení",      /* Jina nastaveni */
};

/* -------------------------------------------------------- the two refusals */

/** MessageBox(...,"Chyba",MB_ICONWARNING), Nastaveni.cpp:148 and :157.  A
 *  BEZ_PROSTREDI build has no MessageBox and a browser has no modal that is not
 *  a lie, so src/app/dialog.ts writes these into the dialog itself -- the words
 *  are his either way. */
export const NAME_ERROR_TITLE = "Chyba";

export const HUMAN_NAME_ERROR =
  "Tvé jméno musí být jednoslovné! Sice si vážím toho, že se mi představuješ"
  + " i s příjmením, ale přece jenom je lepší na někoho volat jen křestním"
  + " jménem.";

export const COMPUTER_NAME_ERROR =
  "Mé jméno musí být jednoslovné! Nepotřebuji nějaké dlouhé jméno; stačí mi"
  + " jen to křestní.";
