/* IQ Pokyd - src/app/debug.ts - CDebugNastaveni with the window taken off.

   Phase 8.4 of PLAN.md, and the same split src/app/settings.ts and
   src/app/dialog.ts already make: the file with the DOM in it is the file a
   node test cannot have, so everything that is a *decision* is here and
   src/app/cheat.ts is the window over it.  Between them they are
   !Prostre/debugnastaveni.cpp.

   What the dialog is.  Ctrl+Shift+Alt+D -- ID_CHEAT_DEBUGINFO, the one entry in
   IDR_ZKRATKY with all three modifiers on it -- opened IDD_DEBUGNASTAVENI, and
   so did typing "::debuginfo" into the sentence line (mfcDlg.cpp:562).  On the
   left it printed ten of the engine's globals; on the right it let you change
   four numbers that the ordinary settings dialog did not admit existed.  It is
   the only thing in the program the author hid, and it is the reason phase 8.4
   is in the plan at all.

   Four things about it worth knowing before changing anything here:

     1. **the report is a snapshot and says so.**  src/api/pokyd_api.h fills a
        pokyd_debug in one call for that reason, and his own tooltip on
        IDC_HODNOTY is where the claim comes from: "platne v okamziku spusteni
        tohoto dialogu".
     2. **naladabody is the only number here that is not a setting.**  0..90,
        the state that actually drifts, and writing it recomputes nalada -- the
        opposite direction from the settings dialog, which writes nalada and
        recomputes naladabody.  pokyd_set_mood_points is that direction.
     3. **the other three change how the engine answers.**  Spelling tolerance
        and search recursion are read inside the word matcher, so a visitor who
        moves them gets a different conversation.  That is what the author's own
        "Zmena nastaveni muze mit nechtene nasledky" is warning about, and it is
        why `edit()` below returns that warning rather than swallowing it.
     4. **the tooltips are ported, and they are the best writing in the
        archive.**  BublinkovaNapoveda (:262) hangs twelve of them on the
        controls, each a paragraph explaining what the option really does; they
        are `title` attributes in src/app/cheat.ts, shown when zobrazovatpopisky
        is 1, which is his own m_oNapoveda.Activate condition.

   Written by us, not ported.  English identifiers and ASCII comments, like the
   rest of the non-engine code; the Czech in the strings is quoted from
   debugnastaveni.cpp and test/app/debug.test.ts reads every one of them back
   out of it.
*/

import { MOODS } from "./caption.ts";
import type { PokydDebugInfo, PokydSettings } from "../web/protocol.ts";

/* -------------------------------------------------------------- the report */

/** :85-91, the `default` arm of his mood switch.  It cannot happen -- nalada is
 *  1..5 wherever it comes from -- but it is his line and it is what a 0 would
 *  print, so it is kept rather than thrown. */
export const MOOD_UNKNOWN = "CHYBNÉ ČÍSLO!";

/** The note :56-57 appends when the tooltips are off, which is the only part of
 *  the report that is conditional. */
export const TIPS_NOTE =
  "\r\n\r\nPozn.: Pokud chceš nápovědu k jednotlivým položkám vpravo, povol"
  + " v \"normálním\" nastavení zobrazování popisků funkcí.";

/** CDebugNastaveni::OnInitDialog's `hlaska`, :93-127: one sprintf, three
 *  strcats and a conditional one, in his order and with his rules and his
 *  spacing.  The %lu's are DWORDs and the one %d is naladabody.
 *
 *  Two of his labels read oddly and are his all the same: "Minimalni pocet
 *  slov" is debug_maxpocetvsechslov, the high-water mark, and "Aktualni nalada
 *  pocitace" prints naladabody with the *nalada* word beside it. */
