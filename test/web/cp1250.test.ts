/* IQ Pokyd - test/web/cp1250.test.ts - phase 4.1 of PLAN.md.

   What this is trying to prove, in order of how much it would hurt to be wrong:

     1. the table is the real CP1250, not a plausible one.  Checked against the
        platform's own TextDecoder("windows-1250") on all 256 bytes -- an oracle
        this file does not share a line of code with -- and against the Czech
        alphabet written out by hand below, letter by letter, from the codepage
        and not from src/web/cp1250.ts.
     2. the two directions are inverses.  All 256 bytes round-trip, and so do
        four real files from the archive, two of which use every byte value there
        is.  90 KB of the author's own dictionary surviving a round trip is a
        much stronger statement than any string literal in here.
     3. the decisions encode had to make -- normalization, best fit, what an
        unmappable character becomes -- do what the module says they do.

   Run it:   node test/web/cp1250.test.ts

   No package.json, no dependencies: node 24 strips the types itself, the same
   way test/wasm/smoke.mjs needs nothing but node.  Exits non-zero if anything
   moved.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code,
   so every Czech letter in here is a \u escape.  That is not a nuisance, it is
   the point: an escape states which code point is meant, where the letter itself
   would only state what this file's own encoding thinks it is.
*/

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  CP1250_TO_UNICODE,
  CZECH_ALPHABET,
  REPLACEMENT_BYTE,
  decodeCp1250,
  encodeCp1250,
  encodeCp1250Z,
  canEncode,
  isEncodable,
} from "../../src/web/cp1250.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/* ------------------------------------------------------------- the harness */

let failures = 0;
let checks = 0;

function ok(label: string, cond: boolean, detail?: string): void {
  checks++;
  if (cond) {
    console.log("  ok    " + label);
  } else {
    failures++;
    console.log("  FAIL  " + label + (detail === undefined ? "" : "\n          " + detail));
  }
}

function eq(label: string, got: unknown, expected: unknown): void {
  const a = JSON.stringify(got);
  const b = JSON.stringify(expected);
  ok(label, a === b, a === b ? undefined : "got " + a + ", expected " + b);
}

function bytesEq(label: string, got: Uint8Array, expected: Uint8Array | number[]): void {
  const b = expected instanceof Uint8Array ? expected : Uint8Array.from(expected);
  let same = got.length === b.length;
  let at = -1;
  if (same) {
    for (let i = 0; i < b.length; i++) {
      if (got[i] !== b[i]) { same = false; at = i; break; }
    }
  }
  ok(label, same, same ? undefined
    : at >= 0
      ? "first difference at byte " + at + ": got 0x" + got[at].toString(16)
        + ", expected 0x" + b[at].toString(16)
      : "length " + got.length + ", expected " + b.length);
}

function hex(n: number): string {
  return "0x" + n.toString(16).padStart(2, "0");
}

function u(n: number): string {
  return "U+" + n.toString(16).toUpperCase().padStart(4, "0");
}

function heading(s: string): void {
  console.log("\n" + s);
}

const ALL_BYTES = Uint8Array.from({ length: 256 }, (_, i) => i);

/* ------------------------------------------------ 1. the table is the table */

heading("the table");

eq("256 entries", CP1250_TO_UNICODE.length, 256);

ok("0x00-0x7F is US-ASCII, mapping to itself",
  CP1250_TO_UNICODE.slice(0, 128).every((cp, b) => cp === b));

ok("injective -- 256 distinct code points, so decode loses nothing",
  new Set(CP1250_TO_UNICODE).size === 256);

ok("every byte is one UTF-16 code unit (highest is U+20AC, the euro at 0x80)",
  CP1250_TO_UNICODE.every((cp) => cp < 0x10000));

/* The oracle.  Every browser has this decoder -- the Encoding Standard requires
   it -- and it is where the table came from, so this is the check that it came
   across intact and has not been edited since. */
