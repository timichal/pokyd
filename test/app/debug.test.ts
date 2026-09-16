/* IQ Pokyd - test/app/debug.test.ts - phase 8.4 of PLAN.md.

   src/app/debug.ts is CDebugNastaveni with the window taken off, and it is the
   third file in this port that spells the author's Czech out by hand.  Same
   treatment as the other two: everything in it is read back out of
   !Prostre/debugnastaveni.cpp and compared, so nothing here can be a
   paraphrase.

   What it checks:

     1. **the report is his sprintf.**  Its format strings are parsed out of
        OnInitDialog -- the one sprintf, the three strcats and the conditional
        one -- and rebuilt with the same arguments in the same order, then held
        against report().  A dash that went missing out of one of his three
        section rules fails here.
     2. **the five mood words in his own switch are the five in
        src/app/caption.ts**, which test/app/caption.test.ts has already held
        against PROSTRED.FU.  He wrote them twice; this is what says the two
        copies agree.
     3. **the two vocabularies are his**, read off the CheckDlgButton switches
        in OnInitDialog: 0/1 for the tolerance and 0/7/11/15/100 for the
        recursion, each with the control it ticks.  RECURSIONS is also compared
        with the five values src/app/config.ts writes into IQPOKYD.CFG, because
        a disagreement between those two would mean a settings file the dialog
        could not show.
     4. **OnOK is OnOK.**  Both refusals word for word, the warning with both of
        its endings, and then the arithmetic: his digit loop tests, overflows
        and accumulates in that order, which is visible from outside -- "999x"
        is out of range and not "not a number" -- so that order is checked with
        the inputs that can tell.
     5. **the twelve tool tips are the twelve he wrote.**

   Run it:   node test/app/debug.test.ts

   Needs nothing but node: no browser, no engine, no build.  Written by us, not
   ported; the Czech in here is read out of the archive by this file rather than
   written out again.
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { decodeCp1250 } from "../../src/web/cp1250.ts";
import { MOODS } from "../../src/app/caption.ts";
import {
  CHEAT_SENTENCE, ERROR_TITLE, MOOD_NOT_A_NUMBER, MOOD_OUT_OF_RANGE,
  MOOD_UNKNOWN, RECURSIONS, TIPS_NOTE, TOLERANCES, WARNING_TITLE, edit,
  formFromSettings, report, tooltips, warningText,
} from "../../src/app/debug.ts";
import type { PokydDebugInfo, PokydSettings } from "../../src/web/protocol.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DBG = join(ROOT, "original", "IQ Pokyd", "!Prostre", "debugnastaveni.cpp");
const MFC = join(ROOT, "original", "IQ Pokyd", "!Prostre", "mfcDlg.cpp");
const CONFIG = join(ROOT, "src", "app", "config.ts");

/* ------------------------------------------------------------- the harness */

let failures = 0;
let checks = 0;

function ok(label: string, cond: boolean, detail?: string): void {
  checks++;
  if (cond) { console.log("  ok    " + label); return; }
  failures++;
  console.log("  FAIL  " + label
    + (detail === undefined ? "" : "\n          " + detail));
}

function eqText(label: string, got: string, expected: string): void {
  checks++;
  if (got === expected) { console.log("  ok    " + label); return; }
  failures++;
  let at = 0;
  while (at < got.length && at < expected.length && got[at] === expected[at]) at++;
  console.log("  FAIL  " + label
    + "\n          they part at character " + at + " of " + expected.length
    + "\n          got      " + JSON.stringify(got.slice(Math.max(0, at - 30), at + 40))
    + "\n          expected " + JSON.stringify(expected.slice(Math.max(0, at - 30), at + 40)));
}

function eq(label: string, got: unknown, expected: unknown): void {
  const a = JSON.stringify(got);
  const b = JSON.stringify(expected);
  ok(label, a === b, a === b ? undefined : "got " + a + "\n          expected " + b);
}

function heading(text: string): void { console.log("\n" + text); }

/* ------------------------------------------------------- the literal reader */

/* A run of C string literals, concatenated the way the compiler concatenates
   them.  Simpler than the one in test/app/help.test.ts because nothing in this
   file splices a CString into the middle of a format string -- his inflections
   here are separate `+koncovkapohlavi+` terms, handled where they come up. */