export function report(info: PokydDebugInfo, settings: PokydSettings): string {
  const word = info.mood >= 1 && info.mood <= MOODS.length
    ? MOODS[info.mood - 1]! : MOOD_UNKNOWN;

  let out =
    "-------------------------------  PAMĚŤ  ------------------------------\r\n"
    + "   Počet alokovaných bloků: " + info.allocatedBlocks + "\r\n"
    + "   Minimální počet slov: " + info.maxWords + "\r\n"
    + "--------------------------  UŽIVATELSKÉ  ------------------------\r\n"
    + "   Aktuální nálada počítače: " + info.moodPoints + " (" + word + ")\r\n"
    + "   Poslední odpověď počítače:\r\n " + info.lastAnswer + "\r\n"
    + "   Počet alternativ odpovědí: " + info.answerCount + "\r\n"
    + "   Poslední věta člověka: " + info.lastSentence + "\r\n";

  out += "     Podmět: " + info.subject + "\r\n";
  out += "     Přísudek: " + info.predicate + "\r\n";
  out += "     Předmět: " + info.object + "\r\n";

  out += "----------------------------  SLOVNÍKY  ----------------------------\r\n"
    + "   Slov v \"základní\" databázi: " + info.baseWords + "\r\n"
    + "   Podmínek databáze odpovědí: " + info.rules;

  if (settings.showLabels === 0) out += TIPS_NOTE;
  return out;
}

/* ------------------------------------------------------- the two vocabularies */

/** IDC_ZADNATOLERANCEPRAVOPISU / IDC_UPLNATOLERANCEPRAVOPISU, :73-77 reading
 *  and :35-36 writing: the control that stands for each value of
 *  debug_tolerancepravopisu. */
export const TOLERANCES: readonly [number, string][] = [
  [0, "IDC_ZADNATOLERANCEPRAVOPISU"],
  [1, "IDC_UPLNATOLERANCEPRAVOPISU"],
];

/** debug_pravopisnarekurze, :78-85 and :38-42.  Five values, and they are not
 *  0..4: they are the recursion depths themselves, which is also how
 *  src/app/config.ts has to write them (RECURSION there maps the same five onto
 *  five digits, because his settings file stores a digit). */
export const RECURSIONS: readonly [number, string][] = [
  [0, "IDC_ZADNAREKURZEPROHLEDAVANI"],
  [7, "IDC_MALAREKURZEPROHLEDAVANI"],
  [11, "IDC_STREDNIREKURZEPROHLEDAVANI"],
  [15, "IDC_VELKAREKURZEPROHLEDAVANI"],
  [100, "IDC_MAXIMALNIREKURZEPROHLEDAVANI"],
];

/* ------------------------------------------------------------------ the form */

/** What the four editable controls say, which is what OnOK reads.  The mood is
 *  the text of an edit and not a number, because his first refusal is about
 *  what a visitor typed into it. */
export interface PokydDebugForm {
  /** IDC_NALADABODY, as typed. */
  moodPoints: string;
  /** IDC_RYCHLEUKONCOVANI. */
  fastExit: boolean;
  /** debug_tolerancepravopisu: 0 or 1, off the radio pair. */
  tolerance: number;
  /** debug_pravopisnarekurze: one of RECURSIONS' five. */
  recursion: number;
}

/** OnInitDialog's half of it, :62-85. */
export function formFromSettings(settings: PokydSettings): PokydDebugForm {
  return {
    moodPoints: String(settings.moodPoints),
    fastExit: settings.debugFastExit !== 0,
    tolerance: settings.debugSpellingTolerance,
    recursion: settings.debugSpellingRecursion,
  };
}

/* -------------------------------------------------------------- the refusals */

/** MessageBox(...,"Chyba",MB_ICONWARNING), :197 and :207.  Same treatment as
 *  the two in src/app/settings.ts: a BEZ_PROSTREDI build has no MessageBox and
 *  a browser has no modal that is not a lie, so src/app/cheat.ts writes these
 *  into the dialog itself.  The words are his either way. */
export const ERROR_TITLE = "Chyba";

/** :197.  His loop rejects the first character that is not a digit, so an empty
 *  edit is a valid 0 -- which it is for him too. */
export const MOOD_NOT_A_NUMBER = "Přesná nálada musí být celé kladné číslo!";

/** :207, and the two ways to reach it are his: the digit loop bails out at 25
 *  before it can overflow a BYTE, and the finished number is checked again. */
export const MOOD_OUT_OF_RANGE = "Přesná nálada musí být číslo v rozmezí 0 - 90!";

/** MessageBox(...,"Upozorneni",MB_OKCANCEL), :218.  Not a refusal: a question,
 *  and the only place in the program where OK is not the end of it.  It
 *  inflects, off pohlavicloveka, like everything else he wrote that addresses
 *  the visitor directly. */
export const WARNING_TITLE = "Upozornění";

