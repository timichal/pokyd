/* IQ Pokyd - test/app/chat.test.mjs - phase 5.2 of PLAN.md.

   The milestone: hold a conversation with IQ Pokyd in a browser. Every test
   before this one drove the engine -- through the C API, through the wasm
   module, through the worker protocol. This one drives the page. It builds the
   app with Vite, serves dist/ over loopback, launches Chrome at
   test/app/chat.html, and that page puts the built index.html in an iframe and
   types the 23 sentences of test/golden/rozhovor.in into it, one at a time,
   pressing the button each time.

   What comes back is what was on the screen: the transcript read out of the
   DOM, encoded back to CP1250 and compared here with the file the MinGW build
   printed to a console at phase 1.6. If those bytes match, then a person with
   a browser and a person with a 2005 Windows binary are talking to the same
   program.

   Since phase 6.4 the first turn on the screen is not part of that comparison
   and is checked on its own: NAPIS_UVODNI_UVITANI greets the visitor before
   anything is typed, and which of its ten lines it picks is rand()%10 off the
   same seed the page is pinned to -- so it is a fixed string here too.

   Twice over. A first visit inflects 402,252 word forms and leaves 18 MB in
   IndexedDB; a second iframe -- new worker, new wasm module, new database
   connection -- finds that blob and is ready in a fifth of a second. Both have
   to be the golden conversation, and the second one has to be fast, or phase
   4.4 bought nothing.

   Run it:   node test/app/chat.test.mjs [--head]

   Needs python3 tools/build.py --wasm to have run, and npm install. It runs
   `vite build` itself, so what it tests is always the current sources. --head
   shows the browser, which is the only way to watch the conversation happen.

   Written by us, not ported. English identifiers and ASCII only, like the rest
   of the non-engine code, so every Czech letter in here is a \u escape.
*/

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { ROOT, runPage } from "../browser.mjs";
/* The codec, for the same reason test/app/caption.test.ts uses it: what came
   back from the browser is an array of CP1250 bytes, and comparing it with a
   module's string means going through phase 4.1 in one direction or the
   other. */
import { decodeCp1250, encodeCp1250 } from "../../src/web/cp1250.ts";
/* Phase 6.3.  Two data modules, and only data: PALETTE and WINDOW_LAYOUT are
   what test/app/resources.test.ts reads back out of the engine source, and
   MENUS is the author's own menu -- so comparing the page with them closes the
   loop from PROSTRED.PR to what a visitor sees.  Nothing here drives the
   engine or knows anything of the protocol; that is still the rule. */
import {
  DIALOGS, MENUS, PALETTE, WINDOW_LAYOUT,
} from "../../src/app/resources.ts";
import {
  DROPPED_COMMANDS, GENDERS, MENU_BITMAPS, exhibitMenu, settingsCaption,
} from "../../src/app/caption.ts";
/* Phase 8.2 and 8.4.  The same rule a third time: data and pure functions
   only, each of them already held against the archive by a test of its own --
   test/app/help.test.ts reassembles the three texts out of the author's C, and
   test/app/debug.test.ts does the same for the cheat panel's report and its two
   refusals.  So what is compared with the screens below is his own writing. */
import {
  HELP_CAPTION, THANKS, VERSION_CAPTION, helpText, markup, plain,
} from "../../src/app/help.ts";
/* Phase 9.0.  The same rule a fourth time: src/app/exhibit.ts is pure data and
   pure functions, test/app/exhibit.test.ts has already held its preface against
   the author's own text and its template edit against his own rectangles, so
   what is compared with the two screens below is that module and not a second
   copy of the Czech. */
import {
  DROPPED_TEXT, NOTICE_CAPTION, NOTICE_LINK, NOTICE_URL, exhibitAbout,
  webVersionText,
} from "../../src/app/exhibit.ts";
import {
  CHEAT_SENTENCE, ERROR_TITLE, MOOD_NOT_A_NUMBER, MOOD_OUT_OF_RANGE,
  WARNING_TITLE, report as debugReport, tooltips, warningText,
} from "../../src/app/debug.ts";
/* Phase 7.1.  The same three rules again: data only, and data that
   test/app/settings.test.ts has already held against Nastaveni.cpp -- so what
   is compared with the dialog on the screen is the author's own dialog. */
import {
  ADVANCED_CONTROLS, BASIC_CONTROLS, CHARACTERS, HUMAN_NAME_ERROR, MOODS,
  NAME_ERROR_TITLE,
} from "../../src/app/settings.ts";
/* Phase 7.3.  The page wrote IQPOKYD.CFG into localStorage with this module;
   node reads it back with the same one, which is how the round trip is checked
   without a second parser existing to disagree with the first. */
import {
  CONFIG_MISSING, CONFIG_OK, read as readConfig,
} from "../../src/app/config.ts";
/* Phase 6.4.  The welcome line is drawn off the seed the page was pinned to, so
   node can say which of the ten it should be -- and test/app/greeting.test.ts is
   what says those ten are the author's. */
import { greeting, greetingIndex } from "../../src/app/greeting.ts";

const MODULE_PATH = join(ROOT, "build", "wasm", "pokyd.mjs");
const VITE_BIN = join(ROOT, "node_modules", "vite", "bin", "vite.js");
const GOLDEN = join(ROOT, "test", "golden", "rozhovor.txt");

/* test/golden/README.md: what that transcript was recorded under.  Character 3
   and both genders are NASTAV_STANDARDNE's own defaults (NASTAVEN.PR:25-43),
   and the page reads them back rather than setting them, so a moved default
   fails here and not as a mystifying transcript diff. */
