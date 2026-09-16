/* IQ Pokyd - tools/extract-rc.mjs - phase 6.1 of PLAN.md: read IQPokyd.rc.

   `original/IQ Pokyd/!Prostre/IQPokyd.rc` is the author's own specification of
   six dialogs, a menu, an accelerator table, a version block and the eighteen
   image files the program loads -- down to the pixel, in dialog units, with
   every string he wrote.  This turns it into src/app/resources.ts so that
   phases 6, 7 and 8 read the spec rather than a screenshot of it.

   Run it:   node tools/extract-rc.mjs            # rewrite src/app/resources.ts
             node tools/extract-rc.mjs --check    # say whether it is up to date
             node tools/extract-rc.mjs --dump     # print what was parsed, readably

   The generated file is committed, unlike everything under build/, for three
   reasons: it is what `npm run typecheck` and the browser actually consume, it
   makes a change to the parse show up as a diff, and .github/workflows/deploy.yml
   does not have to know this program exists.  test/app/resources.test.ts re-runs
   the parse in memory and fails if the committed file has drifted from it, so
   "generated and committed" cannot quietly become "hand-edited".

   It is .mjs among a directory of .py because of what it reads with: the .rc is
   CP1250 and src/web/cp1250.ts is the only place in this project that turns a
   byte into a character.  Python has its own cp1250 and it agrees, but a second
   codec in the pipeline is exactly the thing phase 4.1 was written to prevent.

   Written by us, not ported.  English identifiers, and the output is ASCII with
   \uXXXX escapes like the rest of the non-engine code.
*/

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { decodeCp1250 } from "../src/web/cp1250.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RC_PATH = join(ROOT, "original", "IQ Pokyd", "!Prostre", "IQPokyd.rc");
const HEADER_PATH = join(ROOT, "original", "IQ Pokyd", "!Prostre", "resource.h");
const OUT_PATH = join(ROOT, "src", "app", "resources.ts");

/* Where the .rc says the image files are, relative to !Prostre/.  Carried into
   the generated module so phase 6.2 has one place to look. */
export const RES_DIR = "original/IQ Pokyd/!Prostre";

/* --------------------------------------------------------------- lexical bits */

/** Statements that open a resource body or sit inside one.  Used to tell a new
 *  statement from the continuation of the previous one, which is the only thing
 *  standing between this parser and the .rc's habit of wrapping a control across
 *  three lines wherever Developer Studio felt like it. */
const STATEMENT_KEYWORDS = new Set([
  "BEGIN", "END",
  "LTEXT", "RTEXT", "CTEXT", "EDITTEXT", "PUSHBUTTON", "DEFPUSHBUTTON",
  "GROUPBOX", "CONTROL", "LISTBOX", "COMBOBOX", "SCROLLBAR", "ICON",
  "CHECKBOX", "RADIOBUTTON", "STATE3", "AUTO3STATE", "AUTOCHECKBOX",
  "AUTORADIOBUTTON",
  "MENUITEM", "POPUP",
  "BLOCK", "VALUE",
]);

/** The statements that carry a leading text field, and the window class and
 *  styles the resource compiler supplies for each.  Not decoration: LTEXT and
 *  CTEXT differ by nothing else, and phase 6.3 has to know which is which.
 *  WS_CHILD | WS_VISIBLE is on all of them and is left implicit here. */
const CONTROL_KINDS = {
  LTEXT:         { class: "Static", styles: ["SS_LEFT", "WS_GROUP"], text: true },
  CTEXT:         { class: "Static", styles: ["SS_CENTER", "WS_GROUP"], text: true },
  RTEXT:         { class: "Static", styles: ["SS_RIGHT", "WS_GROUP"], text: true },
  ICON:          { class: "Static", styles: ["SS_ICON"], text: true },
  GROUPBOX:      { class: "Button", styles: ["BS_GROUPBOX"], text: true },
  PUSHBUTTON:    { class: "Button", styles: ["BS_PUSHBUTTON", "WS_TABSTOP"], text: true },
  DEFPUSHBUTTON: { class: "Button", styles: ["BS_DEFPUSHBUTTON", "WS_TABSTOP"], text: true },
  CHECKBOX:      { class: "Button", styles: ["BS_CHECKBOX", "WS_TABSTOP"], text: true },
  RADIOBUTTON:   { class: "Button", styles: ["BS_RADIOBUTTON", "WS_TABSTOP"], text: true },
  EDITTEXT:      { class: "Edit", styles: ["ES_LEFT", "WS_BORDER", "WS_TABSTOP"], text: false },
  LISTBOX:       { class: "ListBox", styles: ["LBS_NOTIFY", "WS_BORDER"], text: false },
  COMBOBOX:      { class: "ComboBox", styles: ["CBS_SIMPLE", "WS_TABSTOP"], text: false },
  SCROLLBAR:     { class: "ScrollBar", styles: ["SBS_HORZ"], text: false },
  /* CONTROL names its own window class and states every style itself, which is
     why it is the only one here with nothing to supply. */
  CONTROL:       { class: null, styles: [], text: true },
};

/** Control ids that are not in resource.h because they come from afxres.h.
 *  Every other id a control names has to resolve, and the test insists on it. */
const AFX_SYMBOLS = { IDC_STATIC: -1, IDOK: 1, IDCANCEL: 2 };

