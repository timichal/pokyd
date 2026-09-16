/* IQ Pokyd - test/app/help.test.ts - phase 8.2 of PLAN.md.

   src/app/help.ts is the second file in this port that spells long Czech out by
   hand (src/app/caption.ts was the first), and for the same reason: the three
   screens phase 8.2 draws are string literals in the archive, not resources, so
   there is nothing for tools/extract-rc.mjs to have read.  This test does to
   them what test/app/caption.test.ts does to the status line, only there is a
   great deal more of it -- some nine thousand characters of the author's Czech.

   How it is done, and it is the whole point: **the C string literals are parsed
   back out of the archive and reassembled**, splice for splice.  A C compiler
   concatenates adjacent literals and MFC's CString concatenates the `+pohlavi+`
   in the middle of them; `cString()` below does both, so what it produces is
   what the author's own `dlg.text` held at run time. That is then compared with
   help.ts's output character for character, for a man and for a woman, which is
   what proves the two inflection points are in the right place as well.

   Four things it checks:

     1. **nothing was mistyped.**  helpText, versionText and THANKS against
        PROSTRED.FU:783 and mfcDlg.cpp:823 and :705, through phase 4.1's codec
        in both directions -- so a diacritic lost between CP1250 and UTF-8 fails
        here rather than on the screen.
     2. **the two captions and the release number are his**, read off
        `dlg.nadpis` and KONSTANT.K.
     3. **the markup parser is NAPIS_FORMATOVANY_TEXT_NAPOVEDY.**  Its four tags
        are read out of the function's own strncmp chain, the stripped text is
        compared with what his first pass builds, and the run boundaries are
        checked against the rule his second pass walks by.
     4. **every tag in the two texts is one of the four**, which is the thing
        his `else NAHLAS_CHYBU(...,_UKONCIT_)` would have caught in 2005.

   Run it:   node test/app/help.test.ts

   Needs nothing but node: no browser, no engine, no build.  Written by us, not
   ported; the Czech in here is all quoted from the archive by the reader below
   rather than written out again.
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { decodeCp1250, encodeCp1250 } from "../../src/web/cp1250.ts";
import {
  HELP_CAPTION, RELEASE, THANKS, VERSION_CAPTION, helpText, markup, plain,
  versionText,
} from "../../src/app/help.ts";
import type { PokydSettings } from "../../src/web/protocol.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FU = join(ROOT, "src", "engine", "prostred", "prostred.fu");
const KONSTANT = join(ROOT, "src", "engine", "konstant.k");
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
    console.log("  FAIL  " + label
      + (detail === undefined ? "" : "\n          " + detail));
  }
}

function eqText(label: string, got: string, expected: string): void {
  checks++;
  if (got === expected) { console.log("  ok    " + label); return; }
  failures++;
  /* Where they part, which for nine thousand characters is the only useful
     thing to print. */
  let at = 0;
  while (at < got.length && at < expected.length && got[at] === expected[at]) at++;
  console.log("  FAIL  " + label
    + "\n          they part at character " + at + " of "
    + expected.length + " (got " + got.length + ")"
    + "\n          got      ..." + JSON.stringify(got.slice(Math.max(0, at - 30), at + 40))
    + "\n          expected ..." + JSON.stringify(expected.slice(Math.max(0, at - 30), at + 40)));
}

function heading(text: string): void { console.log("\n" + text); }

/* ------------------------------------------------------- the literal reader */

/* A run of C string literals with MFC CString splices in it, as the compiler
   and then the run time would put it together:

       "one" "two" + variable + "three"

   Adjacent literals concatenate (that is the compiler), and an identifier is a
   hole the caller fills (that is CString::operator+).  Reading stops at the
   first character that is neither, which is the `;` or `)` the author ended the
   statement with.  The only escapes his text uses are \r, \n and \", and an
   unknown one is an error rather than a silent pass-through. */
function cString(text: string, at: number,
                 holes: Record<string, string>): { value: string; end: number } {
  let out = "";
  let i = at;
  for (;;) {
    while (i < text.length && /[\s+]/.test(text[i]!)) i++;
    if (i >= text.length) break;
    if (text[i] === "\"") {
      i++;
      while (i < text.length && text[i] !== "\"") {
        if (text[i] === "\\") {
          const code = text[i + 1];
          if (code === "r") out += "\r";
          else if (code === "n") out += "\n";
          else if (code === "\"") out += "\"";
          else if (code === "\\") out += "\\";
          else throw new Error("unhandled C escape \\" + code + " at " + i);
          i += 2;
          continue;
        }
        out += text[i];
        i++;
      }
      i++;
      continue;
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i));
    if (name === null) break;
    const hole = holes[name[0]];
    if (hole === undefined) break;     /* not a splice: the statement is over */
    out += hole;
    i += name[0].length;
  }
  return { value: out, end: i };
}