function literals(text: string, from: number, to: number): string {
  let out = "";
  let i = from;
  while (i < to) {
    if (text[i] !== "\"") { i++; continue; }
    i++;
    while (i < to && text[i] !== "\"") {
      if (text[i] === "\\") {
        const code = text[i + 1];
        out += code === "r" ? "\r" : code === "n" ? "\n"
          : code === "\"" ? "\"" : code === "\\" ? "\\" : "";
        i += 2;
        continue;
      }
      out += text[i];
      i++;
    }
    i++;
  }
  return out;
}

/** The string literal -- or run of adjacent ones -- that follows `marker`.
 *  Bounded by the literal itself rather than by whatever punctuation comes
 *  after it: his calls end in `);`, `,docasne);` and `","Chyba",...)` by turns,
 *  and a reader that guessed would read the wrong thing rather than nothing. */
function literalAfter(text: string, marker: string): string {
  const at = text.indexOf(marker);
  if (at === -1) throw new Error("not in the archive any more: " + marker);
  let i = text.indexOf("\"", at + marker.length);
  if (i === -1) throw new Error("no string literal after " + marker);
  let out = "";
  for (;;) {
    i++;                                   /* past the opening quote */
    while (i < text.length && text[i] !== "\"") {
      if (text[i] === "\\") {
        const code = text[i + 1];
        out += code === "r" ? "\r" : code === "n" ? "\n"
          : code === "\"" ? "\"" : code === "\\" ? "\\" : "";
        i += 2;
        continue;
      }
      out += text[i];
      i++;
    }
    i++;                                   /* past the closing quote */
    /* Adjacent literals concatenate; anything else ends the run. */
    let j = i;
    while (j < text.length && /\s/.test(text[j]!)) j++;
    if (text[j] !== "\"") return out;
    i = j;
  }
}

/* ------------------------------------------------------------- the sources */

console.log("IQ Pokyd - phase 8.4, the cheat panel read back\n");

const dbg = decodeCp1250(new Uint8Array(readFileSync(DBG)));
const mfc = decodeCp1250(new Uint8Array(readFileSync(MFC)));
const config = readFileSync(CONFIG, "utf8");

/* ---------------------------------------------------------- 1. the vocabulary */

heading("the five mood words, which he wrote out a second time");
{
  const at = dbg.indexOf("switch(g_nastaveni.nalada)");
  const body = dbg.slice(at, dbg.indexOf("}", at));
  const found: string[] = [];
  const re = /case \d+: strcpy\(docasne,"([^"]*)"\); break;/g;
  for (let m = re.exec(body); m !== null; m = re.exec(body)) found.push(m[1]!);
  eq("his switch still has five cases", found.length, 5);
  eq("and they are src/app/caption.ts's five", found, [...MOODS]);

  const other = /default: strcpy\(docasne,"([^"]*)"\); break;/.exec(body);
  ok("his default arm is still there", other !== null);
  if (other !== null) eqText("  and MOOD_UNKNOWN is it", MOOD_UNKNOWN, other[1]!);
}

heading("the two radio vocabularies, off his CheckDlgButton switches");
{
  const parse = (which: string): [number, string][] => {
    const at = dbg.indexOf("switch(g_nastaveni." + which + ")");
    const body = dbg.slice(at, dbg.indexOf("default:", at));
    const out: [number, string][] = [];
    const re = /case (\d+): CheckDlgButton\((IDC_[A-Z]+),1\); break;/g;
    for (let m = re.exec(body); m !== null; m = re.exec(body)) {
      out.push([Number(m[1]), m[2]!]);
    }
    return out;
  };
  eq("debug_tolerancepravopisu is his two, with his controls",
    TOLERANCES.map(([v, id]) => [v, id]), parse("debug_tolerancepravopisu"));
  eq("debug_pravopisnarekurze is his five",
    RECURSIONS.map(([v, id]) => [v, id]), parse("debug_pravopisnarekurze"));

  /* And the other place those five numbers live: the settings file maps them
     onto five digits (SLOVNIK.FU:2138-2143), so a dialog that offered a sixth
     would write a file his own reader refuses. */
  const stored = Array.from(config.matchAll(/\[(\d+), "(\d)"\]/g))
    .map((m) => Number(m[1]));
  eq("and src/app/config.ts stores exactly those five",
    RECURSIONS.map(([v]) => v), stored);
}

/* ------------------------------------------------------------- 2. the report */