/** Strip `//` comments without eating the one inside "http://...". */
function stripComments(text) {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === "\\" && i + 1 < text.length) { out += text[++i]; continue; }
      if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") { inString = true; out += ch; continue; }
    if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    out += ch;
  }
  return out;
}

/** Drop the blocks Developer Studio writes for itself -- TEXTINCLUDE, the
 *  GUIDELINES DESIGNINFO margins, and the copy of the English resource script it
 *  keeps under `#ifndef APSTUDIO_INVOKED`.  None of it is a resource, and the
 *  DESIGNINFO block in particular looks enough like one to confuse a parser.
 *  Nesting-aware, because #ifdef _WIN32 lives inside the first of them. */
function stripEditorBlocks(text) {
  const lines = text.split("\n");
  const kept = [];
  let dropping = 0;
  let depth = 0;
  for (const line of lines) {
    const t = line.trim();
    const opens = /^#\s*(if|ifdef|ifndef)\b/.test(t);
    const closes = /^#\s*endif\b/.test(t);
    if (dropping > 0) {
      if (opens) depth++;
      else if (closes) { depth--; if (depth === 0) dropping = 0; }
      continue;
    }
    if (/^#\s*if(n)?def\s+APSTUDIO_INVOKED\b/.test(t)) { dropping = 1; depth = 1; continue; }
    kept.push(line);
  }
  return kept.join("\n");
}

/** Turn an .rc string literal's body into the characters it stands for.  `""`
 *  is the doubled quote, and Developer Studio also emits C escapes -- this file
 *  uses \r\n, \n and \\ -- so both conventions have to be understood. */
function unescapeRcString(body) {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\"" && body[i + 1] === "\"") { out += "\""; i++; continue; }
    if (ch !== "\\") { out += ch; continue; }
    const next = body[++i];
    switch (next) {
      case "n": out += "\n"; break;
      case "r": out += "\r"; break;
      case "t": out += "\t"; break;
      case "a": out += "\x07"; break;
      case "\\": out += "\\"; break;
      case "\"": out += "\""; break;
      case "x": {
        let hex = "";
        while (hex.length < 4 && /[0-9a-fA-F]/.test(body[i + 1] ?? "")) hex += body[++i];
        out += String.fromCharCode(parseInt(hex, 16));
        break;
      }
      default:
        if (/[0-7]/.test(next)) {
          let oct = next;
          while (oct.length < 3 && /[0-7]/.test(body[i + 1] ?? "")) oct += body[++i];
          out += String.fromCharCode(parseInt(oct, 8));
        } else {
          out += next;
        }
    }
  }
  return out;
}

/** Split a statement's argument list on top-level commas, leaving quoted strings
 *  alone.  Fields come back trimmed, with strings still quoted so the caller can
 *  tell `"139"` from `139` -- the difference between a caption and a bitmap. */
function splitFields(text) {
  const fields = [];
  let current = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      current += ch;
      if (ch === "\"") {
        if (text[i + 1] === "\"") { current += text[++i]; continue; }
        inString = false;
      }
      continue;
    }
    if (ch === "\"") { inString = true; current += ch; continue; }
    if (ch === ",") { fields.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

function isQuoted(field) {
  return field.length >= 2 && field.startsWith("\"") && field.endsWith("\"");
}

function stringValue(field) {
  return unescapeRcString(field.slice(1, -1));
}

/** `PBS_SMOOTH | NOT WS_VISIBLE` -> what is on and what the template turns off.
 *  The second list is the interesting one: five controls in IDD_NASTAVENI and
 *  both effect progress bars in the main window ship invisible. */
function parseStyle(expr) {
  const set = [];
  const cleared = [];
  for (const raw of expr.split("|")) {
    const part = raw.trim();
    if (part === "") continue;
    const not = /^NOT\s+(.+)$/.exec(part);
    if (not) cleared.push(not[1].trim());
    else set.push(part);
  }
  return { set, cleared };
}

/* ------------------------------------------------------------- resource.h */

/** name -> number, plus the numbers more than one name shares.  The duplicates
 *  are not a mistake of the author's and they matter: IDC_EFEKTPROGRES1 and
 *  IDC_UPLNATOLERANCEPRAVOPISU are both 1062, in different dialogs, so a number
 *  does not identify a control and only the symbolic name ever will. */
export function parseSymbols(text) {
  const byName = new Map();
  const names = new Map();
  const re = /^#define\s+(\w+)\s+(0x[0-9a-fA-F]+|\d+)\s*$/;
  for (const line of text.split("\n")) {
    const m = re.exec(line.trim());
    if (!m) continue;
    const value = m[2].startsWith("0x") ? parseInt(m[2], 16) : parseInt(m[2], 10);
    byName.set(m[1], value);
    if (!names.has(value)) names.set(value, []);
    names.get(value).push(m[1]);
  }
  const shared = [];
  for (const [value, list] of names) {
    if (list.length > 1) shared.push({ value, names: list });
  }
  shared.sort((a, b) => a.value - b.value);
  return { byName, byValue: names, shared };
}

/* ------------------------------------------------------------------ the .rc */

/** Join the lines of one BEGIN..END body into whole statements.  A line starts a
 *  new statement when it begins with a keyword and the statement so far has no
 *  string open; everything else is continuation. */
function statementsOf(lines) {
  const statements = [];
  let current = null;
  const quotesBalanced = (s) => {
    let inString = false;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "\"") {
        if (inString && s[i + 1] === "\"") { i++; continue; }
        inString = !inString;
      }
    }
    return !inString;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") continue;
    const first = /^(\w+)/.exec(line);
    const startsStatement = first !== null && STATEMENT_KEYWORDS.has(first[1]);
    if (current !== null && startsStatement && quotesBalanced(current)) {
      statements.push(current);
      current = line;
    } else if (current === null) {
      current = line;
    } else {
      current += " " + line;
    }
  }
  if (current !== null) statements.push(current);
  return statements;
}