export function warningText(settings: PokydSettings): string {
  return "Změna nastavení může mít nechtěné následky.\nJsi si jist"
    + (settings.humanGender === 2 ? "á" : "ý")
    + ", že chceš nové parametry uložit?";
}

/* ------------------------------------------------------------------ the OnOK */

export interface PokydDebugRefusal {
  /** Where the focus goes -- his `pEdit->SetFocus()`. */
  control: string;
  title: string;
  message: string;
}

export interface PokydDebugEdit {
  /** The settings as OnOK would leave them, or null if it refused. */
  settings: PokydSettings | null;
  /** naladabody, if it changed: the one value that goes through
   *  pokyd_set_mood_points rather than through the struct, because nalada has
   *  to be recomputed from it (:221-222). */
  moodPoints: number | null;
  /** True if one of the three that change how the engine answers moved, which
   *  is what his MB_OKCANCEL guards (:214-218).  A caller has to ask before it
   *  applies anything. */
  warns: boolean;
  /** :227 -- ZAPIS_NASTAVENI_DO_SOUBORU, and only when something changed. */
  save: boolean;
  refused: PokydDebugRefusal | null;
}

/** CDebugNastaveni::OnOK, :186-230, in his order and with both of his refusals.
 *
 *  What it does not do is ask the question: `warns` says one is owed and the
 *  window asks it, because a confirmation is a window's business.  The
 *  settings it hands back already have the three in them, so a caller that
 *  asks and is told no simply drops the result -- which is exactly what his
 *  `return` at :218 does. */
export function edit(current: PokydSettings,
                     form: PokydDebugForm): PokydDebugEdit {
  const refusal = (message: string): PokydDebugEdit => ({
    settings: null, moodPoints: null, warns: false, save: false,
    refused: { control: "IDC_NALADABODY", title: ERROR_TITLE, message },
  });

  /* :196.  GetWindowText(edit, 10) copies at most nine characters and a NUL, so
     nine is the cut -- and it is a real one, because the edit has no
     EM_LIMITTEXT and a visitor could always type past it.

     Then his loop, :198-205, and it is one loop rather than a parse followed by
     a check: a digit test, an overflow test and an accumulate, in that order,
     per character.  The order is visible from outside -- "999x" reaches the
     overflow on the third 9 and is refused for being out of range, not for the
     x -- so it is kept as he wrote it.  The bound is 25 because of the comment
     beside it: 25*10 + 9 is 259, which would wrap the BYTE he accumulated
     into. */
  const typed = form.moodPoints.slice(0, 9);
  let points = 0;
  for (const ch of typed) {
    if (ch < "0" || ch > "9") return refusal(MOOD_NOT_A_NUMBER);
    if (points > 25) return refusal(MOOD_OUT_OF_RANGE);
    points = points * 10 + (ch.charCodeAt(0) - 48);
  }
  if (points > 90) return refusal(MOOD_OUT_OF_RANGE);

  const fastExit = form.fastExit ? 1 : 0;
  const changed = current.debugFastExit !== fastExit
    || current.debugSpellingTolerance !== form.tolerance
    || current.debugSpellingRecursion !== form.recursion;

  const settings: PokydSettings = { ...current };
  if (changed) {
    settings.debugFastExit = fastExit;
    settings.debugSpellingTolerance = form.tolerance;
    settings.debugSpellingRecursion = form.recursion;
  }

  const movedMood = current.moodPoints !== points;
  return {
    settings,
    moodPoints: movedMood ? points : null,
    warns: changed,
    save: changed || movedMood,
    refused: null,
  };
}

/* ------------------------------------------------------------- the tooltips */

/** BublinkovaNapoveda, :262-276: twelve controls, twelve paragraphs, keyed by
 *  the control they hang on.  The one that inflects does so through
 *  `tooltips()` below; the other eleven are constant.
 *
 *  They are only shown when zobrazovatpopisky is 1, which is his own
 *  m_oNapoveda.Activate(TRUE/FALSE) at :156-157 -- and when it is 0 the report
 *  grows TIPS_NOTE instead, which is the other half of the same setting. */