heading("the report -- OnInitDialog's sprintf, rebuilt");
{
  /* His five format strings, in the order he assembles them: the big sprintf,
     three one-line strcats and the closing one. */
  const start = dbg.indexOf("sprintf(hlaska,\"\"");
  const firstEnd = dbg.indexOf("debug_pocetalokovani", start);
  const head = literals(dbg, start, firstEnd);

  const part = (label: string): string =>
    literalAfter(dbg.slice(dbg.indexOf(label)), "sprintf(docasnahlaska,");
  const tail = literals(dbg,
    dbg.lastIndexOf("sprintf(docasnahlaska,"),
    dbg.indexOf("g_pocetslovvzakladnidatabazi,", dbg.lastIndexOf("sprintf(docasnahlaska,")));

  eq("the big sprintf still takes his seven arguments",
    (head.match(/%lu|%d|%s/g) ?? []).join(","),
    ["%lu", "%lu", "%d", "%s", "%s", "%lu", "%s"].join(","));

  const info: PokydDebugInfo = {
    allocatedBlocks: 407083, maxWords: 402252, answerCount: 3,
    baseWords: 11207, rules: 182,
    lastAnswer: "Ahoj.", lastSentence: "ahoj",
    subject: "ty", predicate: "jsi", object: "-",
    mood: 3, moodPoints: 47,
  };
  const settings = { showLabels: 1 } as unknown as PokydSettings;

  /* sprintf, by hand, with his arguments in his order (:122-127). */
  const expected =
    head
      .replace("%lu", String(info.allocatedBlocks))
      .replace("%lu", String(info.maxWords))
      .replace("%d", String(info.moodPoints))
      .replace("%s", MOODS[info.mood - 1]!)
      .replace("%s", info.lastAnswer)
      .replace("%lu", String(info.answerCount))
      .replace("%s", info.lastSentence)
    + part("debug_poslednipodmetcloveka").replace("%s", info.subject)
    + part("debug_posledniprisudekcloveka").replace("%s", info.predicate)
    + part("debug_poslednipredmetcloveka").replace("%s", info.object)
    + tail
      .replace("%lu", String(info.baseWords))
      .replace("%lu", String(info.rules));

  eqText("report() is his whole message, character for character",
    report(info, settings), expected);

  /* And the conditional tail, :56-57. */
  const note = literalAfter(
    dbg.slice(dbg.indexOf("zobrazovatpopisky == 0")), "strcat(hlaska,");
  eqText("TIPS_NOTE is his note about the tool tips", TIPS_NOTE, note);
  eqText("which is appended only when zobrazovatpopisky is 0",
    report(info, { showLabels: 0 } as unknown as PokydSettings),
    expected + note);

  /* His `default` arm, which cannot happen and is kept anyway. */
  ok("a mood outside 1..5 prints his CHYBNE CISLO",
    report({ ...info, mood: 0 }, settings).includes(MOOD_UNKNOWN));
}

/* --------------------------------------------------------------- 3. the OnOK */