/** Everything between the BEGIN at `start` and its matching END, as raw lines,
 *  plus the index of the line after the END. */
function blockAt(lines, start) {
  let i = start;
  while (i < lines.length && lines[i].trim() !== "BEGIN") i++;
  if (i >= lines.length) throw new Error("no BEGIN after line " + start);
  let depth = 1;
  const body = [];
  i++;
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "BEGIN") depth++;
    else if (t === "END") { depth--; if (depth === 0) return { body, next: i + 1 }; }
    body.push(lines[i]);
  }
  throw new Error("unterminated BEGIN at line " + start);
}

function parseControl(statement, symbols) {
  const m = /^(\w+)\s*([\s\S]*)$/.exec(statement);
  const kind = m[1];
  const spec = CONTROL_KINDS[kind];
  if (spec === undefined) return null;
  const fields = splitFields(m[2]);

  let text = null;
  let textResource = null;
  let cursor = 0;
  if (spec.text) {
    const field = fields[cursor++];
    if (isQuoted(field)) text = stringValue(field);
    else textResource = field;
  }

  const id = fields[cursor++];
  let className = spec.class;
  let style = { set: [], cleared: [] };
  let rect;

  if (kind === "CONTROL") {
    /* CONTROL "text", id, "class", style, x, y, cx, cy [, exstyle] */
    className = isQuoted(fields[cursor]) ? stringValue(fields[cursor]) : fields[cursor];
    cursor++;
    style = parseStyle(fields[cursor++]);
    rect = fields.slice(cursor, cursor + 4).map(Number);
    cursor += 4;
  } else {
    rect = fields.slice(cursor, cursor + 4).map(Number);
    cursor += 4;
    if (cursor < fields.length) style = parseStyle(fields.slice(cursor).join(","));
  }

  const numericId = symbols.byName.get(id) ?? AFX_SYMBOLS[id] ?? null;
  const resolvedText = textResource !== null && /^\d+$/.test(textResource)
    ? (symbols.byValue.get(Number(textResource))?.length === 1
        ? symbols.byValue.get(Number(textResource))[0] : null)
    : null;

  return {
    kind,
    text,
    /* A CONTROL whose "text" is a number names another resource rather than
       saying anything -- the KYBLSoft logo in the about box is CONTROL 139. */
    textResource: textResource === null ? null
      : { raw: textResource, symbol: resolvedText },
    id,
    numericId,
    class: className,
    rect: { x: rect[0], y: rect[1], cx: rect[2], cy: rect[3] },
    styles: style.set,
    notStyles: style.cleared,
    implicitStyles: kind === "CONTROL" ? [] : spec.styles,
    visible: !style.cleared.includes("WS_VISIBLE"),
  };
}

function parseMenuBody(body, symbols) {
  const items = [];
  const lines = body.map((l) => l.trim()).filter((l) => l !== "");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("POPUP")) {
      const rest = line.slice("POPUP".length).trim();
      const fields = splitFields(rest);
      const inner = blockAt(lines, i);
      items.push({
        kind: "popup",
        ...menuLabel(stringValue(fields[0])),
        id: null,
        numericId: null,
        flags: fields.slice(1),
        items: parseMenuBody(inner.body, symbols),
      });
      i = inner.next;
      continue;
    }
    if (line.startsWith("MENUITEM")) {
      const rest = line.slice("MENUITEM".length).trim();
      if (rest === "SEPARATOR") {
        items.push({ kind: "separator", raw: "", label: "", mnemonic: null,
          accelerator: null, id: null, numericId: null, flags: [], items: [] });
        i++;
        continue;
      }
      const fields = splitFields(rest);
      const id = fields[1];
      items.push({
        kind: "item",
        ...menuLabel(stringValue(fields[0])),
        id,
        numericId: symbols.byName.get(id) ?? AFX_SYMBOLS[id] ?? null,
        flags: fields.slice(2),
        items: [],
      });
      i++;
      continue;
    }
    i++;
  }
  return items;
}

/** "&Nastaven\u00ed...\tF4" -> the word on the screen, the Alt key that reaches
 *  it, and the shortcut printed beside it. */
function menuLabel(raw) {
  const tab = raw.indexOf("\t");
  const head = tab === -1 ? raw : raw.slice(0, tab);
  const accelerator = tab === -1 ? null : raw.slice(tab + 1);
  let label = "";
  let mnemonic = null;
  for (let i = 0; i < head.length; i++) {
    if (head[i] === "&") {
      if (head[i + 1] === "&") { label += "&"; i++; continue; }
      if (mnemonic === null && head[i + 1] !== undefined) mnemonic = head[i + 1];
      continue;
    }
    label += head[i];
  }
  return { raw, label, mnemonic, accelerator };
}