/** Everything after `marker` in `text`, read as a C string. */
function literalAfter(text: string, marker: string,
                      holes: Record<string, string> = {}): string {
  const at = text.indexOf(marker);
  if (at === -1) throw new Error("not in the archive any more: " + marker);
  return cString(text, at + marker.length, holes).value;
}

/* --------------------------------------------------------------- the sources */

console.log("IQ Pokyd - phase 8.2, the three text screens read back\n");

/* src/engine/ is UTF-8; the bytes that matter are the CP1250 ones the compiler
   saw, so both files go through the codec in both directions before anything is
   compared -- the same lossless round trip phase 4.1 established.  mfcDlg.cpp
   is CP1250 on disk, being under original/, so it is decoded rather than
   re-encoded. */
const fu = decodeCp1250(encodeCp1250(readFileSync(FU, "utf8")));
const mfc = decodeCp1250(new Uint8Array(readFileSync(MFC)));
const konstant = readFileSync(KONSTANT, "utf8");

const settings = (humanGender: number): PokydSettings =>
  ({ humanGender } as unknown as PokydSettings);

const MAN = settings(1);
const WOMAN = settings(2);

/* ------------------------------------------------------ 1. the release number */

heading("KONSTANT.K, and the two captions");
{
  const m = /#define VYDANI_VERZE_PROGRAMU "([^"]*)"/.exec(konstant);
  ok("VYDANI_VERZE_PROGRAMU is still defined", m !== null);
  if (m !== null) eqText("  and RELEASE is it", RELEASE, m[1]!);
}
{
  const help = literalAfter(fu.slice(fu.indexOf("void ZOBRAZ_NAPOVEDU")),
    "dlg.nadpis=");
  eqText("ZOBRAZ_NAPOVEDU's caption", HELP_CAPTION, help);

  const version = literalAfter(mfc.slice(mfc.indexOf("void CMfcDlg::OnOverzi")),
    "dlg.nadpis=");
  eqText("OnOverzi's caption", VERSION_CAPTION, version);
}

/* --------------------------------------------------- 2. the two inflections */

heading("pohlavi and dlpohlavi, read off the two functions that set them");
{
  /* PROSTRED.FU:779-780 and mfcDlg.cpp:818-819 are the same two lines twice. */
  const re = /if \(g_nastaveni\.pohlavicloveka == 2\) \{ pohlavi="([^"]*)"; dlpohlavi="([^"]*)"; \}\s*\r?\n\s*else \{ pohlavi="([^"]*)"; dlpohlavi="([^"]*)"; \}/;
  for (const [where, text] of [["PROSTRED.FU", fu], ["mfcDlg.cpp", mfc]] as const) {
    const m = re.exec(text);
    ok(where + " still sets both endings off pohlavicloveka == 2", m !== null);
    if (m === null) continue;
    ok("  a woman gets \"" + m[1] + "\" and \"" + m[2] + "\"",
      m[1] === "a" && m[2] === "á");
    ok("  a man gets \"" + m[3] + "\" and \"" + m[4] + "\"",
      m[3] === "" && m[4] === "ý");
  }
}

/* ---------------------------------------------------------- 3. the three texts */

heading("Mala napoveda -- ZOBRAZ_NAPOVEDU, PROSTRED.FU:783");
{
  const body = fu.slice(fu.indexOf("void ZOBRAZ_NAPOVEDU"));
  eqText("for a man", helpText(MAN),
    literalAfter(body, "dlg.text=", { pohlavi: "", dlpohlavi: "ý" }));
  eqText("for a woman", helpText(WOMAN),
    literalAfter(body, "dlg.text=", { pohlavi: "a", dlpohlavi: "á" }));
  ok("and the two differ, in the two places they should",
    helpText(MAN) !== helpText(WOMAN));
}

heading("Informace o verzi -- CMfcDlg::OnOverzi, mfcDlg.cpp:823");
{
  const body = mfc.slice(mfc.indexOf("void CMfcDlg::OnOverzi"));
  /* His text has VYDANI_VERZE_PROGRAMU spliced into it as a *macro*, which the
     preprocessor concatenates like any other adjacent literal -- so it is a
     hole here with the same value the macro has. */
  eqText("for a man", versionText(MAN), literalAfter(body, "dlg.text=",
    { pohlavi: "", dlpohlavi: "ý", VYDANI_VERZE_PROGRAMU: RELEASE }));
  eqText("for a woman", versionText(WOMAN), literalAfter(body, "dlg.text=",
    { pohlavi: "a", dlpohlavi: "á", VYDANI_VERZE_PROGRAMU: RELEASE }));
}

