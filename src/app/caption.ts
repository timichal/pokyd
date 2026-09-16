/* IQ Pokyd - src/app/caption.ts - the two things about IDR_MENU that are not in
   IQPokyd.rc.  Phase 6.3 of PLAN.md.

   src/app/resources.ts has the menu the author wrote, down to his mnemonics and
   his accelerator text, because it is in the resource script and the extractor
   read it.  Two things about that menu are not, and both are here:

     1. **what the right-justified item says.**  The script gives it the
        placeholder "Nalada", and ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI
        (PROSTRED.FU:249-296) then calls ModifyMenu on it after every sentence
        with something like "muz x muz, prumerny: normalni" -- who is talking to
        whom, in what character, in what mood.  The fourteen words that go into
        it are `strcat`ed out of two switches and there is no resource to read
        them from, so they are written out below, and test/app/caption.test.ts
        finds every one of them in PROSTRED.FU as a run of CP1250 bytes.

     2. **which bitmap hangs on which command.**  mfcDlg.cpp:388-401 pairs seven
        14x14 bitmaps with seven command ids through SetMenuItemBitmaps, and that
        pairing exists nowhere else; the test reads those seven calls back out of
        mfcDlg.cpp and compares them with the table.

   Nothing here touches the DOM and nothing here imports a picture, which is what
   lets a node test have it: src/app/menu.ts draws it, src/app/assets.ts is where
   the seven URLs come from, and both need a bundler.

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code, so every Czech letter below is a \uXXXX escape with
   the author's own spelling beside it.
*/

import type { PokydSettings } from "../web/protocol.ts";

/* PROSTRED.FU:254-257 and :264-267.  A person with no name is their gender.
 *
 * Found here, and worth writing down: **pohlavi 1 is male, not female.**  The
 * comment on pokyd_settings.human_gender said the opposite from phase 3.1 until
 * this function needed the answer, and three places in the engine agree it was
 * backwards -- PROSTRED.FU:255 and :263 (`== 1` prints "muz"), :302 (`== 1`
 * gives the masculine "prisel"), and SLOVNIK.FU:2091, which writes it into the
 * debug dump as `== 1 ? "muz" : "zena"`.  NASTAV_STANDARDNE's own default is 1,
 * with "muzi" in the margin.  The comments in src/api/pokyd_api.h and
 * src/web/protocol.ts are corrected to match; no code ever read them.
 *
 * Phase 7.1 finished the correction: the other value is **2**, not 0.  His own
 * settings dialog writes 1 or 2 (Nastaveni.cpp:140-143), his settings file
 * parses them as MUZ__ and ZENA__ + 1 (SLOVNIK.FU:1970), and VSTUP.FU:1070
 * assigns the number straight into Typ_slova::rod, where 1 and 2 are the two
 * genders the paradigms are indexed by.  Nothing below changes -- the array is
 * indexed by "is it a 1", which is what the author's own `if` asks -- but
 * src/app/settings.ts is what writes one, and it has to write a 2. */
export const GENDERS = [
  "žena",  /* zena  -- pohlavi 2, and anything that is not a 1 */
  "muž",   /* muz   -- pohlavi 1 */
] as const;

/** PROSTRED.FU:272-280, charakter 0..6, in the author's own order. */
export const CHARACTERS = [
  "stroj",                                 /* 0 */
  "naivní",                           /* naivni     1 */
  "klidný",                           /* klidny     2 */
  "průměrný",               /* prumerny   3 */
  "nedůvěřivý",        /* neduverivy 4 */
  "náladový",                    /* naladovy   5 */
  "výbušný",                /* vybusny    6 */
] as const;

/** PROSTRED.FU:284-290, nalada 1..5: 1 is the best of them. */
export const MOODS = [
  "výborná",   /* vyborna   1 */
  "dobrá",          /* dobra     2 */
  "normální",  /* normalni  3 */
  "špatná",    /* spatna    4 */
  "hrozná",         /* hrozna    5 */
] as const;

/** ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI, PROSTRED.FU:249.  The whole of the
 *  window's status line.  It moves on its own -- nalada is recomputed from
 *  naladabody after every sentence (INTELIG.FU:532) -- which is why the page
 *  reads the settings back and sets this again after each answer rather than
 *  only once at the start.
 *
 *  The author's own bounds check is a fatal NAHLAS_CHYBU on either switch's
 *  `default`; this throws instead, and src/app/chat.ts keeps the caption it
 *  had. */
export function settingsCaption(settings: PokydSettings): string {
  const { character, mood } = settings;
  if (!Number.isInteger(character) || character < 0 || character >= CHARACTERS.length) {
    throw new RangeError("charakter is " + character + ", not 0..6");
  }
  if (!Number.isInteger(mood) || mood < 1 || mood > MOODS.length) {
    throw new RangeError("nalada is " + mood + ", not 1..5");
  }

  const human = settings.humanName.length > 0
    ? settings.humanName : GENDERS[settings.humanGender === 1 ? 1 : 0];
  const computer = settings.computerName.length > 0
    ? settings.computerName : GENDERS[settings.computerGender === 1 ? 1 : 0];

  return human + " x " + computer + ", "
    + CHARACTERS[character] + ": " + MOODS[mood - 1];
}

/** mfcDlg.cpp:388-401, command for command: the seven 14x14 bitmaps the author
 *  hangs on his menu with SetMenuItemBitmaps, keyed by the command they belong
 *  to and naming the bitmap symbol src/app/assets.ts has the URL for.
 *
 *  ID_NASTAVENI appears twice in IDR_MENU -- once in the popup and once as the
 *  right-justified caption -- and SetMenuItemBitmaps works MF_BYCOMMAND, so in
 *  2005 it landed on both.  A top-level item has no gutter to draw it in, so
 *  only the popup shows it here, which is what happened there too. */
export const MENU_BITMAPS: Record<string, string> = {
  ID_NASTAVENI: "IDB_MENUNASTAVENI",
  ID_KONEC: "IDB_MENUKONEC",
  ID_MALANAPOVEDA: "IDB_MENUMALANAPOVEDA",
  ID_VELKANAPOVEDA: "IDB_MENUVELKANAPOVEDA",
  ID_NAPOVEDA_INTERNET: "IDB_MENUINTERNET",
  ID_OVERZI: "IDB_MENUOVERZI",
  ID_OPROGRAMU: "IDB_MENUOPROGRAMU",
};