const CHARACTER = 3;
const MOOD = 3;
const GENDER = 1;
/* What 23 sentences of test/golden/rozhovor.in do to it: nalada 3 -> 1, the
   best of the five.  That drift is phase 7.2, and since 7.1 the dialog is a
   second place a visitor sees it: the mood list opens on this number. */
const MOOD_AFTER = 1;

/* What is on IDD_NASTAVENI besides the basic page: OK, Storno and the two group
   boxes, which his two functions leave alone (test/app/settings.test.ts proves
   that is exactly the list).  The two page buttons were on it too and are not
   drawn any more -- src/app/dialog.ts DROPPED. */
const ALWAYS_SHOWN = ["IDOK", "IDCANCEL", "IDC_RAMECEK1", "IDC_RAMECEK2"];

/* Everything src/app/dialog.ts does not draw: the second page, and the two
   buttons that switched to it.  The list is written out here rather than
   imported because a test that shares the module's own idea of what is missing
   proves nothing -- ADVANCED_CONTROLS is held against Nastaveni.cpp by
   test/app/settings.test.ts, and this is held against the screen. */
const DROPPED = ["IDC_ZAKLADNINASTAVENI", "IDC_ROZSIRENENASTAVENI",
  "IDC_UKLADATROZHOVOR",
  "IDC_EMULOVATKLAVESNICI", "IDC_EMULOVATCESKOUKLAVESNICI",
  "IDC_EMULOVATSLOVENSKOUKLAVESNICI", "IDC_KLAVESNICEQWERTY",
  "IDC_TEXTKEMULACI", "IDC_ZOBRAZOVATSTANDARDNIKURZOR",
  "IDC_NEZOBRAZOVATPOZADI", "IDC_READONLYMOD", "IDC_ZOBRAZOVATPOPISKY"];

/* The one control of OnZakladniNastaveni's own list that is not on the screen:
   phase 8 dropped the conversation log, so its tick went with it -- the
   argument is in src/app/dialog.ts's DROPPED.  It is named here rather than
   taken out of BASIC_CONTROLS, because that list is the *author's* page and
   test/app/settings.test.ts holds it against Nastaveni.cpp. */
const DROPPED_FROM_BASIC = ["IDC_UKLADATROZHOVOR"];

/* GENDERS[1], "muz" -- what the caption says for a computer with no name. */
const GENDER_WORD = GENDERS[1];

/* 4.4 measured 14.53 s cold and 0.18 s warm in Chrome 152.  These are the
   bounds that would mean something had gone wrong -- a cold path taken twice,
   or a load so slow the cache cannot be being read at all -- not the
   measurement. */
const WARM_MAX_MS = 3000;

let checks = 0;
let failures = 0;

function heading(text) { console.log("\n" + text); }

function ok(label, cond, detail = "") {
  checks++;
  if (cond) console.log("  ok    " + label);
  else {
    failures++;
    console.log("  FAIL  " + label + (detail ? "\n        " + detail : ""));
  }
}

function eq(label, got, expected) {
  ok(label, Object.is(got, expected),
    "got " + JSON.stringify(got) + ", expected " + JSON.stringify(expected));
}

/** A screen's text, which came back as CP1250 bytes, against a module's string.
 *  Byte for byte, and it says where they part rather than printing nine
 *  thousand characters twice. */
function eqBytes(label, got, expected) {
  const a = Uint8Array.from(got);
  const b = encodeCp1250(expected);
  if (Buffer.compare(a, b) === 0) { ok(label, true); return; }
  let at = 0;
  while (at < a.length && at < b.length && a[at] === b[at]) at++;
  ok(label, false, "they part at byte " + at + " of " + b.length
    + " (got " + a.length + ")"
    + "\n        got      " + JSON.stringify(
      decodeCp1250(a.subarray(Math.max(0, at - 30), at + 40)))
    + "\n        expected " + JSON.stringify(
      decodeCp1250(b.subarray(Math.max(0, at - 30), at + 40))));
}

/* Where two CP1250 transcripts first differ, in the terms the golden file is
   written in: a line number and both versions of the line, as escapes. */
function firstDifference(got, expected) {
  const n = Math.min(got.length, expected.length);
  let at = -1;
  for (let i = 0; i < n; i++) {
    if (got[i] !== expected[i]) { at = i; break; }
  }
  if (at === -1) {
    return "one is a prefix of the other: " + got.length + " bytes against "
      + expected.length;
  }
  const line = expected.subarray(0, at).reduce(
    (count, b) => count + (b === 0x0a ? 1 : 0), 0) + 1;
  const show = (bytes) => {
    const start = bytes.lastIndexOf(0x0a, at) + 1;
    let end = bytes.indexOf(0x0a, at);
    if (end === -1) end = bytes.length;
    return Array.from(bytes.subarray(start, end)).map(
      (b) => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b)
        : "\\x" + b.toString(16).padStart(2, "0")).join("");
  };
  return "byte " + at + ", line " + line + ":\n        got      " + show(got)
    + "\n        expected " + show(expected);
}

/* ------------------------------------------------------------- the checks */