heading("against the platform decoder (TextDecoder(\"windows-1250\"))");
{
  const platform = new TextDecoder("windows-1250");
  const diffs: string[] = [];
  for (let b = 0; b < 256; b++) {
    const theirs = platform.decode(Uint8Array.of(b));
    const ours = decodeCp1250(Uint8Array.of(b));
    if (theirs !== ours) {
      diffs.push(hex(b) + ": platform " + u(theirs.codePointAt(0) ?? -1)
        + ", ours " + u(ours.codePointAt(0) ?? -1));
    }
  }
  ok("all 256 bytes decode identically", diffs.length === 0, diffs.join("; "));

  /* And the whole thing at once, not just byte at a time -- catches anything
     that only goes wrong in a sequence. */
  eq("the full 256-byte sweep decodes identically",
    decodeCp1250(ALL_BYTES), platform.decode(ALL_BYTES));
}

/* The five CP1250 leaves undefined.  Python's codec refuses them; the Encoding
   Standard and every browser give the C1 controls, and filling them is what
   makes the map a bijection -- see the module header. */
heading("the five bytes CP1250 does not define");
for (const [byte, cp] of [[0x81, 0x0081], [0x83, 0x0083], [0x88, 0x0088],
                           [0x90, 0x0090], [0x98, 0x0098]] as const) {
  eq(hex(byte) + " -> " + u(cp), CP1250_TO_UNICODE[byte], cp);
}

/* ------------------------------------------------------ 2. the Czech letters */

/* Written out by hand from the Czech alphabet and the CP1250 chart, not read
   out of the module.  This is the list PLAN.md 4.1 asks for, plus the capitals
   and the two the plan's list leaves out (d-caron is there, n-caron is there),
   which makes it the whole of Czech's accented inventory: 15 lowercase, 15
   uppercase. */
const CZECH_LETTERS: ReadonlyArray<readonly [string, number, number]> = [
  ["a-acute", 0x00e1, 0xe1], ["c-caron", 0x010d, 0xe8], ["d-caron", 0x010f, 0xef],
  ["e-acute", 0x00e9, 0xe9], ["e-caron", 0x011b, 0xec], ["i-acute", 0x00ed, 0xed],
  ["n-caron", 0x0148, 0xf2], ["o-acute", 0x00f3, 0xf3], ["r-caron", 0x0159, 0xf8],
  ["s-caron", 0x0161, 0x9a], ["t-caron", 0x0165, 0x9d], ["u-acute", 0x00fa, 0xfa],
  ["u-ring",  0x016f, 0xf9], ["y-acute", 0x00fd, 0xfd], ["z-caron", 0x017e, 0x9e],
  ["A-acute", 0x00c1, 0xc1], ["C-caron", 0x010c, 0xc8], ["D-caron", 0x010e, 0xcf],
  ["E-acute", 0x00c9, 0xc9], ["E-caron", 0x011a, 0xcc], ["I-acute", 0x00cd, 0xcd],
  ["N-caron", 0x0147, 0xd2], ["O-acute", 0x00d3, 0xd3], ["R-caron", 0x0158, 0xd8],
  ["S-caron", 0x0160, 0x8a], ["T-caron", 0x0164, 0x8d], ["U-acute", 0x00da, 0xda],
  ["U-ring",  0x016e, 0xd9], ["Y-acute", 0x00dd, 0xdd], ["Z-caron", 0x017d, 0x8e],
];

heading("the Czech alphabet, both directions (" + CZECH_LETTERS.length + " letters)");
{
  let wrong: string[] = [];
  for (const [name, cp, byte] of CZECH_LETTERS) {
    const ch = String.fromCodePoint(cp);
    if (CP1250_TO_UNICODE[byte] !== cp) wrong.push(name + ": decode " + hex(byte));
    const back = encodeCp1250(ch);
    if (back.length !== 1 || back[0] !== byte) wrong.push(name + ": encode " + u(cp));
    if (decodeCp1250(Uint8Array.of(byte)) !== ch) wrong.push(name + ": decode round");
  }
  ok("every letter decodes and encodes to the byte the codepage says",
    wrong.length === 0, wrong.join("; "));

  /* CZECH_ALPHABET is documentation in the module; this is the test that keeps it
     honest, since nothing else reads it. */
  const here = CZECH_LETTERS.map(([j, , b]) => j + "=" + b).join(",");
  const there = CZECH_ALPHABET.map(([j, b]) => j + "=" + b).join(",");
  ok("CZECH_ALPHABET in the module agrees with this file's hand-written list",
    here === there,
    here === there ? undefined : "module: " + there);
}