heading("O programu -- CAboutDlg::OnInitDialog's IDC_PODEKOVANI, mfcDlg.cpp:705");
{
  /* The second SetWindowText in the function: the first is IDC_INTERNET's and
     has no text of its own.  Anchored on the comment-free `pEdit->SetWindowText(`
     that follows the IDC_PODEKOVANI GetDlgItem. */
  const at = mfc.indexOf("m_oFont2.CreateFontIndirect(&lf);");
  ok("the IDC_PODEKOVANI font is still set where it was", at !== -1);
  eqText("the thanks", THANKS,
    literalAfter(mfc.slice(at), "pEdit->SetWindowText("));
  ok("it does not inflect", !THANKS.includes("ý."));
}

/* ------------------------------------------------------------- 4. the markup */

heading("NAPIS_FORMATOVANY_TEXT_NAPOVEDY, PROSTRED.FU:1116");
{
  const at = fu.indexOf("void NAPIS_FORMATOVANY_TEXT_NAPOVEDY");
  const body = fu.slice(at, fu.indexOf("\nvoid ", at + 1));

  /* The opening tags, in the order his strncmp chain tests them. */
  const opens: string[] = [];
  const re = /strncmp\(formatovanytext\+pozice1,"<([a-z])>",3\) == 0/g;
  for (let m = re.exec(body); m !== null; m = re.exec(body)) opens.push(m[1]!);
  eqText("his four tags, in his order", opens.join(""), "buch");

  ok("and every one of them has a closing form",
    opens.every((t) => body.includes("\"</" + t + ">\",4")));
  ok("anything else is fatal -- the author's own else",
    /else NAHLAS_CHYBU\(__FILE__,__LINE__,_NESPECIFIKOVANO_,_UKONCIT_\);/
      .test(body));

  /* The two formatting values that are not booleans, so that the stylesheet has
     something to be checked against. */
  ok("<h> is yHeight 350 against 220",
    /velike == 1\) chf\.yHeight=350; else chf\.yHeight=220;/.test(body));
  ok("<c> is crBackColor 0x00FFE0D0",
    /zvyraznene == 1\) chf\.crBackColor=0x00FFE0D0;/.test(body));
  ok("<u> is a double underline",
    /podtrzene == 1\) chf\.bUnderlineType=CFU_UNDERLINEDOUBLE;/.test(body));
}

heading("the parse itself");
{
  eqText("a plain string is one run", markup("ahoj").map((r) => r.text).join("|"),
    "ahoj");
  eqText("tags open and close", markup("a<b>b</b>c").map(
    (r) => r.text + (r.bold ? "!" : "")).join("|"), "a|b!|c");
  eqText("two tags in a row make one run, not an empty one in between",
    markup("<c><u>x</u></c>").map(
      (r) => r.text + (r.highlight && r.underline ? "!" : "")).join("|"), "x!");
  eqText("and they nest in any order",
    markup("<h><u>t</u></h>").map((r) => (r.large && r.underline ? "y" : "n")).join(""),
    "y");

  let threw = false;
  try { markup("<x>nope</x>"); } catch { threw = true; }
  ok("an unknown tag throws, as his own default is fatal", threw);

  threw = false;
  try { markup("<b unterminated"); } catch { threw = true; }
  ok("so does a tag with no '>'", threw);
}

heading("the two texts through it");
for (const [what, text] of [
  ["Mala napoveda", helpText(MAN)], ["Informace o verzi", versionText(MAN)],
] as const) {
  const runs = markup(text);
  ok(what + ": every run is non-empty", runs.every((r) => r.text.length > 0));
  eqText(what + ": the runs put back together are the text with the tags gone",
    runs.map((r) => r.text).join(""), text.replace(/<\/?[a-z]>/g, ""));
  eqText(what + ": plain() agrees", plain(text), text.replace(/<\/?[a-z]>/g, ""));
  ok(what + ": something is formatted", runs.some(
    (r) => r.bold || r.underline || r.highlight || r.large));
  ok(what + ": nothing is left open at the end",
    !(runs[runs.length - 1]!.bold || runs[runs.length - 1]!.underline
      || runs[runs.length - 1]!.highlight || runs[runs.length - 1]!.large));
}

/* ------------------------------------------------------------------- the end */

console.log(failures === 0
  ? "\nPASS -- " + checks + " checks.  All three screens are the author's own"
    + " words, reassembled out of his own C, and the markup is his four tags."
  : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
process.exit(failures === 0 ? 0 : 1);
