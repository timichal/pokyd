/* IQ Pokyd - src/app/help.ts - the three screens of his that are only words.

   Phase 8.2 of PLAN.md.  Three of the four commands left in IDR_MENU put text
   on the screen and nothing else, and all three of them are string literals in
   the archive rather than resources:

       Mala napoveda        ZOBRAZ_NAPOVEDU          Prostred/PROSTRED.FU:775
       Informace o verzi    CMfcDlg::OnOverzi        !Prostre/mfcDlg.cpp:815
       O programu           CAboutDlg::OnInitDialog  !Prostre/mfcDlg.cpp:667

   The first two are a CText -- IDD_TEXT with a rich edit in it -- and the third
   is IDD_ABOUTBOX, whose one long control is filled in code.  So the layouts
   come out of src/app/resources.ts as usual and the *words* come from here,
   because there is no resource to read them from.  Copied out of the author's
   own source and inflected exactly where he inflects them, which is three
   places: `pohlavi` is "a" for a woman and nothing for a man, and `dlpohlavi`
   is "a" or "y" with the accent -- both read off pohlavicloveka.

   **The markup is his too.**  NAPIS_FORMATOVANY_TEXT_NAPOVEDY (PROSTRED.FU:1116)
   reads four tags out of the text and sends EM_SETCHARFORMAT for each run
   between them: `<b>` bold, `<u>` a *double* underline, `<c>` a pale orange
   background, `<h>` 17.5pt against the body's 11.  `markup()` below is the
   parsing half of that function, run for run; src/app/screens.ts is the half
   that draws one.  His own `else NAHLAS_CHYBU(...,_UKONCIT_)` on an unknown tag
   is fatal, and this throws for the same reason: a tag he did not write means
   the text has been mistyped, not that the reader should guess.

   Nothing here touches the DOM, which is what lets test/app/help.test.ts have
   it and read every one of these strings back out of the archive.

   Written by us, not ported -- but almost everything below is quoted, and the
   quotations are in the author's own Czech.  Identifiers and comments are
   English and ASCII, like the rest of the non-engine code.
*/

import type { PokydSettings } from "../web/protocol.ts";

/* ------------------------------------------------------------ the two endings */

/** `pohlavi`, PROSTRED.FU:779-780 and mfcDlg.cpp:818-819: the past-participle
 *  ending a woman gets and a man does not.  pohlavicloveka 2 is the woman --
 *  see the note on GENDERS in src/app/caption.ts for how that was established. */
const ending = (settings: PokydSettings): string =>
  settings.humanGender === 2 ? "a" : "";

/** `dlpohlavi`, the same two lines: the long adjective ending. */
const longEnding = (settings: PokydSettings): string =>
  settings.humanGender === 2 ? "á" : "ý";

/* ----------------------------------------------------------- VYDANI_VERZE... */

/** KONSTANT.K:13, and his comment on it is "must be changed in the AboutBox
 *  too" -- which is why IDD_ABOUTBOX says "1. vydani" as a literal in the
 *  resource script and this says it as a constant. */
export const RELEASE = "1";

/* -------------------------------------------------------------- Mala napoveda */

/** ZOBRAZ_NAPOVEDU's `dlg.nadpis`, PROSTRED.FU:781. */
export const HELP_CAPTION = "IQ Pokyd - Nápověda";

/** ZOBRAZ_NAPOVEDU's `dlg.text`, PROSTRED.FU:783-815, concatenation for
 *  concatenation. */