/* The exact string PLAN.md 4.1 names. */
heading("the string PLAN.md asks for");
{
  /* e-caron s-caron c-caron r-caron z-caron y-acute a-acute i-acute e-acute
     u-ring u-acute n-caron t-caron d-caron o-acute */
  const sentence = "\u011b\u0161\u010d\u0159\u017e\u00fd\u00e1\u00ed\u00e9"
             + "\u016f\u00fa\u0148\u0165\u010f\u00f3";
  const expectedBytes = [0xec, 0x9a, 0xe8, 0xf8, 0x9e, 0xfd, 0xe1, 0xed, 0xe9,
                  0xf9, 0xfa, 0xf2, 0x9d, 0xef, 0xf3];
  bytesEq("encodes to the fifteen expected bytes", encodeCp1250(sentence), expectedBytes);
  eq("and decodes back to itself", decodeCp1250(Uint8Array.from(expectedBytes)), sentence);
}

/* ------------------------------------------------------- 3. round trip laws */

heading("round trip");

bytesEq("all 256 bytes: encode(decode(b)) === b",
  encodeCp1250(decodeCp1250(ALL_BYTES)), ALL_BYTES);

eq("a decoded string has one code unit per input byte",
  decodeCp1250(ALL_BYTES).length, 256);

eq("empty input decodes to the empty string", decodeCp1250(new Uint8Array(0)), "");
eq("empty string encodes to no bytes", encodeCp1250("").length, 0);

/* Long enough to cross the module's chunking threshold, which is the one branch
   in decode that a short string never reaches. */
{
  const longInput = new Uint8Array(70000);
  for (let i = 0; i < longInput.length; i++) longInput[i] = i & 0xff;
  const text = decodeCp1250(longInput);
  eq("70,000 bytes decode to 70,000 code units (the chunked path)",
    text.length, longInput.length);
  bytesEq("and round-trip", encodeCp1250(text), longInput);
}

/* ------------------------------------------------- 4. the archive's own data */

/* The real test.  SLOVNIK.IQP and IQPOKYD.IQP contain all 256 byte values --
   obfuscated, checksummed data, including the five bytes CP1250 leaves
   undefined -- so a codec with a single hole in it cannot get them back. */
heading("real files from the archive");
for (const rel of [
  "original/slovnik.iqp",
  "original/IQ Pokyd/Data/Intelig/IQPOKYD.IQP",
  "original/IQ Pokyd/Data/Intelig/GRAMATIK.IQZ",
  "test/golden/rozhovor.in",
  "test/golden/rozhovor.txt",
]) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) { ok(rel + " (not present, skipped)", true); continue; }
  const bytes = new Uint8Array(readFileSync(path));
  const text = decodeCp1250(bytes);
  const back = encodeCp1250(text);
  const distinct = new Set(bytes).size;
  bytesEq(rel + " -- " + bytes.length + " bytes, " + distinct
    + " distinct values -- round-trips", back, bytes);
}

/* And that the golden transcript decodes to Czech a human would recognise,
   rather than merely to something reversible. */
heading("the golden transcript reads as Czech");
{
  const path = join(ROOT, "test/golden/rozhovor.txt");
  if (!existsSync(path)) {
    ok("test/golden/rozhovor.txt (not present, skipped)", true);
  } else {
    const transcript = decodeCp1250(new Uint8Array(readFileSync(path)));
    /* "jsem rad, ze jsi tu." -- a-acute and z-caron, the engine's first answer */
    const first = "jsem r\u00e1d, \u017ee jsi tu.";
    ok("contains " + JSON.stringify(first), transcript.includes(first));
    /* "Umis cesky?" -- i-acute, s-caron, c-caron, from the human's side */
    const question = "Um\u00ed\u0161 \u010desky?";
    ok("contains " + JSON.stringify(question), transcript.includes(question));
    ok("no U+FFFD anywhere -- nothing was replaced on the way in",
      !transcript.includes("\ufffd"));
  }
}

/* ------------------------------------------------------- 5. encode's choices */