function checkVisit(run, golden, cold, seed) {
  heading(run.kind + " visit -- " + (run.loadMs / 1000).toFixed(2)
    + " s to the first typed character, " + run.turns + " turns on the screen");

  /* 1. what the visitor saw before the engine was ready. */
  eq("the page came up loading, not ready", run.firstState, "loading");
  ok("IDD_NACITANI was on the screen while it loaded", run.loadingShown === true);
  ok("and off it afterwards", run.loadingGone === true);
  ok("the input and the button are live", run.inputLive === true);
  ok("and the cursor is in the input, so the visitor can just type"
    + (cold ? " -- once the first-visit settings are away" : ""),
    run.focused === true);

  /* 2. NAPIS_UVODNI_UVITANI, phase 6.4: the one line on the screen that nobody
        typed anything to get.  It is IQ Pokyd's, it comes before the 23, and
        which of the ten it is, is `rand()%10` off the seed the page was pinned
        to -- so a fixed seed makes it a fixed string, and this is that string. */
  eq("IQ Pokyd said hello before a word was typed", run.greeting.who, "pokyd");
  eq("  with the computer's own marker", run.greeting.marker, "<");
  eq("  and it is greeting " + greetingIndex(seed) + " of ten, which is what"
    + " seed " + seed + " draws", run.greeting.text,
    greeting(greetingIndex(seed), run.settings));

  /* 3. the conversation, which is the whole point. */
  const got = Uint8Array.from(run.transcript);
  ok("the transcript on the screen is test/golden/rozhovor.txt, byte for byte"
    + " -- " + got.length + " bytes",
    got.length === golden.length && Buffer.compare(got, golden) === 0,
    firstDifference(got, golden));
  eq("46 turns: 23 typed, 23 answered", run.turns, 46);
  eq("and they alternate", run.whoOrder,
    Array.from({ length: 23 }, () => "human,pokyd").join(","));
  eq("no answer came back empty", run.emptyAnswers, 0);
  eq("the engine counted the same 23 sentences", run.sentenceCount, 23);
  ok("the input was locked while the engine answered", run.busySeen > 0,
    "the busy state was never observed between a click and an answer");

  /* 4. the settings the golden file leans on, read back rather than set. */
  eq("character is still 3 (prumerny)", run.settings.character, CHARACTER);
  eq("mood is still 3 (normalni)", run.settings.mood, MOOD);
  eq("both genders are still the default", run.settings.humanGender, GENDER);
  eq("  and the computer's", run.settings.computerGender, GENDER);
  /* Read again after the 23rd sentence.  nalada is naladabody/15 and
     naladabody drifts as the conversation goes (INTELIG.FU:532), so this is the
     one setting that is expected to have moved -- and 1 is the best of the
     five, which is what 23 civil sentences get you. */
  eq("and the mood it ended the conversation in", run.moodAfter, MOOD_AFTER);

  /* 5. the cache, from phase 4.4, now doing its job for a real page. */
  if (cold) {
    ok("a first visit wrote the cache -- " + run.report.bytes + " bytes",
      run.report.saved === true && run.report.bytes > 18000000);
    ok("and it did not find one to start with", run.report.hit === false);
  } else {
    ok("a second visit found it", run.report.hit === true);
    ok("so it did not write one again", run.report.saved === false);
    ok("and it was ready in " + (run.loadMs / 1000).toFixed(2) + " s",
      run.loadMs < WARM_MAX_MS,
      "a warm visit took " + run.loadMs + " ms, which is a cold path");
  }
  eq("no storage failure", run.report.error, null);

  /* 6. the teardown. */
  eq("the engine freed everything it allocated", run.unfreed, 0);
}

/* --------------------------------------------------- the window, phase 6.3 */

/** A PALETTE entry as getComputedStyle hands it back. */
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return "rgb(" + ((n >> 16) & 0xff) + ", " + ((n >> 8) & 0xff) + ", "
    + (n & 0xff) + ")";
}