export function helpText(settings: PokydSettings): string {
  const a = ending(settings);
  const dl = longEnding(settings);
  return "<h><u>IQ Pokyd v0.15</u></h>\r\n\r\n"
    + "<c><u>Jak to tu funguje:</u></c>\r\n"
    + "Je to jednoduché. Do řádku dole píšeš věty a já ti na ně odpovídám. "
    + "Je to prostě povídání člověka s počítačem.\r\n\r\n"
    + "Samozřejmě ode mě nemůžeš očekávat žádnou zářnou inteligenci, "
    + "nejsem nic víc než stroj. Chybí mi zejména pojem o světě, \"nežiju\", "
    + "ale i tak se snažím :-)\r\n\r\n"
    + "A nějaká pravidla, která bys měl" + a + " dodržovat:\r\n"
    + "<c>1) Piš s diakritikou</c> - diakritika jsou háčky a čárky. Toto dodržovat "
    + "prostě musíš, protože jinak ti rozumět nebudu. Jestli jsi tedy "
    + "zvykl" + dl + " z Pokydu (nebo jiného programu :-) ) psát bez "
    + "diakritiky, tak si rychle odvykni. Je to v tvém zájmu.\r\n"
    + "<c>2) Za otázkou piš otazník</c> - zní to jako samozřejmost, ale mnoho lidí "
    + "to přesto nedělá. Přitom já nemůžu podle ničeho jiného poznat, jde-li "
    + "o otázku (i stavba věty je většinou stejná). Tak překonej lenost, "
    + "zjisti si, kde na klávesnici je otazník a hlavně ho piš.\r\n"
    + "<c>3) Piš co nejjednodušší věty</c> - tj. nejlépe věty jednoduché, těm nejsnáz "
    + "porozumím. To ale neznamená, že budeš věty odflinkávat. S větami typu "
    + "\"co včera?\", \"to ne\" atd. mě moc nenadchneš.\r\n"
    + "<c>4) Piš spisovně</c> - nespisovnou češtinu nemám rád. Většinou jí porozumím, "
    + "ale alespoň se snaž. A ještě něco - prznění češtiny typu \"jaxe máš?\""
    + "neakceptuji a ani akceptovat nehodlám, ale to snad není tvůj případ.\r\n\r\n"
    + "Tento program je <u>freeware</u>. Autor z toho sice nemá ani korunu, ale zato "
    + "ty mě můžeš libovolně šířit a užívat. Podmínkou však je, že to bude "
    + "se všemi soubory, nesmíš mě modifikovat nebo šířit za poplatky. "
    + "Pokud máš zájem mě distribuovat např. na CD nebo DVD, je minimálně "
    + "slušností to oznámit autorovi, jinak můžeš zcela bez omezení.\r\n\r\n"
    + "Takže přeji příjemnou zábavu! :-)\r\n\r\n"
    + "<u>Naprogramoval Aleš Janda - KÝBLSoft 1999-2005</u>\r\n\r\n"
    + "Informace o IQ Pokydu a jeho aktualizace:\r\n"
    + "<c>http://iqpokyd.kyblsoft.cz</c>\r\n"
    + "E-mail na autora:\r\n"
    + "<c>iqpokyd@kyblsoft.cz</c>\r\n";
}

/* --------------------------------------------------------- Informace o verzi */

/** CMfcDlg::OnOverzi's `dlg.nadpis`, mfcDlg.cpp:822. */
export const VERSION_CAPTION = "IQ Pokyd v0.15 - popis verze";

/** CMfcDlg::OnOverzi's `dlg.text`, mfcDlg.cpp:823-846. */
export function versionText(settings: PokydSettings): string {
  const dl = longEnding(settings);
  return "<h><u>IQ Pokyd v0.15 - KÝBLSoft 1999-2005</u></h>\r\n\r\n"
    + "<c>Toto je " + RELEASE + ". vydání této verze.</c>\r\n\r\n"
    + "Trochu světla do objasnění této verze, předchozích a budoucích verzí:\r\n\r\n"
    + "Tento program \"IQ Pokyd\" je přímým následníkem původního programu "
    + "\"Pokyd\" (poslední verze 7.0). Ten se vyvíjel do roku 2002 a sloužil ke "
    + "stejnému účelu jako nynější IQ Pokyd, ale již neumožňoval přílišné vylepšení. "
    + "Proto byl celý program postaven úplně jinak a vzniknul z toho právě tento "
    + "\"IQ Pokyd\".\r\n"
    + "Tato verze IQ Pokydu (verze 0.15) je jednou z prvních verzí vůbec tohoto nového "
    + "projektu a zatím zdaleka nevyužívá všech možností, kterých využívat "
    + "může a které zkvalitní hovor s počítačem. Další vylepšení, kterých "
    + "je poměrně dost, budou obsaženy v příštích verzích\r\n"
    + "Zatím proto prosím buď shovívav" + dl + ".\r\n\r\n"
    + "<c>V současné verzi zejména chybí:</c>\r\n"
    + " - \"učení se\" novým věcem\r\n"
    + " - neuronová síť (systém myšlení)\r\n"
    + " - podpora zvratných zájmen se a si\r\n"
    + " - podpora velkých písmen (např. ve jménech)\r\n"
    + " - porozumění novým slovům a číslovkám\r\n\r\n"
    + "Veškeré nové verze (a případně i původní Pokyd 7.0) nalezneš "
    + "ke stažení na internetové adrese\r\n"
    + "<c>http://iqpokyd.kyblsoft.cz</c>\r\n\r\n"
    + "Aleš Janda, KÝBLSoft";
}

/* ---------------------------------------------------------------- O programu */