function parseAcceleratorBody(body, symbols) {
  /* An accelerator entry starts with a quoted character or a VK_ name, neither
     of which is a keyword, so statementsOf() cannot tell them apart.  They are
     one to a line -- except the first, whose flag list wraps -- so a trailing
     comma is the whole of the continuation rule here. */
  const statements = [];
  let current = "";
  for (const raw of body) {
    const line = raw.trim();
    if (line === "") continue;
    current += (current === "" ? "" : " ") + line;
    if (/,$/.test(current)) continue;
    statements.push(current);
    current = "";
  }
  if (current !== "") statements.push(current);

  return statements.map((statement) => {
    const fields = splitFields(statement);
    const key = fields[0];
    const id = fields[1];
    return {
      key: isQuoted(key) ? stringValue(key) : key,
      virtualKey: !isQuoted(key),
      id,
      numericId: symbols.byName.get(id) ?? AFX_SYMBOLS[id] ?? null,
      flags: fields.slice(2).filter((f) => f !== ""),
    };
  });
}

function parseVersionBody(body) {
  const fixed = {};
  const strings = {};
  const translation = [];
  let block = null;
  for (const raw of body) {
    const line = raw.trim();
    if (line === "" || line === "BEGIN" || line === "END") continue;
    let m = /^BLOCK\s+"([^"]*)"$/.exec(line);
    if (m) { block = m[1]; continue; }
    m = /^VALUE\s+([\s\S]*)$/.exec(line);
    if (m) {
      const fields = splitFields(m[1]);
      const name = stringValue(fields[0]);
      if (name === "Translation") {
        for (const f of fields.slice(1)) translation.push(f.trim());
      } else {
        strings[name] = stringValue(fields[1]).replace(/\0+$/, "");
      }
      continue;
    }
    m = /^(\w+)\s+([\s\S]*)$/.exec(line);
    if (m) fixed[m[1]] = m[2].trim();
  }
  return { fixed, strings, translation, block };
}

/** The whole script.  Line-oriented: every resource this file defines begins at
 *  the left margin with `NAME TYPE`, which is what makes that safe. */
export function parseRc(text, symbols) {
  const lines = stripEditorBlocks(stripComments(text)).split(/\r?\n/);

  const dialogs = {};
  const menus = {};
  const accelerators = {};
  const bitmaps = [];
  const icons = [];
  let version = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;

    /* NAME ICON|BITMAP [DISCARDABLE] "file" -- one line, no body. */
    let m = /^(\w+)\s+(ICON|BITMAP)\s+(?:DISCARDABLE\s+)?"([^"]*)"\s*$/.exec(line);
    if (m) {
      const entry = {
        id: m[1],
        numericId: symbols.byName.get(m[1]) ?? null,
        file: unescapeRcString(m[3]).replace(/\\/g, "/"),
      };
      (m[2] === "ICON" ? icons : bitmaps).push(entry);
      continue;
    }

    if (/^VS_VERSION_INFO\s+VERSIONINFO\s*$/.test(line)) {
      /* The fixed fields sit between the statement and the BEGIN. */
      const header = [];
      let j = i + 1;
      for (; j < lines.length && lines[j].trim() !== "BEGIN"; j++) header.push(lines[j]);
      const block = blockAt(lines, i + 1);
      version = parseVersionBody([...header, ...block.body]);
      i = block.next - 1;
      continue;
    }

    m = /^(\w+)\s+MENU\s*(?:DISCARDABLE)?\s*$/.exec(line);
    if (m) {
      const block = blockAt(lines, i + 1);
      menus[m[1]] = {
        id: m[1],
        numericId: symbols.byName.get(m[1]) ?? null,
        items: parseMenuBody(block.body, symbols),
      };
      i = block.next - 1;
      continue;
    }

    m = /^(\w+)\s+ACCELERATORS\s*(?:DISCARDABLE)?\s*$/.exec(line);
    if (m) {
      const block = blockAt(lines, i + 1);
      accelerators[m[1]] = {
        id: m[1],
        numericId: symbols.byName.get(m[1]) ?? null,
        entries: parseAcceleratorBody(block.body, symbols),
      };
      i = block.next - 1;
      continue;
    }

    m = /^(\w+)\s+(DIALOGEX|DIALOG)\s+(?:DISCARDABLE\s+)?(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/
      .exec(line);
    if (m) {
      const dialog = {
        id: m[1],
        numericId: symbols.byName.get(m[1]) ?? null,
        extended: m[2] === "DIALOGEX",
        rect: { x: Number(m[3]), y: Number(m[4]), cx: Number(m[5]), cy: Number(m[6]) },
        styles: [],
        notStyles: [],
        exStyles: [],
        caption: null,
        font: null,
        menu: null,
        controls: [],
      };

      /* Header statements up to the BEGIN.  STYLE wraps across lines with a
         trailing `|`, which is the only continuation that happens up here. */
      let j = i + 1;
      let pending = "";
      for (; j < lines.length && lines[j].trim() !== "BEGIN"; j++) {
        pending += (pending === "" ? "" : " ") + lines[j].trim();
        if (/[|,]$/.test(pending)) continue;
        const statement = pending;
        pending = "";
        let s = /^STYLE\s+([\s\S]*)$/.exec(statement);
        if (s) { const p = parseStyle(s[1]); dialog.styles = p.set; dialog.notStyles = p.cleared; continue; }
        s = /^EXSTYLE\s+([\s\S]*)$/.exec(statement);
        if (s) { dialog.exStyles = parseStyle(s[1]).set; continue; }
        s = /^CAPTION\s+"([\s\S]*)"\s*$/.exec(statement);
        if (s) { dialog.caption = unescapeRcString(s[1]); continue; }
        s = /^FONT\s+([\s\S]*)$/.exec(statement);
        if (s) {
          const fields = splitFields(s[1]);
          dialog.font = { size: Number(fields[0]), face: stringValue(fields[1]) };
          continue;
        }
        s = /^MENU\s+(\w+)\s*$/.exec(statement);
        if (s) { dialog.menu = s[1]; continue; }
      }

      const block = blockAt(lines, i + 1);
      for (const statement of statementsOf(block.body)) {
        const control = parseControl(statement, symbols);
        if (control !== null) dialog.controls.push(control);
      }
      dialogs[dialog.id] = dialog;
      i = block.next - 1;
      continue;
    }
  }

  return { dialogs, menus, accelerators, bitmaps, icons, version, symbols };
}

