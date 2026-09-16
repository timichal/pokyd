/* IQ Pokyd - src/app/exhibit.ts - the two places the web edition speaks for
   itself.  Phase 9.0 of PLAN.md.

   Everything else this port puts on the screen is the author's: his resources,
   his string literals, his fonts, his rectangles.  Two screens, though, are the
   ones a visitor in 2026 reads to find out what they are looking at, and
   neither of them can answer that out of a 2005 archive -- so this file holds
   the sentences the port adds and the one template edit they need.

   **Informace o verzi gets a preface, not a rewrite.**  CMfcDlg::OnOverzi's
   text is checked character for character against mfcDlg.cpp by
   test/app/help.test.ts, and it should go on being: it is the author
   explaining his own version numbering, in 2005, in the present tense.  So
   `versionText` is untouched and `webVersionText` puts a second heading *above*
   it -- the same <h><u> heading his own text opens with, so the screen reads as
   two notes stacked rather than as one note edited.

   **O programu loses two dead addresses and gains a live one.**  IDD_ABOUTBOX
   carries http://iqpokyd.kyblsoft.cz and iqpokyd@kyblsoft.cz under a "Web: /
   E-mail:" label, and the same argument DROPPED_COMMANDS makes in
   src/app/caption.ts applies to them twice over: the site has not answered in
   twenty years and the mailbox behind a dead domain is not a way to reach
   anybody.  Phase 8.2 kept them because they were text and text is harmless;
   they are dropped now because the box has something to say in their place.
   What replaces them is a second group box above his own Upozorneni, in his
   own rectangle, saying what this is and where the source is.

   `exhibitAbout` is the template edit and it is the only one: it drops three
   controls, adds two, and moves the rest by two numbers that come out of his
   own geometry.  It is a pure function over the parse in src/app/resources.ts,
   which is what lets test/app/exhibit.test.ts check the arithmetic without a
   browser -- and what keeps resources.ts itself generated and unedited.

   Written by us, not ported.  English identifiers and comments; the Czech below
   is ours too, and it is the only Czech in this port that is.
*/

import { DIALOGS } from "./resources.ts";
import type { RcControl, RcDialog } from "./resources.ts";
import { versionText } from "./help.ts";
import type { PokydSettings } from "../web/protocol.ts";

/* ------------------------------------------------------- Informace o verzi */

/** The heading and the paragraph that go above CMfcDlg::OnOverzi's own text.
 *  Tagged in his markup -- <h> and <u> are what NAPIS_FORMATOVANY_TEXT_NAPOVEDY
 *  reads, and `markup()` in src/app/help.ts is what parses them here. */
export const WEB_PREFACE =
  "<h><u>IQ Pokyd v0.15 pro web - 2026</u></h>\r\n\r\n"
  + "Program v téměř původní podobě převedl "
  + "do webové verze Michal Zlatkovský. v0.15 je poslední "
  + "dostupná verze programu, autor následně vývoje "
  + "zanechal. Až o mnoho let později IQ Pokyd dostihly "
  + "konkurenční nástroje typu ChatGPT.\r\n\r\n";

/** What the menu's Informace o verzi actually shows: the preface, then his own
 *  text, inflected off the settings exactly as it was before. */
export function webVersionText(settings: PokydSettings): string {
  return WEB_PREFACE + versionText(settings);
}

/* -------------------------------------------------------------- O programu */

/** The second group box's caption -- his own "Upozorneni", dated, so that the
 *  two boxes are told apart by the thing that actually distinguishes them. */
export const NOTICE_CAPTION = "Upozornění 2026";

/** The notice, in three pieces because the middle one is a link.  A static in
 *  his dialog is one run of text; this is the one control in the port that is
 *  not, and src/app/screens.ts is where the anchor is made. */
export const NOTICE_BEFORE =
  "Toto je webová podoba poslední dostupné verze programu. "
  + "Zdrojový kód a informace jsou k dispozici ";
export const NOTICE_LINK = "na GitHubu";
export const NOTICE_AFTER = ".";

/** Where the link goes.  The one address on this screen that answers. */
export const NOTICE_URL = "https://github.com/timichal/pokyd";

/** The notice's two controls, by the ids `exhibitAbout` gives them.  Neither id
 *  is in IQPokyd.rc -- they are ours, and named in English like everything else
 *  we wrote -- so nothing of his can collide with them. */
export const NOTICE_GROUP_ID = "IDC_WEBNOTICE";
export const NOTICE_TEXT_ID = "IDC_WEBNOTICETEXT";