function checkWindow(run) {
  const w = run.window;
  heading(run.kind + " visit -- the author's window");

  /* 1. his three headings, which are in IDD_HLAVNI_OKNO and nowhere else. */
  const main = DIALOGS["IDD_HLAVNI_OKNO"];
  const control = (id) => main.controls.find((c) => c.id === id).text;
  eq("IDC_NADPIS1 is on the screen", w.headings.left, control("IDC_NADPIS1"));
  eq("IDC_NADPIS2 is on the screen", w.headings.title, control("IDC_NADPIS2"));
  eq("IDC_NADPIS3 is on the screen", w.headings.right, control("IDC_NADPIS3"));

  /* 2. PROSTRED.PR's COLORREFs, byte-reversed once in resources.ts and not
        again anywhere: what you said is yellow, what IQ Pokyd said is green,
        and a reader who took them for #RRGGBB would have them the other way
        round. */
  eq("what you said is g_barvatextucloveka", w.colours.human,
    rgb(PALETTE.humanText));
  eq("what IQ Pokyd said is g_barvatextupocitace", w.colours.pokyd,
    rgb(PALETTE.pokydText));
  eq("the side headings are g_barvahlavickovychtextu", w.colours.heading,
    rgb(PALETTE.headingText));
  eq("the title in the middle is g_barvanapisuIQPokyd", w.colours.title,
    rgb(PALETTE.titleText));
  eq("the line you type into is g_barvapozadizadavanivety", w.colours.input,
    rgb(PALETTE.inputBackground));
  eq("  with the human's own colour on it (mfcDlg.cpp:920)", w.colours.inputText,
    rgb(PALETTE.humanText));

  /* 3. PROSTRED.FU:923-924, measured off the page rather than declared. */
  eq("the transcript box sits OKRAJE+10 from the left", w.box.left,
    WINDOW_LAYOUT.transcript.left);
  eq("  and from the right", w.box.right, WINDOW_LAYOUT.transcript.right);
  eq("  OKRAJE+20 from the top", w.box.top, WINDOW_LAYOUT.transcript.top);
  eq("  and OKRAJE+45 from the bottom, where the input line begins",
    w.box.bottom, WINDOW_LAYOUT.transcript.bottom);

  /* 4. Phase 6.5, and the only deliberate deviation in the window.  :962 stopped
        drawing the moment a sentence would cross the top inset, so in 2005 the
        beginning of a long conversation was gone; here the box scrolls to it.
        The decision is written up in PLAN.md 6.5 and argued in chat.css; what is
        checked here is that it cost nothing it was not meant to cost.

        The first two are the deviation itself.  The rest are the fidelity: at
        rest the box is at the bottom, the newest sentence is ROZESTUP above the
        floor exactly as :946 puts it, and the window still fills the viewport
        with nothing scrolling past its edges.  A screenshot of this page and a
        screenshot of his are still the same picture. */
  eq("the transcript scrolls now", w.boxOverflow, "auto");
  eq("  and can be scrolled from the keyboard, not the mouse alone",
    w.boxTabIndex, 0);
  ok("  with a name on it, since a focusable region needs one", w.boxLabelled);
  ok("two dozen turns overflow a 32em window, so there is something to reach",
    w.scroll.overflows, JSON.stringify(w.scroll));
  ok("  the oldest of them is reachable by dragging to the top",
    w.scroll.oldestReachable === true, JSON.stringify(w.scroll));
  ok("but at rest the box is at the bottom, where PREFORMATUJ_TEXTY_...:944 drew",
    w.scroll.atBottom, JSON.stringify(w.scroll));
  eq("  with ROZESTUP under the newest sentence (:946)", w.scroll.gapBelowNewest,
    WINDOW_LAYOUT.spacing);
  ok("and nothing scrolled off the page either", w.pageScrollable === false);

  /* 5. PREKRESLI_OBRAZOVKU (:827) reloads the bitmap at okno.right x
        okno.bottom, so it is stretched and its aspect ratio is not kept. */
  ok("the author's photograph is behind the window",
    w.background.image.includes("pozadi-iqpokyd"), w.background.image);
  eq("stretched to the window, not tiled and not cropped", w.background.size,
    "100% 100%");
  eq("and not repeated", w.background.repeat, "no-repeat");

  /* 6. ours, and deliberately not on the screen. */
  eq("the > and < are in the markup and not in the window", w.markerDisplay,
    "none");

  /* 7. The menu.  Phase 8.2 merged his two popups into one and took three
        commands out of it, so what is on the bar is exhibitMenu(IDR_MENU) --
        and every number below is counted off that rather than written down.
        The author's own menu is still what it is built from: the test that the
        three really were in it is in checkScreens. */
  const shown = exhibitMenu(MENUS["IDR_MENU"]);
  const popups = shown.items.filter((i) => i.kind === "popup");
  const menuItems = popups.reduce(
    (n, p) => n + p.items.filter((i) => i.kind === "item").length, 0);
  const separators = popups.reduce(
    (n, p) => n + p.items.filter((i) => i.kind === "separator").length, 0);
  const withBitmap = popups.reduce((n, p) => n + p.items
    .filter((i) => i.id !== null && MENU_BITMAPS[i.id] !== undefined).length, 0);
  eq("every top-level item of the menu is on the bar", w.menu.titles.length,
    shown.items.length);
  eq("and every item in the popup", w.menu.items, menuItems);
  eq("with the separators the merge left", w.menu.separators, separators);
  eq("each one carries its bitmap", w.menu.bitmaps, withBitmap);
  eq("and each one its accelerator text", w.menu.accelerators.length, menuItems);
  /* Phase 6.3 drew five greyed items and honoured one command; 8.2 and 8.4
     finished the job from both ends -- the three that could never work are
     gone, and the four that are left all have a handler.  Nothing on this bar
     is greyed any more. */
  /* eq() here is Object.is, so the list is compared as a string. */
  eq("every command on the bar is live", w.menu.enabled.join(","),
    ["ID_MALANAPOVEDA", "ID_NASTAVENI", "ID_OPROGRAMU", "ID_OVERZI"].join(","));

  /* 8. ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI, which is the point of the whole
        right-hand side of the bar -- and it is *live*: the same 23 sentences
        that move nalada from 3 to 1 move the word in the menu with it. */
  const caption = (mood) => settingsCaption({
    ...run.settings, humanName: "", computerName: "", mood,
  });
  eq("the menu said who was talking to whom before a word was typed",
    run.captionBefore, caption(MOOD));
  eq("and it moved with the mood as the conversation went", w.caption,
    caption(MOOD_AFTER));
  ok("which is a different line from the one it started with",
    run.captionBefore !== w.caption);
}

/* ----------------------------------------------- the settings dialog, 7.1 */

/* IDD_NASTAVENI, opened and driven in the browser the two ways a visitor can
   open it.  What it is compared with is the author's own template and the two
   lists src/app/settings.ts re-exports -- test/app/settings.test.ts is what
   holds those against Nastaveni.cpp, so this is the other half of the loop:
   that what the module says is what is on the screen. */