export function readRc() {
  const rc = decodeCp1250(readFileSync(RC_PATH));
  const header = decodeCp1250(readFileSync(HEADER_PATH));
  return parseRc(rc, parseSymbols(header));
}

/* ------------------------------------------------------------- the module */

/** A TypeScript string literal with every non-ASCII character escaped, because
 *  everything we write is ASCII and an escape says which code point is meant
 *  rather than what some editor's encoding thinks it is. */
function tsString(s) {
  let out = "\"";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = s.charCodeAt(i);
    if (ch === "\"") out += "\\\"";
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code < 0x20 || code > 0x7e) out += "\\u" + code.toString(16).padStart(4, "0");
    else out += ch;
  }
  return out + "\"";
}

/** The few CP1250 characters that survive having their diacritics taken off
 *  because they never had any.  Only the copyright sign is actually in the .rc,
 *  in the about box's byline. */
const PLAIN_SUBSTITUTES = {
  "\u00a9": "(c)", "\u00ae": "(R)", "\u00b0": " deg", "\u00a7": "S",
  "\u00d7": "x", "\u00f7": "/", "\u00ab": "<<", "\u00bb": ">>",
  "\u201e": "\"", "\u201c": "\"", "\u201a": "'", "\u2018": "'",
  "\u2013": "-", "\u2014": "--", "\u2026": "...",
};

/** The same text with its diacritics taken off, for the comment beside the
 *  escapes -- which is what src/app/chat.ts already does by hand. */
function plain(s) {
  return s.replace(/[^\x00-\x7f]/g, (ch) => PLAIN_SUBSTITUTES[ch] ?? ch)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t")
    .replace(/[^\x20-\x7e]/g, "?");
}

/** A readable comment for a string, or "" when the string is already ASCII and
 *  would only be repeating itself.  A star-slash inside the text would end the
 *  comment early, so it is broken up. */
function gloss(s) {
  if (s === null || s === "") return "";
  const bare = plain(s);
  if (bare === s) return "";
  return "  /* " + bare.replace(/\*\//g, "* /") + " */";
}

function jsonish(value, indent) {
  const pad = " ".repeat(indent);
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return tsString(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((v) => typeof v === "string")) {
      const inline = "[" + value.map(tsString).join(", ") + "]";
      if (inline.length + indent <= 92) return inline;
    }
    return "[\n" + value.map((v) => pad + "  " + jsonish(v, indent + 2)).join(",\n")
      + "\n" + pad + "]";
  }
  const keys = Object.keys(value);
  if (keys.length === 0) return "{}";
  const inline = "{ " + keys.map((k) => k + ": " + jsonish(value[k], 0)).join(", ") + " }";
  if (!inline.includes("\n") && inline.length + indent <= 92) return inline;
  return "{\n" + keys.map((k) => {
    const rendered = jsonish(value[k], indent + 2);
    const comment = typeof value[k] === "string" ? gloss(value[k]) : "";
    return pad + "  " + k + ": " + rendered + "," + comment;
  }).join("\n") + "\n" + pad + "}";
}