heading("normalization (default on)");
{
  /* What an Apple keyboard hands over: a bare c and a combining caron.  CP1250
     has no combining caron, so without NFC this word arrives at the engine cut
     in half -- and JELI_PISMENO would tokenize it as two words. */
  const decomposed: string = "c\u030c";                    /* c + combining caron  */
  const composed: string = "\u010d";                       /* c-caron              */
  eq("the two spellings are genuinely different strings", decomposed === composed, false);
  bytesEq("decomposed c-caron encodes to " + hex(0xe8), encodeCp1250(decomposed), [0xe8]);
  bytesEq("composed c-caron encodes to the same byte", encodeCp1250(composed), [0xe8]);
  /* Without NFC the caron is a character in its own right.  Best fit strips it
     -- a combining mark is all mark, so nothing survives stripMarks -- and the
     word quietly loses its diacritic.  Turn best fit off too and it becomes a
     separator in the middle of a word instead.  Both are worse than NFC, which
     is the argument for that default. */
  bytesEq("with normalize:false the caron is dropped, c-caron becomes c",
    encodeCp1250(decomposed, { normalize: false }), [0x63]);
  bytesEq("with neither, it splits the word",
    encodeCp1250(decomposed, { normalize: false, bestFit: false }),
    [0x63, REPLACEMENT_BYTE]);

  /* A whole decomposed word, because one letter is easy to get right by luck.
     "prilis" with r-caron, i-acute, s-caron: "Prilis zlutoucky kun". */
  const word = "\u0159\u00ed\u0161e";            /* r-caron i-acute s-caron e */
  bytesEq("a decomposed word normalizes and encodes whole",
    encodeCp1250(word.normalize("NFD")), [0xf8, 0xed, 0x9a, 0x65]);
}

heading("characters CP1250 cannot hold");
{
  /* An emoji is two UTF-16 code units and must cost one replacement byte, not
     two -- the reason encode iterates code points. */
  const emoji = "\u{1f600}";
  eq("an emoji is two code units", emoji.length, 2);
  bytesEq("but encodes to a single replacement byte",
    encodeCp1250(emoji), [REPLACEMENT_BYTE]);
  bytesEq("in a sentence, it lands as one separator",
    encodeCp1250("ahoj " + emoji + " svete"),
    [0x61, 0x68, 0x6f, 0x6a, 0x20, REPLACEMENT_BYTE, 0x20,
     0x73, 0x76, 0x65, 0x74, 0x65]);

  eq("REPLACEMENT_BYTE is '?' -- a word separator to JELI_PISMENO, not a letter",
    REPLACEMENT_BYTE, 0x3f);

  /* Cyrillic: no decomposition, no CP1250 equivalent, no best fit. */
  bytesEq("Cyrillic has nowhere to go", encodeCp1250("\u0416"), [REPLACEMENT_BYTE]);

  bytesEq("a custom replacement byte is honoured",
    encodeCp1250(emoji, { replacement: 0x20 }), [0x20]);
}

heading("best fit (default on)");
{
  /* NFD reaches these: strip the mark and the base letter is in the codepage. */
  bytesEq("a-macron -> a", encodeCp1250("\u0101"), [0x61]);
  bytesEq("n-tilde -> n", encodeCp1250("\u00f1"), [0x6e]);
  bytesEq("a-ring -> a", encodeCp1250("\u00e5"), [0x61]);
  /* NFD does not: no decomposition at all, so the explicit table catches them. */
  bytesEq("o-slash -> o", encodeCp1250("\u00f8"), [0x6f]);
  bytesEq("ae -> ae, two bytes from one character",
    encodeCp1250("\u00e6"), [0x61, 0x65]);
  bytesEq("thorn -> th", encodeCp1250("\u00fe"), [0x74, 0x68]);

  bytesEq("with bestFit:false they become separators",
    encodeCp1250("\u0101\u00f8", { bestFit: false }),
    [REPLACEMENT_BYTE, REPLACEMENT_BYTE]);

  /* Best fit must never fire on something the codepage already has. */
  bytesEq("a letter CP1250 has is never best-fitted away",
    encodeCp1250("\u0159\u010d\u0161"), [0xf8, 0xe8, 0x9a]);
  bytesEq("sharp s is in CP1250 at 0xDF and stays one byte",
    encodeCp1250("\u00df"), [0xdf]);
  bytesEq("l-stroke is in CP1250 at 0xB3", encodeCp1250("\u0142"), [0xb3]);

  /* Invisibles a paste carries.  These drop rather than becoming separators,
     because a zero-width joiner in the middle of a word would otherwise split
     a word the user typed as one. */
  bytesEq("zero-width characters and the BOM drop out",
    encodeCp1250("a\u200bb\u200dc\ufeffd"), [0x61, 0x62, 0x63, 0x64]);
}

