/* IQ Pokyd - test/app/exhibit.test.ts - phase 9.0 of PLAN.md.

   src/app/exhibit.ts is the only file in this port that writes Czech of its
   own, and the only one that edits one of the author's dialog templates.  Both
   halves need holding down, and for different reasons:

     - **the preface must not become a rewrite.**  `webVersionText` puts the
       2026 note above CMfcDlg::OnOverzi's text; what it must not do is touch
       it.  So the tail of the result is compared with `versionText` character
       for character, for a man and for a woman -- and test/app/help.test.ts is
       already comparing *that* with mfcDlg.cpp, so the chain reaches the
       archive.  Its tags go through `markup()` too, because an unknown tag in
       our own sentence is the author's own fatal error and would take the
       screen down at run time.
     - **the template edit must be arithmetic, not guesswork.**  Every control
       of his that the exhibit keeps is checked against the one it came from --
       same caption, same class, same width, moved by one of exactly three
       offsets -- and the three it drops are checked to have been there in the
       first place.  Then the whole thing is checked for the property a dialog
       has to have: the boxes do not overlap, each holds its own line, and
       nothing sticks out of the bottom.

   Run it:   node test/app/exhibit.test.ts

   Needs nothing but node: no browser, no engine, no build.  Written by us, not
   ported.  English identifiers, and what Czech there is is read back out of
   src/app/exhibit.ts and src/app/resources.ts rather than written out again --
   the two words it does spell are spot checks on the words coming through at
   all, not second copies of them.
*/

import { DIALOGS } from "../../src/app/resources.ts";
import type { RcControl, RcDialog, RcRect } from "../../src/app/resources.ts";
import { markup, plain, versionText } from "../../src/app/help.ts";
import {
  DROPPED_TEXT, NOTICE_AFTER, NOTICE_BEFORE, NOTICE_CAPTION, NOTICE_GROUP_ID,
  NOTICE_LINK, NOTICE_TEXT_ID, NOTICE_URL, WEB_PREFACE, exhibitAbout,
  webVersionText,
} from "../../src/app/exhibit.ts";
import type { PokydSettings } from "../../src/web/protocol.ts";

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

function eq<T>(label: string, got: T, expected: T): void {
  ok(label, got === expected,
    "got      " + String(got) + "\n          expected " + String(expected));
}

function heading(what: string): void {
  console.log("\n" + what + "\n" + "-".repeat(what.length));
}

/* The one setting any of this reads is pohlavicloveka, and 2 is the woman --
   the note on GENDERS in src/app/caption.ts is where that was established. */
const MAN = { humanGender: 1 } as PokydSettings;
const WOMAN = { humanGender: 2 } as PokydSettings;

/* --------------------------------------------------------- 1. the preface */

heading("Informace o verzi -- the 2026 preface above his own text");
{
  for (const [who, settings] of [["a man", MAN], ["a woman", WOMAN]] as const) {
    const whole = webVersionText(settings);
    const his = versionText(settings);
    ok("for " + who + ": his text is in it, to the character",
      whole.endsWith(his));
    eq("for " + who + ": and nothing of ours is mixed into it",
      whole.slice(0, whole.length - his.length), WEB_PREFACE);
  }

  /* His own text opens with a heading in the same two tags, which is what makes
     the two read as two notes rather than as one edited one. */
  ok("the preface opens the way his text does -- <h><u>",
    WEB_PREFACE.startsWith("<h><u>"));
  ok("and closes its heading before the paragraph",
    WEB_PREFACE.indexOf("</h>") < WEB_PREFACE.indexOf("Program"));
  ok("it ends on a blank line, so his heading is not run into ours",
    WEB_PREFACE.endsWith("\r\n\r\n"));

  /* NAPIS_FORMATOVANY_TEXT_NAPOVEDY's default is fatal, so a tag we invented
     would have taken the screen down rather than been ignored. */
  let threw = false;
  try { markup(webVersionText(MAN)); } catch { threw = true; }
  ok("every tag in it is one of his four", !threw);
  ok("and the words are there once the tags come off",
    plain(WEB_PREFACE).includes("Michal Zlatkovský")
    && plain(WEB_PREFACE).includes("ChatGPT"));
  ok("the year it is dated is in the heading",
    WEB_PREFACE.slice(0, WEB_PREFACE.indexOf("</h>")).includes("2026"));
}

/* ------------------------------------------------------ 2. what was dropped */

heading("O programu -- the two dead addresses");
{
  const his = DIALOGS["IDD_ABOUTBOX"]!;
  const shown = exhibitAbout();
  for (const text of DROPPED_TEXT) {
    ok("his template really does carry " + JSON.stringify(text),
      his.controls.some((c) => c.text === text));
    ok("and the exhibit does not draw it",
      !shown.controls.some((c) => c.text === text));
  }
  eq("three gone, two added",
    shown.controls.length, his.controls.length - 3 + 2);
  ok("nothing anywhere still gives an address at kyblsoft.cz",
    !shown.controls.some((c) => (c.text ?? "").includes("kyblsoft.cz")));
  ok("the KYBLSoft logo is still there -- attribution is not an address",
    shown.controls.some((c) => c.textResource?.symbol === "IDB_KYBLSOFT"));
  ok("and so is his copyright line",
    shown.controls.some((c) => (c.text ?? "").includes("KÝBLSoft 1999-2005")));
  ok("and his own Upozorneni, untouched",
    shown.controls.some((c) => c.kind === "GROUPBOX"
      && c.text === hisGroup(his).text));
}

/* -------------------------------------------------------- 3. what was added */