const PREAMBLE = `/* IQ Pokyd - src/app/resources.ts - phase 6.1 of PLAN.md.

   GENERATED.  Do not edit: run \`node tools/extract-rc.mjs\` instead, and
   \`node test/app/resources.test.ts\` will tell you if this file has drifted
   from the script it came out of.

   What it is: \`original/IQ Pokyd/!Prostre/IQPokyd.rc\`, the author's own
   resource script, parsed.  Six dialogs, the menu, the accelerator table, the
   version block and the eighteen image files the program loads -- his strings,
   his control ids, his geometry, in the dialog units he wrote them in.  Phase
   6.3 rebuilds the main window from it, 7.1 the settings dialog, 8.2 and 8.3
   the help and about screens.

   Three things it is NOT, all of which cost a session to learn and none of
   which the .rc says out loud:

     1. **The main window's layout is not in here.**  IDD_HLAVNI_OKNO has eight
        controls and none of them is the conversation.  The transcript is a
        hundred STATIC windows created at runtime by
        PREFORMATUJ_TEXTY_CLOVEKA_A_POCITACE_NA_OBRAZOVCE (PROSTRED.FU:904),
        laid out in pixels against OKRAJE (15) and ROZESTUP (10), bottom-anchored
        and growing upwards.  What the eight controls in here do on a resize is
        PREKRESLI_PRVKY_V_OKNE_PRI_ZMENE_VELIKOSTI (PROSTRED.FU:1022), which
        overrides their template positions the first time the window is sized.
        So this file gives the inventory and the initial size; PROSTRED.FU gives
        the layout.
     2. **The colours are not in here either.**  They are six COLORREFs at
        PROSTRED.PR:12-17 and they are 0x00BBGGRR, not #RRGGBB.  They are
        reproduced as PALETTE below, converted, because nothing else would.
     3. **Dialog units are not pixels.**  A dialog unit is a quarter of the
        average character width of the dialog's own font horizontally and an
        eighth of its height vertically, so IDD_HLAVNI_OKNO's 324x181 is in
        Trebuchet MS 12 and IDD_NACITANI's 214x55 is in System 12.  dluToPx()
        does the conversion and takes the base units as an argument, because the
        .rc does not contain them and this file will not pretend otherwise.

   Written by us, not ported.  ASCII only, so every Czech letter is a \\uXXXX
   escape with the author's own spelling, diacritics stripped, in the comment
   beside it.
*/
`;

const TYPES = `
/** A rectangle in dialog units, in the .rc's own order and names. */
export interface RcRect {
  x: number;
  y: number;
  cx: number;
  cy: number;
}

/** What a control's "text" field said when it named another resource instead of
 *  saying something -- CONTROL 139 in the about box is the KYBLSoft logo. */
export interface RcTextResource {
  raw: string;
  /** The resource.h name, when exactly one name has that number. */
  symbol: string | null;
}

export interface RcControl {
  /** The statement keyword: LTEXT, DEFPUSHBUTTON, CONTROL, ... */
  kind: string;
  text: string | null;
  textResource: RcTextResource | null;
  /** The symbolic id.  Numbers are shared between dialogs -- see SHARED_IDS --
   *  so this, and never numericId, is what identifies a control. */
  id: string;
  numericId: number | null;
  /** The window class, either written out by a CONTROL statement or the one the
   *  resource compiler supplies for the keyword. */
  class: string;
  rect: RcRect;
  styles: string[];
  /** Styles the template explicitly turns off, as \`NOT WS_VISIBLE\`. */
  notStyles: string[];
  /** What the keyword adds on top of styles, WS_CHILD | WS_VISIBLE aside.
   *  Empty for CONTROL, which states everything itself. */
  implicitStyles: string[];
  visible: boolean;
}

export interface RcFont {
  size: number;
  face: string;
}

export interface RcDialog {
  id: string;
  numericId: number | null;
  /** DIALOGEX rather than DIALOG.  Only IDD_HLAVNI_OKNO is. */
  extended: boolean;
  rect: RcRect;
  styles: string[];
  notStyles: string[];
  exStyles: string[];
  caption: string | null;
  font: RcFont | null;
  /** The menu resource attached to the dialog, if any. */
  menu: string | null;
  controls: RcControl[];
}

export interface RcMenuItem {
  kind: "popup" | "item" | "separator";
  /** The text as written, mnemonic ampersand and tab included. */
  raw: string;
  /** The text as it appears on the screen: no ampersand, no shortcut. */
  label: string;
  /** The letter after the ampersand, which Alt reaches the item by. */
  mnemonic: string | null;
  /** What is printed on the right of the item, after the tab. */
  accelerator: string | null;
  id: string | null;
  numericId: number | null;
  /** Trailing flags: HELP on the one right-aligned item. */
  flags: string[];
  items: RcMenuItem[];
}

export interface RcMenu {
  id: string;
  numericId: number | null;
  items: RcMenuItem[];
}

export interface RcAccelerator {
  /** A character for an ASCII accelerator, or a VK_ name. */
  key: string;
  virtualKey: boolean;
  id: string;
  numericId: number | null;
  /** VIRTKEY, SHIFT, CONTROL, ALT, NOINVERT. */
  flags: string[];
}

export interface RcAccelerators {
  id: string;
  numericId: number | null;
  entries: RcAccelerator[];
}

export interface RcImage {
  id: string;
  numericId: number | null;
  /** Relative to RES_DIR, forward-slashed. */
  file: string;
}

export interface RcVersion {
  /** FILEVERSION, PRODUCTVERSION, FILEOS and the rest, as written. */
  fixed: Record<string, string>;
  /** The 040504b0 string block: CompanyName, FileDescription, ... */
  strings: Record<string, string>;
  /** The VarFileInfo translation pair: language 0x405 (Czech), codepage 1200. */
  translation: string[];
}

/** A numeric id more than one symbol shares. */
export interface RcSharedId {
  value: number;
  names: string[];
}
`;