/** CAboutDlg::OnInitDialog's IDC_PODEKOVANI, mfcDlg.cpp:705-717.  It has no
 *  markup: the control is a plain multi-line EDITTEXT in Times New Roman, and
 *  the only formatting in it is his own line breaks.  It does not inflect
 *  either -- it is the same thanks to the same people whoever is reading it. */
export const THANKS =
  "Za pomoc při tvorbě tohoto programu děkuji:\r\n"
  + " - Davidu Kořínkovi za spoustu cenných rad a v podporování mého úsilí\r\n"
  + " - Michaele Chomátové za neocenitelnou pomoc při tvoření slovníku a za 3 krásné společné roky\r\n"
  + " - Šimonu Skálovi, Wibemu, Vlčákovi, Medvědovi, Markétě Lorenzové, Petru Bernému a spoustu dalším za pomoc s děláním programu\r\n"
  + " - autorům konkurenčních programů, zejména Martinovi Gramesovi (Kecal) a Michalu Antoničovi (Ludvik) za podporu a motivaci\r\n"
  + " - všem, kteří mi jakkoli pomohli a v tomto výčtu jsem na ně zapomněl\r\n"
  + " - veškerým fanouškům \"starého\" Pokydu za psychickou podporu, bez které by IQ Pokyd nikdy nevznikl\r\n"
  + " - všem uživatelům IQ Pokydu za jeho používání a tím i podporování freewaru\r\n\r\n"
  + "Tento program je freeware. Lze ho libovolně šířit a užívat. Musí se však rozšiřovat "
  + "se všemi soubory (podrobněji viz Velká nápověda), nesmíš mě modifikovat nebo šířit za poplatky.\r\n"
  + "Více o šíření najdeš ve Velké nápovědě.";

/* -------------------------------------------------------------- the markup */

/** One EM_SETCHARFORMAT's worth of text: a run with the four flags that were in
 *  force when it was reached. */
export interface HelpRun {
  text: string;
  /** `<b>`: CFM_WEIGHT, FW_BOLD against FW_NORMAL. */
  bold: boolean;
  /** `<u>`: CFU_UNDERLINEDOUBLE, which is a double rule and not a single one. */
  underline: boolean;
  /** `<c>`: crBackColor 0x00FFE0D0, a COLORREF and therefore #d0e0ff read
   *  backwards -- see PALETTE in src/app/resources.ts for the same trap. */
  highlight: boolean;
  /** `<h>`: yHeight 350 against 220, which is twips: 17.5pt against 11pt. */
  large: boolean;
}

/** The four tags, and the only four: PROSTRED.FU:1136 is a fatal error on
 *  anything else. */
const TAGS: Record<string, keyof Omit<HelpRun, "text">> = {
  b: "bold", u: "underline", c: "highlight", h: "large",
};

/** NAPIS_FORMATOVANY_TEXT_NAPOVEDY, :1116, as a parse.  His function does two
 *  passes -- one to strip the tags and set the whole text, one to walk the runs
 *  and format each -- because a rich edit takes its text and its formatting
 *  through different messages.  A parse needs one pass, and produces exactly
 *  the runs his second pass selected.
 *
 *  Empty runs are dropped, which is his `if (formatovanytext[pozice1+1] == '<')
 *  continue;` at :1148: two tags in a row set two flags and format once. */
export function markup(text: string): HelpRun[] {
  const state = { bold: false, underline: false, highlight: false, large: false };
  const runs: HelpRun[] = [];
  let at = 0;

  while (at < text.length) {
    if (text[at] === "<") {
      const end = text.indexOf(">", at);
      if (end === -1) {
        throw new Error("unterminated tag in the help text at " + at);
      }
      const tag = text.slice(at + 1, end);
      const closing = tag.startsWith("/");
      const name = closing ? tag.slice(1) : tag;
      const flag = TAGS[name];
      if (flag === undefined) {
        throw new Error("<" + tag + "> is not one of the author's four tags"
          + " (PROSTRED.FU:1136 makes this fatal)");
      }
      state[flag] = !closing;
      at = end + 1;
      continue;
    }
    const next = text.indexOf("<", at);
    const stop = next === -1 ? text.length : next;
    runs.push({ text: text.slice(at, stop), ...state });
    at = stop;
  }
  return runs;
}

/** The text with every tag taken out -- his `holytext`, :1122-1128.  Only a
 *  test wants it, but it wants it badly: it is what says markup() dropped the
 *  tags and nothing else. */
export const plain = (text: string): string =>
  markup(text).map((run) => run.text).join("");