function checkSettings(run, cold) {
  const d = run.dialog;
  const template = DIALOGS["IDD_NASTAVENI"];
  heading(run.kind + " visit -- IDD_NASTAVENI");

  /* 1. the two ways in, both of them ID_NASTAVENI (IQPokyd.rc:150 gives the
        right-justified caption the same command as the menu item). */
  ok("the settings item is no longer greyed", d.menuEnabled);
  ok("and neither is the status line, which is the same command",
    d.captionEnabled);
  ok("F4 opens the dialog, which is IDR_ZKRATKY's own accelerator",
    d.openedByF4);
  ok("and so does the menu item", d.openedFromMenu);

  /* 2. what is on it. */
  eq("it is titled as the template titles it", d.caption, template.caption);
  eq("and it is modal", d.modal, "true");
  eq("every control of IDD_NASTAVENI that is not dropped is on it", d.controls,
    template.controls.length - DROPPED.length);
  eq("and what it shows is OnZakladniNastaveni's own list, less the one tick"
    + " phase 8 took off it", d.shown.join(","),
    [...BASIC_CONTROLS.filter((id) => !DROPPED_FROM_BASIC.includes(id)),
      ...ALWAYS_SHOWN].sort().join(","));
  eq("the two group boxes wear the template's own captions, with nothing left"
    + " to swap them for", d.groups.join(" / "),
    template.controls.find((c) => c.id === "IDC_RAMECEK1").text + " / "
    + template.controls.find((c) => c.id === "IDC_RAMECEK2").text);
  eq("the character list is the author's seven words", d.lists.character.join(","),
    CHARACTERS.join(","));
  eq("  with the engine's own charakter selected", Number(d.lists.characterValue),
    CHARACTER);
  eq("the mood list is his five", d.lists.mood.join(","), MOODS.join(","));
  eq("  with the mood the conversation drifted to", Number(d.lists.moodValue),
    MOOD_AFTER);
  ok("both genders are on the male radio, which is what pohlavi 1 means",
    d.genders.human && d.genders.computer);
  eq("nothing on it is greyed: every control that could not be honoured was on"
    + " the page that is gone", d.disabled.join(","), "");

  /* 3. and that page, checked the only way a cut can be: by absence.  The
        eleven controls of OnRozsireneNastaveni and the two buttons that
        switched between the pages are not on the dialog at all. */
  eq("the advanced page is not drawn, and neither are the two page buttons"
    + " or the conversation log's tick", d.droppedFound.join(","), "");
  eq("  which is the whole of ADVANCED_CONTROLS, plus the two buttons and that"
    + " one tick", DROPPED.slice(3).join(","), ADVANCED_CONTROLS.join(","));

  /* And the window is that much smaller.  Both numbers come off the screen as
     multiples of IDC_RAMECEK1's own height, so the comparison is in the
     template's dialog units and not in whatever pixel the visitor's font made
     of them -- which is the same trick phase 6.3 measures the main window with,
     one step further in. */
  const rc = (id) => template.controls.find((c) => c.id === id).rect;
  /* The two bands with nothing left in them: the page buttons' row at the top
     of the template, and -- since phase 8 -- the conversation log's tick, which
     was the first row inside "Prostredi". */
  const topRow = rc("IDC_ZAKLADNINASTAVENI").cy;
  const logRow = rc("IDC_UKLADATROZHOVOR").cy;
  const unit = rc("IDC_RAMECEK1").cy;
  const near = (a, b) => Math.abs(a - b) < 0.03;
  ok("no control fell off the dialog on the way up", d.rect.fits);
  ok("the dialog is exactly those two rows shorter -- " + topRow + " + "
    + logRow + " dialog units off " + template.rect.cy,
    near(d.rect.heightInGroups, (template.rect.cy - topRow - logRow) / unit),
    d.rect.heightInGroups.toFixed(3));
  ok("and the first group box kept the template's own gap above it, less the"
    + " row above it",
    near(d.rect.topGapInGroups, (rc("IDC_RAMECEK1").y - topRow) / unit),
    d.rect.topGapInGroups.toFixed(3));
  /* The second band is inside a group box rather than above everything, so it
     shortens the box instead of moving it -- and the three ticks under it move
     up into the place the fourth used to have. */
  ok("the second group box closed over the tick that went",
    near(d.rect.group2InGroups, (rc("IDC_RAMECEK2").cy - logRow) / unit),
    d.rect.group2InGroups.toFixed(3));
  ok("and the first tick left sits where his first one sat",
    near(d.rect.firstCheckInGroups,
      (rc("IDC_UKLADATROZHOVOR").y - rc("IDC_RAMECEK2").y) / unit),
    d.rect.firstCheckInGroups.toFixed(3));

  /* 4. the one refusal, which in 2005 was a MessageBox. */
  ok("a two-word name is refused", d.refusal.shown);
  eq("  with his title", d.refusal.title, NAME_ERROR_TITLE);
  eq("  and his words", d.refusal.text, HUMAN_NAME_ERROR);
  ok("  the dialog stays open on it", d.refusal.stillOpen);
  ok("  with the focus back in that edit (Nastaveni.cpp:149)",
    d.refusal.focused);

  /* 5. Storno, by way of Escape. */
  ok("Escape closes it", d.closedByEscape);
  eq("  and nothing it refused was applied", d.afterCancel, "");

  /* 6. OK, and what it reaches. */
  ok("OK closes it", d.closedByOk);
  eq("the character it chose reached the engine", d.applied.character, 0);
  eq("  the name was trimmed on the way (PROSTRED.FU:60-62)",
    d.applied.humanName, "Michal");
  eq("  spisovna cestina is on", d.applied.formalCzech, 1);
  eq("  and so is pouzivatefekty", d.applied.useEffects, 1);
  /* The list box was not touched, so naladabody is still the conversation's --
     which is the whole point of Nastaveni.cpp:166 and of pokyd_set_mood being
     a call of its own. */
  eq("the mood the conversation earned was not reset by an OK on a name",
    d.applied.moodPoints, d.moodPointsBefore);
  eq("  and it is still the mood it was", d.applied.mood, MOOD_AFTER);
  /* NASTAV_VIDITELNOST_EFEKTNICH_PROGRESSBARU, PROSTRED.FU:163. */
  eq("both edge bars came out with pouzivatefekty", d.effectsShown, 2);
  /* The trap in dropping a page from a dialog that writes its whole struct at
     once: a control that is not there must not be read as "not ticked".  Both
     of these are NASTAV_STANDARDNE's own 1s (NASTAVEN.PR:26, :43). */
  eq("and the settings the dropped page carried survived the OK: zobrazovatpopisky",
    d.applied.showLabels, 1);
  eq("  and klavesniceqwerty", d.applied.keyboardQwerty, 1);
  /* ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI, :204 -- the caption is the name and
     the character it was just given. */
  eq("and the menu bar says what was just set", d.captionAfterOk,
    "Michal x " + GENDER_WORD + ", " + CHARACTERS[0] + ": " + MOODS[MOOD_AFTER - 1]);

  /* 7. phase 7.4: four commands that are in no menu at all. */
  eq("F8 is a worse mood (mfcDlg.cpp:952)", d.moodAfterF8, MOOD_AFTER + 1);
  eq("F7 is a better one (:944)", d.moodAfterF7, MOOD_AFTER);
  eq("Ctrl+F8 is a worse character (:960)", d.characterAfterCtrlF8, 1);
  eq("and the menu bar moved with them", d.captionAfterKeys,
    "Michal x " + GENDER_WORD + ", " + CHARACTERS[1] + ": " + MOODS[MOOD_AFTER - 1]);

  /* 8. phase 7.3: what OnOK wrote next to the program, which here is a
        localStorage entry under his own file name.  It is parsed back with the
        same module the page wrote it with -- and what it has to parse back to
        is the settings the dialog was just put back to, NASTAV_STANDARDNE's
        own charakter and nalada included. */
  ok("OK wrote IQPOKYD.CFG", typeof d.storedConfig === "string"
    && d.storedConfig.length > 0);
  const stored = readConfig(d.storedConfig, d.restored);
  eq("  and it is a file PRECTI_NASTAVENI_ZE_SOUBORU accepts", stored.status,
    CONFIG_OK);
  eq("  saying what the engine now holds", JSON.stringify(stored.settings),
    JSON.stringify(d.restored));
  eq("  which is the charakter the golden conversation was recorded under",
    d.restored.character, CHARACTER);
  eq("  and the nalada", d.restored.mood, MOOD);
  ok("  written as his own file, header and all",
    d.storedConfig.startsWith("IQ Pokyd v0.15 - soubor s nastavenim"),
    JSON.stringify(d.storedConfig.slice(0, 40)));
  ok("  in CRLF, as a file opened with \"w\" on Windows was",
    d.storedConfig.includes("\r\nPohlavi cloveka: muz\r\n"));

  /* And the half that only a second visit can show: it read the file the first
     one left, rather than starting from NASTAV_STANDARDNE. */
  eq("this visit started from " + (cold ? "no stored settings" : "the stored ones"),
    d.configStatus, cold ? CONFIG_MISSING : CONFIG_OK);
  /* g_zobrazitnastaveni, mfcDlg.cpp:436 and PROSTRED.FU:498: a visitor who has
     no settings file is asked who he is before he types anything, and a visitor
     who has one is not.  It is the same pair of visits that proves the file was
     written and read, seen from the window instead of from storage. */
  if (cold) {
    ok("a first visit opens IDD_NASTAVENI by itself, with no file to read",
      d.openedOnArrival);
  } else {
    ok("a second visit does not: it has a file, so it is not asked again",
      !d.openedOnArrival);
  }
}