const TAIL = `
/* ----------------------------------------------------------- dialog units */

/** The horizontal and vertical dialog base units of a dialog's font, in pixels.
 *  MFC takes them from the font's TEXTMETRIC: x is tmAveCharWidth, y is
 *  tmHeight.  They are a property of the font on the machine that draws the
 *  dialog and are not in the resource script, which is why nothing here makes
 *  one up. */
export interface DialogBaseUnits {
  x: number;
  y: number;
}

/** A dialog unit is a quarter of a base unit horizontally, an eighth of one
 *  vertically -- MapDialogRect, and the reason IDD_HLAVNI_OKNO's 324 units of
 *  width are not 324 pixels.  Done the way MapDialogRect does it, with MulDiv:
 *  multiply first, then divide, rounding to nearest. */
export function dluToPx(rect: RcRect, base: DialogBaseUnits): {
  x: number; y: number; width: number; height: number;
} {
  return {
    x: Math.round((rect.x * base.x) / 4),
    y: Math.round((rect.y * base.y) / 8),
    width: Math.round((rect.cx * base.x) / 4),
    height: Math.round((rect.cy * base.y) / 8),
  };
}

/* ------------------------------------------------------------- the palette */

/** The six colours the main window is drawn in, PROSTRED.PR:12-17.
 *
 *  They are COLORREFs in the source, which is 0x00BBGGRR -- byte-reversed from
 *  the #RRGGBB anyone reading them as hex would assume.  g_barvatextucloveka is
 *  written 0x0057FFFF and is yellow, not sky blue.  Converted here once so that
 *  nothing downstream has to remember, with the author's own constant name and
 *  literal beside each one. */
export const PALETTE = {
  /** g_barvapozadizadavanivety = 0x00110009 -- behind the sentence you type. */
  inputBackground: "#090011",
  /** g_barvatextuhlavnihookna = 0x00E0E0E0 -- anything not otherwise coloured. */
  windowText: "#e0e0e0",
  /** g_barvatextucloveka = 0x0057FFFF -- what you said. */
  humanText: "#ffff57",
  /** g_barvatextupocitace = 0x0057FF57 -- what IQ Pokyd answered. */
  pokydText: "#57ff57",
  /** g_barvahlavickovychtextu = 0x00FFFF90 -- IDC_NADPIS1 and IDC_NADPIS3. */
  headingText: "#90ffff",
  /** g_barvanapisuIQPokyd = 0x00FFFFFF -- IDC_NADPIS2, the title in the middle. */
  titleText: "#ffffff",
  /** CreateSolidBrush(0x000000), PROSTRED.FU:339 -- the window with no bitmap. */
  windowBackground: "#000000",
} as const;

/* ------------------------------------------------- what PROSTRED.FU adds */

/** The main window's runtime layout, which is in PROSTRED.FU and not in the
 *  resource script.  Pixels, not dialog units: the author wrote them against
 *  the client rectangle directly.
 *
 *  The transcript occupies the box below and is the whole of the conversation:
 *  a hundred STATIC children, created once, laid out from the bottom upwards
 *  with ROZESTUP between them, each one word-wrapped to the box's width and as
 *  tall as its line count.  Anything that does not fit above \`top\` is not
 *  drawn (PROSTRED.FU:962), so the window's height is how much history there
 *  is -- there is no scrollbar, and there never was. */
export const WINDOW_LAYOUT = {
  /** OKRAJE, PROSTRED.FU:901. */
  margin: 15,
  /** ROZESTUP, PROSTRED.FU:902 -- between one sentence and the next. */
  spacing: 10,
  /** The transcript box, as insets from the client rectangle
   *  (PROSTRED.FU:923-924): left and right are OKRAJE+10, the top is OKRAJE+20
   *  and the bottom is OKRAJE+45, which is where the input line begins. */
  transcript: { left: 25, right: 25, top: 35, bottom: 60 },
  /** The font those hundred statics are created with, PROSTRED.FU:917-919.
   *  lfHeight is positive here, so it is a cell height and not a point size. */
  transcriptFont: { face: "Trebuchet MS", lfHeight: 20 },
  /** IDC_NADPIS1 and IDC_NADPIS3, mfcDlg.cpp:370-376. */
  headingFont: { face: "Trebuchet MS", lfHeight: -18, weight: 500 },
  /** IDC_NADPIS2, the one in the middle, mfcDlg.cpp:378-383.  Garamond, and
   *  not the Trebuchet MS the template asks for. */
  titleFont: { face: "Garamond", lfHeight: -22, weight: 800 },
  /** OnGetMinMaxInfo, mfcDlg.cpp:990-991 -- the window would not go smaller. */
  minimumSize: { width: 400, height: 220 },
  /** How many sentences the window remembers, g_poslednich100vet. */
  transcriptCapacity: 100,
} as const;
`;