heading("punctuation a modern keyboard produces -- CP1250 has all of it");
{
  const pairs: ReadonlyArray<readonly [string, number, number]> = [
    ["left single quote",  0x2018, 0x91], ["right single quote", 0x2019, 0x92],
    ["left double quote",  0x201c, 0x93], ["right double quote", 0x201d, 0x94],
    ["Czech opening quote", 0x201e, 0x84],
    ["en dash",            0x2013, 0x96], ["em dash",            0x2014, 0x97],
    ["ellipsis",           0x2026, 0x85], ["non-breaking space",  0x00a0, 0xa0],
    ["euro",               0x20ac, 0x80],
  ];
  const wrong = pairs.filter(([, cp, byte]) => {
    const v = encodeCp1250(String.fromCodePoint(cp));
    return v.length !== 1 || v[0] !== byte;
  }).map(([j]) => j);
  ok("all ten survive as themselves, no substitution", wrong.length === 0,
    wrong.join("; "));
}

heading("fatal mode");
{
  let thrown: unknown = null;
  try { encodeCp1250("ahoj \u{1f600}", { fatal: true }); } catch (e) { thrown = e; }
  ok("throws on an unmappable character", thrown instanceof RangeError);
  const message = thrown instanceof Error ? thrown.message : "";
  ok("the message names the code point", message.includes("U+1F600"), message);
  ok("the message names the index", message.includes("index 5"), message);

  let quiet: unknown = null;
  try { encodeCp1250("\u0159\u010d\u0161", { fatal: true }); } catch (e) { quiet = e; }
  ok("does not throw on text CP1250 can hold", quiet === null);

  /* Best fit runs first, so a character it rescues is not fatal. */
  let nordic: unknown = null;
  try { encodeCp1250("\u00f8", { fatal: true }); } catch (e) { nordic = e; }
  ok("best fit runs before fatal does", nordic === null);
}

/* ---------------------------------------------------------- 6. the helpers */

heading("helpers");
{
  ok("canEncode(r-caron)", canEncode("\u0159"));
  ok("canEncode(emoji) is false", !canEncode("\u{1f600}"));
  ok("canEncode('') is false", !canEncode(""));
  ok("canEncode of more than one character is false", !canEncode("ab"));

  ok("isEncodable of a Czech sentence",
    isEncodable("P\u0159\u00edli\u0161 \u017elu\u0165ou\u010dk\u00fd k\u016f\u0148."));
  ok("isEncodable of a decomposed Czech sentence (NFC saves it)",
    isEncodable("P\u0159\u00edli\u0161".normalize("NFD")));
  ok("isEncodable of an emoji is false", !isEncodable("\u{1f600}"));
  ok("isEncodable respects bestFit:false",
    isEncodable("\u00f8") && !isEncodable("\u00f8", { bestFit: false }));

  const withNul = encodeCp1250Z("ahoj");
  bytesEq("encodeCp1250Z NUL-terminates", withNul, [0x61, 0x68, 0x6f, 0x6a, 0x00]);
  eq("encodeCp1250Z('') is just the terminator", Array.from(encodeCp1250Z("")), [0]);
}

heading("decode's input handling");
{
  eq("accepts a plain array", decodeCp1250([0x61, 0x68, 0x6f, 0x6a]), "ahoj");
  eq("masks a stray value above 0xFF instead of yielding \"undefined\"",
    decodeCp1250([0x161]), decodeCp1250([0x61]));
  eq("accepts a subarray view",
    decodeCp1250(Uint8Array.of(9, 0x61, 0x68, 9).subarray(1, 3)), "ah");
}

/* ------------------------------------------------------------------ verdict */

console.log(failures === 0
  ? "\nPASS -- " + checks + " checks.  The boundary converts CP1250 both ways and"
    + " loses nothing doing it."
  : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
process.exit(failures === 0 ? 0 : 1);