/* --------------------------------------------- phase 8.2 and 8.4: the screens */

/* The four windows phase 8 added, read off the screen a visitor was looking at
   and compared with the author's own words -- which, by the time they reach
   here, have already been reassembled out of his own C by
   test/app/help.test.ts and test/app/debug.test.ts.  So this closes the loop
   the rest of the file closes: from the archive, through a module, to pixels,
   and back.

   And the cut, which is the other half of 8.2: three commands are gone from the
   menu, and the check that they are is that they were in IDR_MENU to begin
   with. */
function checkScreens(run) {
  const s = run.screens;
  const settings = { humanGender: GENDER };

  heading(run.kind + " visit -- the menu after phase 8.2");

  /* The cut, at both ends: each dropped command really is one of his, and none
     of the three is on the bar. */
  const inArchive = new Set();
  const walk = (items) => {
    for (const item of items) {
      if (item.id !== null) inArchive.add(item.id);
      walk(item.items);
    }
  };
  walk(MENUS["IDR_MENU"].items);
  eq("all three dropped commands were in IDR_MENU",
    DROPPED_COMMANDS.filter((id) => !inArchive.has(id)).join(","), "");
  eq("and none of them is on the bar",
    DROPPED_COMMANDS.filter((id) => s.commands.includes(id)).join(","), "");
  eq("what is left is his four, in his order", s.commands.join(","),
    ["ID_NASTAVENI", "ID_MALANAPOVEDA", "ID_OVERZI", "ID_OPROGRAMU"].join(","));
  eq("and nothing on it is greyed", s.greyed.join(","), "");

  /* ------------------------------------------------------- Mala napoveda */

  heading("Mala napoveda -- ZOBRAZ_NAPOVEDU, in a window");
  const help = helpText(settings);
  eq("the caption is his", s.help.caption, HELP_CAPTION);
  eq("and it is modal", s.help.modal, "true");
  eqBytes("the text on the screen is the text in PROSTRED.FU",
    s.help.text, plain(help));
  /* NAPIS_FORMATOVANY_TEXT_NAPOVEDY's four formats, counted off the same parse
     the page drew with -- so a run that lost its class shows up here. */
  const runsWith = (text, flag) => markup(text).filter((r) => r[flag]).length;
  eq("<h> is on exactly the runs it is on in his text",
    s.help.large, runsWith(help, "large"));
  eq("and <u>", s.help.underline, runsWith(help, "underline"));
  eq("and <c>", s.help.highlight, runsWith(help, "highlight"));
  eq("the rich edit is white (Text.cpp:76)", s.help.background,
    "rgb(255, 255, 255)");
  ok("it scrolls, because his text does not fit in 166 dialog units",
    s.help.scrollable);
  eq("the button says what IDD_TEXT says", s.help.okLabel, "OK");
  ok("and it closes the window", s.help.closedByOk);
  eq("F1 opens the same screen", s.helpByF1, HELP_CAPTION);

  /* ----------------------------------------------------- Informace o verzi */

  heading("Informace o verzi -- CMfcDlg::OnOverzi, in the same window");
  eq("the caption is his", s.version.caption, VERSION_CAPTION);
  eqBytes("and the text is the 2026 preface and then the one in mfcDlg.cpp",
    s.version.text, plain(webVersionText(settings)));
  ok("the close box in the caption bar shuts it", s.version.closedByX);

  /* ------------------------------------------------------------ O programu */

  heading("O programu -- IDD_ABOUTBOX, as exhibitAbout leaves it");
  const about = exhibitAbout();
  eq("the caption is the template's", s.about.caption, about.caption);
  eq("every one of its controls is on the screen", s.about.controls,
    about.controls.length);
  eq("the heading is the template's", s.about.heading, "IQ Pokyd v0.15");
  eqBytes("the thanks are the paragraph he wrote", s.about.thanks, THANKS);
  ok("the KYBLSoft logo is IDB_KYBLSOFT", s.about.logo);
  /* Phase 9.0: the two dead addresses and the label over them are off the
     screen, and the check is over the whole page rather than over the three
     controls, so moving one somewhere else would not pass it either. */
  const page = decodeCp1250(Uint8Array.from(s.about.body));
  for (const gone of DROPPED_TEXT) {
    ok("nothing on the page says " + JSON.stringify(gone),
      !page.includes(gone));
  }
  /* And the notice that took their place. */
  const notice = about.controls.find((c) => c.id === "IDC_WEBNOTICETEXT");
  eqBytes("the 2026 box says what the template says", s.about.notice,
    notice.text);
  eqBytes("under the caption it gives it", s.about.noticeCaption,
    NOTICE_CAPTION);
  eqBytes("and 'na GitHubu' is the part that is a link",
    s.about.linkText, NOTICE_LINK);
  eq("pointing at the repository", s.about.linkHref, NOTICE_URL);
  eq("in a tab of its own", s.about.linkTarget, "_blank");
  eq("in the blue his COLORREF actually is", s.about.linkColour,
    "rgb(0, 0, 255)");
  ok("his own line fits the rectangle he drew for it, as it always did",
    s.about.hisLineSpill <= 0, "it spills " + s.about.hisLineSpill + "px");
  ok("and ours fits the one it borrowed from him",
    s.about.noticeSpill <= 0, "it spills " + s.about.noticeSpill + "px");
  ok("and OK closes it", s.about.closedByOk);

  /* ------------------------------------------------------ the cheat panel */

  heading("the cheat panel -- IDD_DEBUGNASTAVENI, Ctrl+Shift+Alt+D");
  const cheat = DIALOGS["IDD_DEBUGNASTAVENI"];
  eq("the caption is the template's", s.cheat.caption, cheat.caption);
  eq("every one of its controls is drawn -- nothing is dropped here",
    s.cheat.controls, cheat.controls.length);
  eq("the mood edit holds naladabody as the conversation left it",
    s.cheat.moodPointsShown, String(s.cheat.moodPointsNow));
  ok("the tolerance NASTAV_STANDARDNE sets is ticked", s.cheat.tolerance);
  ok("and the recursion", s.cheat.recursion);
  ok("and fast exit is not", !s.cheat.fastExit);
  eq("his twelve tool tips are on twelve controls", s.cheat.tips.length, 12);
  eq("and the one on the report is the paragraph he wrote", s.cheat.tipOnValues,
    tooltips({ humanGender: GENDER })["IDC_HODNOTY"]);

  /* The report itself.  Everything in it came back through the same
     pokyd_debug_info the page read, so node can rebuild the whole string with
     src/app/debug.ts and compare it -- which is what says a rule of dashes that
     lost a dash, or a label that lost a diacritic, is caught. */
  const reportText = decodeCp1250(Uint8Array.from(s.cheat.report));
  eq("the dictionary it names is the one the engine loaded",
    reportText.includes("11207"), true);
  eq("the rule base is the 182 of phase 2.4",
    reportText.includes("182"), true);
  ok("the three sentence parts VSTUP.FU:872 keeps are in it",
    ["Podmět:", "Přísudek:", "Předmět:"]
      .every((w) => reportText.includes(w)), reportText);
  ok("and so is the last thing IQ Pokyd said",
    reportText.includes(run.greeting === null ? "" : "Poslední odpov"));
  /* debugReport is src/app/debug.ts's own sprintf; feeding it the numbers the
     screen showed has to reproduce the screen exactly. */
  eqBytes("the whole report is his sprintf, character for character",
    s.cheat.report, debugReport(s.cheat.info, { showLabels: 1 }));

  /* His two refusals, both reached the way his loop reaches them. */
  heading("the cheat panel's two refusals, and its one question");
  ok("a character that is not a digit is refused", s.cheat.notANumber.shown);
  eq("  with his title", s.cheat.notANumber.title, ERROR_TITLE);
  eq("  and his words", s.cheat.notANumber.text, MOOD_NOT_A_NUMBER);
  ok("  and the dialog stays up", s.cheat.notANumber.stillOpen);
  eq("a number over 90 gets the other one", s.cheat.outOfRange.text,
    MOOD_OUT_OF_RANGE);
  ok("  and the dialog stays up for that too", s.cheat.outOfRange.stillOpen);

  /* The MB_OKCANCEL: the only place in the program where OK is a question. */
  ok("moving the spelling tolerance asks before it saves",
    s.cheat.warning.shown);
  eq("  with his title", s.cheat.warning.title, WARNING_TITLE);
  eq("  and his words, inflected for whoever is reading",
    s.cheat.warning.text, warningText(settings));
  ok("  and the dialog stays up to be answered", s.cheat.warning.stillOpen);
  ok("Storno closes it", s.cheat.cancelled);
  /* :218's `return` abandons the whole of OnOK, so the mood typed alongside the
     tolerance is not applied either. */
  eq("and nothing at all was applied -- the tolerance",
    s.cheat.afterCancel.tolerance, 1);
  eq("  the recursion", s.cheat.afterCancel.recursion, 11);
  eq("  and the mood, which was typed in the same trip",
    s.cheat.afterCancel.moodPoints, s.cheat.moodPointsNow);

  /* And the path that applies, which asks nothing: naladabody alone. */
  heading("the cheat panel, applying");
  ok("OK closes it", s.cheat.closedByOk);
  eq("naladabody is what was typed", s.cheat.applied.moodPoints, 80);
  /* SPOCITEJ_NALADU_PODLE_NALADABODY: 80/15 is 5, and 5 is his worst. */
  eq("and nalada was recomputed from it, not set", s.cheat.applied.mood, 5);
  ok("the menu bar moved with it",
    s.cheat.captionAfter.endsWith(MOODS[4]), s.cheat.captionAfter);
  /* :227, and the file has no naladabody in it: what is written is the nalada
     that was recomputed. */
  ok("and IQPOKYD.CFG was written",
    s.cheat.storedAfter !== null
      && s.cheat.storedAfter.includes("Nalada: hrozna"),
    String(s.cheat.storedAfter).split("\r\n").find((l) => l.startsWith("Nalada")));
  /* And back again through the same dialog, which is what leaves the rest of
     this file the mood the conversation drifted to. */
  eq("and a third trip puts the mood back where the conversation left it",
    s.cheat.restored, MOOD_AFTER);

  /* ------------------------------------------------------- "::debuginfo" */

  heading("the other door -- \"" + CHEAT_SENTENCE + "\", mfcDlg.cpp:562");
  eq("typing it opens the same dialog", s.cheatSentence.caption, cheat.caption);
  eq("nothing was said to the engine", s.cheatSentence.turnsAdded, 0);
  eq("and the line was not cleared, because OnNovaVeta returned before it was",
    s.cheatSentence.lineKept, CHEAT_SENTENCE);
}