export function renderModule(parsed) {
  const parts = [PREAMBLE, TYPES];

  parts.push("\n/** Where the image files below are, relative to the repository root. */\n"
    + "export const RES_DIR = " + tsString(RES_DIR) + ";\n");

  const dialogLines = [];
  for (const id of Object.keys(parsed.dialogs)) {
    const dialog = parsed.dialogs[id];
    const head = dialog.caption === null ? ""
      : "  /* " + plain(dialog.caption).replace(/\*\//g, "* /") + " */";
    dialogLines.push("  " + id + ":" + head + " " + jsonish(dialog, 2) + ",");
  }
  parts.push("\n/** The six dialog templates, by symbolic id, in the order the script\n"
    + " *  defines them. */\nexport const DIALOGS: Record<string, RcDialog> = {\n"
    + dialogLines.join("\n") + "\n};\n");

  parts.push("\n/** IDR_MENU, the menu bar of the main window.  The last item is a\n"
    + " *  top-level MENUITEM with the HELP flag, which is what right-aligns it --\n"
    + " *  and it opens the settings dialog, the same as Nastaveni does. */\n"
    + "export const MENUS: Record<string, RcMenu> = "
    + jsonish(parsed.menus, 0) + ";\n");

  parts.push("\n/** IDR_ZKRATKY.  Two of these are the only way to reach a command that\n"
    + " *  is in no menu: Ctrl+F7 and Ctrl+F8 move the character, F7 and F8 the\n"
    + " *  mood -- phase 7.4. */\nexport const ACCELERATORS: Record<string, RcAccelerators> = "
    + jsonish(parsed.accelerators, 0) + ";\n");

  parts.push("\n/** The bitmaps, in script order.  Phase 6.2 transcodes them. */\n"
    + "export const BITMAPS: RcImage[] = " + jsonish(parsed.bitmaps, 0) + ";\n");

  parts.push("\n/** The icons.  IDR_MAINFRAME is the one Windows shows in the task bar;\n"
    + " *  IDI_TVAR is also drawn on the Rekni button (mfcDlg.cpp:421). */\n"
    + "export const ICONS: RcImage[] = " + jsonish(parsed.icons, 0) + ";\n");

  parts.push("\n/** VS_VERSION_INFO.  Phase 8.3 reproduces it. */\n"
    + "export const VERSION: RcVersion = " + jsonish({
      fixed: parsed.version.fixed,
      strings: parsed.version.strings,
      translation: parsed.version.translation,
    }, 0) + ";\n");

  parts.push("\n/** Numeric ids that more than one symbol shares, which is why nothing in\n"
    + " *  this file is keyed by number.  Developer Studio handed out ids per\n"
    + " *  dialog and let them collide across dialogs; IDC_EFEKTPROGRES1 in the\n"
    + " *  main window and IDC_UPLNATOLERANCEPRAVOPISU in the debug dialog are both\n"
    + " *  1062. */\nexport const SHARED_IDS: RcSharedId[] = "
    + jsonish(parsed.symbols.shared, 0) + ";\n");

  parts.push(TAIL);
  return parts.join("\n").replace(/\r?\n/g, "\r\n");
}

/* ------------------------------------------------------------------- main */

function dump(parsed) {
  for (const id of Object.keys(parsed.dialogs)) {
    const d = parsed.dialogs[id];
    console.log("\n" + id + "  " + (d.extended ? "DIALOGEX" : "DIALOG")
      + "  " + d.rect.cx + "x" + d.rect.cy + " dlu"
      + (d.font ? "  FONT " + d.font.size + " " + d.font.face : "")
      + (d.caption === null ? "" : "\n  caption: " + d.caption));
    for (const c of d.controls) {
      console.log("    " + c.kind.padEnd(14) + c.id.padEnd(34)
        + (c.rect.x + "," + c.rect.y + " " + c.rect.cx + "x" + c.rect.cy).padEnd(18)
        + (c.visible ? "" : "[hidden] ")
        + (c.text === null ? (c.textResource ? "#" + c.textResource.raw : "") : JSON.stringify(c.text)));
    }
  }
  const walk = (items, indent) => {
    for (const item of items) {
      console.log(indent + (item.kind === "separator" ? "---"
        : item.label + (item.accelerator ? "\t" + item.accelerator : "")
          + (item.id ? "   " + item.id : "")));
      walk(item.items, indent + "  ");
    }
  };
  for (const id of Object.keys(parsed.menus)) {
    console.log("\n" + id);
    walk(parsed.menus[id].items, "  ");
  }
  for (const id of Object.keys(parsed.accelerators)) {
    console.log("\n" + id);
    for (const a of parsed.accelerators[id].entries) {
      console.log("  " + (a.flags.join("+") + " " + a.key).padEnd(36) + "  " + a.id);
    }
  }
  console.log("\nbitmaps: " + parsed.bitmaps.length + ", icons: " + parsed.icons.length);
  console.log("shared numeric ids: " + parsed.symbols.shared.length);
}

const invokedDirectly = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  const parsed = readRc();
  if (process.argv.includes("--dump")) {
    dump(parsed);
  } else if (process.argv.includes("--check")) {
    const wanted = renderModule(parsed);
    let current = "";
    try { current = readFileSync(OUT_PATH, "utf8"); } catch { /* not there yet */ }
    if (current === wanted) {
      console.log("src/app/resources.ts is up to date with IQPokyd.rc.");
    } else {
      console.error("src/app/resources.ts is stale -- run node tools/extract-rc.mjs");
      process.exit(1);
    }
  } else {
    writeFileSync(OUT_PATH, renderModule(parsed));
    const counts = Object.values(parsed.dialogs)
      .reduce((n, d) => n + d.controls.length, 0);
    console.log("src/app/resources.ts: " + Object.keys(parsed.dialogs).length
      + " dialogs, " + counts + " controls, "
      + Object.keys(parsed.menus).length + " menu, "
      + Object.values(parsed.accelerators).reduce((n, a) => n + a.entries.length, 0)
      + " accelerators, " + parsed.bitmaps.length + " bitmaps, "
      + parsed.icons.length + " icons.");
  }
}