const TIPS: Record<string, string> = {
  IDC_HODNOTY:
    "Zde jsou napsané různé stavové proměnné programu (platné v okamžiku"
    + " spuštění tohoto dialogu).",
  IDC_NALADABODY:
    "Číslo, které udává, jakou mám teď momentálně náladu. Toto číslo může být"
    + " v rozmezí 0 - 90. Jednotlivé \"viditelné\" nálady jsou potom tyto:\n"
    + "0 - 29 - výborná\n30 - 44 - dobrá\n45 - 59 - normální\n"
    + "60 - 74 - špatná\n75 - 90 - hrozná\n"
    + "Toto číslo se neukládá, ukládá se pouze \"viditelná\" nálada a toto číslo"
    + " se potom při spuštění přibližně vypočítá z ní.\n"
    + "Pokud toto číslo teď změníš, může se tím samozřejmě změnit i ona"
    + " \"viditelná\" nálada.",
  IDC_RYCHLEUKONCOVANI:
    "Udává, má-li se program ukončovat bez uvolňování paměti. Tu by měl uvolnit"
    + " i samotný operační systém, ale na některých starších systémech tím"
    + " dochází k úniku paměti. Pokud podstoupíš riziko, že se může paměť"
    + " \"zahlcovat\", rychlé ukončování si můžeš dovolit.\r\n<STANDARDNĚ:  NE>",
  IDC_UPLNATOLERANCEPRAVOPISU:
    "<STANDARDNĚ>\nÚplná tolerance pravopisu znamená, že dává pravopisně"
    + " špatným slovům (téměř) stejnou váhu jako správným. Např.: \"cizinec\""
    + " má stejnou váhu jako \"cyzinec\", nezávisle na tom, že u druhého slova"
    + " se musí změnit 1 hláska, aby slovo mělo smysl.\n"
    + "Větší \"citlivost\" v detekci pravopisu bude zahrnuta v příštích verzích.",
  IDC_ZADNAREKURZEPROHLEDAVANI:
    "Pokud nastavíš žádnou rekurzi, nebudou se jednak prohledávat případné"
    + " pravopisné chyby, ale také se nebudou prohledávat slova, která"
    + " s pravopisem nesouvisí!\nNapříklad \"staťiv\" a \"statyv\"."
    + " Nedoporučuje se.",
  IDC_MALAREKURZEPROHLEDAVANI:
    "Zde se prohledává jen do 7 rekurzí na 1 slovo. Velice rychlé a většinou to"
    + " stačí. (Pozor, pokud \"nevyzbude\" rekurze, nevyzbude na konci slova!)",
  IDC_STREDNIREKURZEPROHLEDAVANI:
    "<STANDARDNĚ>\nZde se prohledává do 11 rekurzí na 1 slovo. Rychlé a opravdu"
    + " dostačující.",
  IDC_VELKAREKURZEPROHLEDAVANI:
    "Zde se prohledává až do 15 rekurzí na 1 slovo. Může být pomalé.",
  IDC_MAXIMALNIREKURZEPROHLEDAVANI:
    "Zde není žádný limit. Slovo se prohledá vždy celé. Program však může"
    + " v krajních případech \"zamrznout\" (zkus si napsat slovo"
    + " \"yyyyyyyyyyyyyyyyyyyy\").",
  IDOK:
    "Zavřít toto okno a uložit (i do souboru) případné změny v nastavení.",
  IDCANCEL: "Zavřít toto okno bez ukládání nastavení.",
};

/** The one that inflects, :266: "jsi-li si vsak jist" + a or y with the accent.
 *  Split out because it is the only string in the twelve that is not constant,
 *  and kept out of TIPS so that nothing can use it unfinished. */
export function toleranceOffTip(settings: PokydSettings): string {
  return "Nastavovat žádnou toleranci pravopisu se nedoporučuje, jsi-li si však"
    + " jist" + (settings.humanGender === 2 ? "á" : "ý")
    + ", že pravopis zvládáš, zpřesní to detekci věty a v konečném důsledku"
    + " i zkvalitní rozhovor.";
}

/** All twelve, inflected. */
export function tooltips(settings: PokydSettings): Record<string, string> {
  return {
    ...TIPS,
    IDC_ZADNATOLERANCEPRAVOPISU: toleranceOffTip(settings),
  };
}

/* ------------------------------------------------------------- the two doors */

/** mfcDlg.cpp:562.  Typing this instead of a sentence opened the dialog and the
 *  engine never saw the line -- OnNovaVeta returns before any of the
 *  pre-processing.  His comparison is on the whole string, so it is exact and
 *  case-sensitive, and so is this. */
export const CHEAT_SENTENCE = "::debuginfo";