/* -------------------------------------------------------------- the driver */

async function main() {
  const visible = process.argv.includes("--head");

  if (!existsSync(MODULE_PATH)) {
    console.error("no " + MODULE_PATH + "\n"
      + "  build it first:  python3 tools/build.py --wasm");
    return 1;
  }
  if (!existsSync(VITE_BIN)) {
    console.error("no " + VITE_BIN + "\n  install it first:  npm install");
    return 1;
  }

  console.log("IQ Pokyd - phase 5.2, the conversation in the built app\n");

  /* Build what the browser is about to be shown, so that this test can never
     pass against a dist/ somebody left lying about. */
  const build = spawnSync(process.execPath, [VITE_BIN, "build"],
    { cwd: ROOT, encoding: "utf8" });
  if (build.status !== 0) {
    console.error("vite build failed:\n" + (build.stdout || "")
      + (build.stderr || ""));
    return 1;
  }
  const built = (build.stdout || "").split("\n")
    .filter((line) => line.includes("dist/"))
    .map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trim());
  console.log("build   vite build, " + built.length + " files:");
  for (const line of built) console.log("        " + line);

  const { data, url, exe } = await runPage({
    page: "test/app/chat.html", visible, timeoutMs: 300000, quiet: true,
  });
  if (data.error) {
    console.error("\nthe page failed:\n" + data.error);
    return 1;
  }
  console.log("browser " + exe);
  console.log("page    " + url.replace(/^http:\/\/127\.0\.0\.1:\d+/, ""));
  console.log("app     " + data.app);

  const golden = readFileSync(GOLDEN);

  heading("the page itself");
  eq("23 sentences were typed into it", data.sentences, 23);
  eq("it is titled as the author titled his window", data.cold.title,
    "IQ Pokyd v0.15");
  eq("and it declares the language IQ Pokyd speaks", data.cold.lang, "cs");
  eq("the transcript is marked up with the golden file's own two characters",
    data.cold.markers.join(""), "<>");

  checkVisit(data.cold, golden, true, data.seed);
  checkWindow(data.cold);
  checkSettings(data.cold, true);
  checkVisit(data.warm, golden, false, data.seed);
  checkWindow(data.warm);
  checkSettings(data.warm, false);

  checkScreens(data.cold);
  checkScreens(data.warm);

  heading("the two visits together");
  ok("both used the same cache key: " + data.cold.report.key,
    data.sameKey === true);
  ok("and they are the same conversation",
    Buffer.compare(Uint8Array.from(data.cold.transcript),
      Uint8Array.from(data.warm.transcript)) === 0);
  /* Phase 6.4.  The greeting is drawn from the seed and not from the engine, so
     a warm visit has to open with the same line a cold one did -- which is the
     half of "the same conversation" the transcript above does not cover. */
  eq("and IQ Pokyd greeted both of them the same way",
    data.warm.greeting.text, data.cold.greeting.text);
  ok("the second visit was " + (data.cold.loadMs / data.warm.loadMs).toFixed(0)
    + " times faster to start", data.warm.loadMs * 4 < data.cold.loadMs,
    "cold " + data.cold.loadMs + " ms, warm " + data.warm.loadMs + " ms");

  console.log(failures === 0
    ? "\nPASS -- " + checks + " checks.  IQ Pokyd holds the phase 1.6"
      + " conversation in a browser, byte for byte, on a first visit and on a"
      + " second."
    : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
  return failures === 0 ? 0 : 1;
}

process.exit(await main());