heading("OnOK's two refusals and its one question");
{
  eqText("the error title", ERROR_TITLE,
    /MessageBox\("[^"]*","([^"]*)",MB_ICONWARNING \| MB_SYSTEMMODAL\)/
      .exec(dbg)![1]!);
  eqText("\"must be a whole positive number\"", MOOD_NOT_A_NUMBER,
    literalAfter(dbg, "MessageBox("));
  eqText("\"must be 0 - 90\"", MOOD_OUT_OF_RANGE,
    literalAfter(dbg.slice(dbg.indexOf("MIMOROZSAH:")), "MessageBox("));

  const warn = /MessageBox\("([^"]*)"\+koncovkapohlavi\+"([^"]*)","([^"]*)",MB_OKCANCEL/
    .exec(dbg.replace(/\\n/g, ""));
  ok("the warning is still an MB_OKCANCEL with the ending spliced into it",
    warn !== null);
  if (warn !== null) {
    eqText("  its title", WARNING_TITLE, warn[3]!);
    const put = (ending: string): string =>
      (warn[1]! + ending + warn[2]!).replace(//g, "\n");
    eqText("  for a man", warningText({ humanGender: 1 } as PokydSettings),
      put("ý"));
    eqText("  for a woman", warningText({ humanGender: 2 } as PokydSettings),
      put("á"));
  }
}

heading("OnOK's arithmetic, which is a loop and not a parse");
{
  const base = {
    moodPoints: 47, debugFastExit: 0, debugSpellingTolerance: 1,
    debugSpellingRecursion: 11,
  } as unknown as PokydSettings;
  const form = formFromSettings(base);
  eq("the form starts where the settings are",
    [form.moodPoints, form.fastExit, form.tolerance, form.recursion],
    ["47", false, 1, 11]);

  const run = (moodPoints: string, over: Partial<typeof form> = {}) =>
    edit(base, { ...form, ...over, moodPoints });

  eqText("a letter is refused as not a number",
    run("12x").refused!.message, MOOD_NOT_A_NUMBER);
  /* The order is visible from outside: by the third 9 the accumulator is past
     25, so the overflow test fires before the x is ever reached. */
  eqText("but \"999x\" is out of range, because his loop checks as it goes",
    run("999x").refused!.message, MOOD_OUT_OF_RANGE);
  eqText("91 is out of range", run("91").refused!.message, MOOD_OUT_OF_RANGE);
  eq("90 is not", run("90").refused, null);
  eq("an empty edit is a valid 0", run("").moodPoints, 0);
  eq("0 is 0 and is not \"unchanged\"", run("0").moodPoints, 0);
  eq("and the mood it was already at is not reported as a change",
    run("47").moodPoints, null);

  /* The three that warn, and the one that does not. */
  eq("moving naladabody alone asks nothing", run("40").warns, false);
  ok("but it is saved", run("40").save);
  ok("moving the tolerance asks", run("47", { tolerance: 0 }).warns);
  ok("and so does the recursion", run("47", { recursion: 100 }).warns);
  ok("and fast exit", run("47", { fastExit: true }).warns);
  eq("nothing at all changed means nothing is saved", run("47").save, false);

  const changed = run("47", { recursion: 15 });
  eq("the three reach the settings", changed.settings!.debugSpellingRecursion, 15);
  eq("and the rest of the struct is untouched",
    changed.settings!.debugSpellingTolerance, 1);

  /* GetWindowText(edit, 10) copies nine characters and a NUL (:196). */
  eq("the edit is cut at nine characters", run("000000000000").refused, null);
  eq("  and what is left of it is zero", run("000000000000").moodPoints, 0);
}

/* ------------------------------------------------------------ 4. the tooltips */

heading("BublinkovaNapoveda's twelve");
{
  const at = dbg.indexOf("void CDebugNastaveni::BublinkovaNapoveda");
  const body = dbg.slice(at);
  const found = new Map<string, string>();
  const re = /m_oNapoveda\.AddTool\(GetDlgItem\((ID[A-Z_]+)\),"((?:[^"\\]|\\.)*)"(\+koncovkapohlavi\+"((?:[^"\\]|\\.)*)")?\)/g;
  for (let m = re.exec(body); m !== null; m = re.exec(body)) {
    const unescape = (s: string): string =>
      s.replace(/\\r/g, "\r").replace(/\\n/g, "\n").replace(/\\"/g, "\"");
    found.set(m[1]!, unescape(m[2]!)
      + (m[4] === undefined ? "" : "ý" + unescape(m[4])));
  }
  eq("he hung twelve of them", found.size, 12);

  const ours = tooltips({ humanGender: 1 } as PokydSettings);
  eq("on the same twelve controls",
    Object.keys(ours).sort(), Array.from(found.keys()).sort());
  for (const [id, text] of found) {
    eqText("  " + id, ours[id] ?? "(missing)", text);
  }

  const her = tooltips({ humanGender: 2 } as PokydSettings);
  ok("and the one that inflects does",
    her["IDC_ZADNATOLERANCEPRAVOPISU"] !== ours["IDC_ZADNATOLERANCEPRAVOPISU"]);
  ok("  with the ending a woman gets",
    her["IDC_ZADNATOLERANCEPRAVOPISU"]!.includes("jistá"));
}

/* --------------------------------------------------------- 5. the two doors */

heading("the two ways in");
{
  const m = /strcmp\(g_aktualnivetacloveka\+2,"([^"]*)"\) == 0/.exec(mfc);
  ok("mfcDlg.cpp still opens it on a typed sentence", m !== null);
  if (m !== null) {
    eqText("and CHEAT_SENTENCE is his two colons and his word",
      CHEAT_SENTENCE, "::" + m[1]!);
  }
  ok("the accelerator is still Ctrl+Shift+Alt+D",
    /"D",\s+ID_CHEAT_DEBUGINFO,\s+VIRTKEY, SHIFT, CONTROL, ALT/
      .test(readFileSync(
        join(ROOT, "original", "IQ Pokyd", "!Prostre", "IQPokyd.rc"), "latin1")));
}

/* ------------------------------------------------------------------- the end */

console.log(failures === 0
  ? "\nPASS -- " + checks + " checks.  The cheat panel is his report, his two"
    + " refusals, his question and his twelve tool tips."
  : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
process.exit(failures === 0 ? 0 : 1);