/** The three controls the exhibit does not draw, matched on their captions
 *  because two of the three are IDC_STATIC and have no id to match on.
 *  test/app/exhibit.test.ts checks that each one really is in his template, so
 *  that a typo here is not a silent no-op. */
export const DROPPED_TEXT: readonly string[] = [
  "http://iqpokyd.kyblsoft.cz",
  "Web:\nE-mail:",
  "iqpokyd@kyblsoft.cz",
];

/** How much taller the notice is than the box it is modelled on.  His line is
 *  102 characters and wraps to two at 176 dialog units; ours is 109 and wraps
 *  to three, so it gets one more line at his own 9-unit spacing and two units
 *  over -- his own two lines fill his box to within a pixel, so a third line at
 *  exactly his spacing spills by one.
 *
 *  That is a wrap counted in a browser and not in the resource script, which is
 *  why it is checked in one: test/app/chat.test.mjs measures the words against
 *  this rectangle on a real page and fails if they hang out of the bottom of
 *  it.  Two units is about five pixels of slack, which is the most that can be
 *  had without the box looking let out beside his. */
const NOTICE_EXTRA = 11;

/** The gap his own two group boxes would leave between them: IDD_ABOUTBOX has
 *  3 units between the foot of the logo's box and the head of Upozorneni. */
const BOX_GAP = 3;

/** The band the two addresses and their label filled, from the foot of his box
 *  to the head of the thanks, less the 6 units of gap that has to stay. */
const ADDRESS_BAND = 24;

/** IDD_ABOUTBOX with the addresses gone and the notice in, everything in dialog
 *  units and nothing rounded: the notice is his own box's rectangle, a line
 *  taller, so the two are the same width, the same left edge, and read as a
 *  pair.
 *
 *  The two numbers everything else moves by:
 *
 *    - his Upozorneni box, and the line inside it, go down by the whole of the
 *      new box and the gap under it -- 30 + 11 + 3, so 44.
 *    - the thanks, the OK button and the dialog's own height go down by less,
 *      because the band the addresses filled has gone with them: 44 - 24 = 20.
 *
 *  Which of the two a control gets is decided by where it started: above his
 *  box nothing moves, inside it everything moves by the first, below it by the
 *  second.  Every number in that comes off his own template rather than out of
 *  here, which is what lets test/app/exhibit.test.ts check the result against
 *  it instead of against a copy. */
export function exhibitAbout(
  template: RcDialog = DIALOGS["IDD_ABOUTBOX"]!,
): RcDialog {
  const box = findControl(template, (c) => c.kind === "GROUPBOX"
    && (c.text ?? "") !== "", "the Upozorneni group box");
  const line = findControl(template, (c) => c.kind === "LTEXT"
    && c.rect.y > box.rect.y && c.rect.y < box.rect.y + box.rect.cy,
    "the line inside the Upozorneni box");

  const band = box.rect.cy + NOTICE_EXTRA + BOX_GAP;
  const moveOf = (rc: RcControl): number => {
    if (rc.rect.y < box.rect.y) return 0;
    if (rc.rect.y < box.rect.y + box.rect.cy) return band;
    return band - ADDRESS_BAND;
  };

  const controls: RcControl[] = [];
  for (const rc of template.controls) {
    if (DROPPED_TEXT.includes(rc.text ?? "")) continue;
    /* The notice starts where his box and his line are leaving from, which is
       why it is inserted here rather than appended: the two boxes then stand in
       the order they are read in. */
    if (rc === box) {
      controls.push(
        { ...box, text: NOTICE_CAPTION, id: NOTICE_GROUP_ID, numericId: null,
          rect: { ...box.rect, cy: box.rect.cy + NOTICE_EXTRA } },
        { ...line, text: NOTICE_BEFORE + NOTICE_LINK + NOTICE_AFTER,
          id: NOTICE_TEXT_ID, numericId: null,
          rect: { ...line.rect, cy: line.rect.cy + NOTICE_EXTRA } },
      );
    }
    const move = moveOf(rc);
    controls.push(move === 0
      ? rc
      : { ...rc, rect: { ...rc.rect, y: rc.rect.y + move } });
  }

  return {
    ...template,
    rect: {
      ...template.rect, cy: template.rect.cy + band - ADDRESS_BAND,
    },
    controls,
  };
}

/** The same error `controlOf` in src/app/frame.ts raises, for a control that
 *  has no id to be found by. */
function findControl(
  dialog: RcDialog, match: (c: RcControl) => boolean, what: string,
): RcControl {
  const found = dialog.controls.find(match);
  if (found === undefined) throw new Error(what + " is not in " + dialog.id);
  return found;
}