heading("the Upozorneni 2026 box");
{
  const his = DIALOGS["IDD_ABOUTBOX"]!;
  const shown = exhibitAbout();
  const group = find(shown, NOTICE_GROUP_ID);
  const text = find(shown, NOTICE_TEXT_ID);

  eq("its caption is his, dated", NOTICE_CAPTION, hisGroup(his).text + " 2026");
  eq("it is a group box like his", group.kind, hisGroup(his).kind);
  /* His rectangle, one line taller: the sentence in it is longer than his and
     wraps to three.  Same left edge and same width, so the two boxes stack. */
  eq("in his rectangle, a line taller", rect(group.rect),
    rect({ ...hisGroup(his).rect, cy: hisGroup(his).rect.cy + 11 }));
  eq("and the line in it is his line's, taller by the same",
    rect(text.rect), rect({ ...hisLine(his).rect, cy: hisLine(his).rect.cy + 11 }));
  eq("the caption is the three pieces joined", text.text,
    NOTICE_BEFORE + NOTICE_LINK + NOTICE_AFTER);
  ok("the middle piece appears once, so the anchor cannot go in the wrong place",
    NOTICE_LINK.length > 0 && text.text!.split(NOTICE_LINK).length === 2);
  ok("the sentence ends", text.text!.endsWith("."));
  eq("the link is this repository, over https",
    NOTICE_URL, "https://github.com/timichal/pokyd");
  ok("neither id is one of his",
    !his.controls.some((c) => c.id === NOTICE_GROUP_ID
      || c.id === NOTICE_TEXT_ID));
  ok("and neither claims a numeric id, because the .rc has not given them one",
    group.numericId === null && text.numericId === null);
}

/* ---------------------------------------------------------- 4. the geometry */

heading("the arithmetic -- three offsets and nothing else");
{
  const his = DIALOGS["IDD_ABOUTBOX"]!;
  const shown = exhibitAbout();

  eq("the dialog grew by the box, less the band the addresses freed",
    shown.rect.cy - his.rect.cy, 20);
  eq("and not by a unit in width", shown.rect.cx, his.rect.cx);

  /* Every control of his that survived, against the one it came from. */
  const ours = new Set([NOTICE_GROUP_ID, NOTICE_TEXT_ID]);
  const moves = new Set<number>();
  for (const now of shown.controls) {
    if (ours.has(now.id)) continue;
    const before = his.controls.find(
      (c) => c.id === now.id && c.text === now.text && c.kind === now.kind
        && c.rect.x === now.rect.x && c.rect.cx === now.rect.cx
        && c.rect.cy === now.rect.cy);
    ok("kept as it was: " + describe(now), before !== undefined);
    if (before !== undefined) moves.add(now.rect.y - before.rect.y);
  }
  eq("his controls moved by three offsets and no others",
    [...moves].sort((a, b) => a - b).join(","), "0,20,44");

  /* The property a dialog has to have, checked over the whole thing rather than
     control by control. */
  const notice = find(shown, NOTICE_GROUP_ID);
  const box = shown.controls.find((c) => c.kind === "GROUPBOX"
    && c.text === hisGroup(his).text)!;
  ok("the 2026 box is above his, and the two do not overlap",
    bottom(notice) <= box.rect.y);
  ok("each box holds its own line",
    holds(notice, find(shown, NOTICE_TEXT_ID))
    && holds(box, shown.controls.find(
      (c) => c.kind === "LTEXT" && c.id !== NOTICE_TEXT_ID)!));
  const thanks = find(shown, "IDC_PODEKOVANI");
  const button = find(shown, "IDOK");
  ok("the thanks start below his box", thanks.rect.y >= bottom(box));
  ok("the button is below the thanks", button.rect.y >= bottom(thanks));
  ok("and inside the window", bottom(button) <= shown.rect.cy);
  eq("with the margin under it he left", shown.rect.cy - bottom(button),
    his.rect.cy - bottom(find(his, "IDOK")));
}

/* ---------------------------------------------------------------- the bits */

/** His Upozorneni box: the one group box in IDD_ABOUTBOX with a caption -- the
 *  other surrounds the logo and has none. */
function hisGroup(dialog: RcDialog): RcControl {
  return dialog.controls.find(
    (c) => c.kind === "GROUPBOX" && (c.text ?? "") !== "")!;
}

/** The line inside it. */
function hisLine(dialog: RcDialog): RcControl {
  const box = hisGroup(dialog);
  return dialog.controls.find((c) => c.kind === "LTEXT" && holds(box, c))!;
}

function find(dialog: RcDialog, id: string): RcControl {
  const found = dialog.controls.find((c) => c.id === id);
  if (found === undefined) throw new Error(id + " is not in " + dialog.id);
  return found;
}

function rect(r: RcRect): string {
  return r.x + "," + r.y + " " + r.cx + "x" + r.cy;
}

function bottom(c: RcControl): number { return c.rect.y + c.rect.cy; }

function holds(box: RcControl, line: RcControl): boolean {
  return line.rect.x >= box.rect.x && line.rect.y >= box.rect.y
    && line.rect.x + line.rect.cx <= box.rect.x + box.rect.cx
    && bottom(line) <= bottom(box);
}

function describe(c: RcControl): string {
  const what = c.text === null || c.text === ""
    ? c.id
    : JSON.stringify(c.text.length > 24 ? c.text.slice(0, 24) + "..." : c.text);
  return c.kind + " " + what;
}

/* ------------------------------------------------------------------- done */

console.log("\n" + (failures === 0
  ? checks + " checks, all of them ok"
  : failures + " of " + checks + " checks FAILED"));
process.exit(failures === 0 ? 0 : 1);
