/* IQ Pokyd - src/web/cp1250.ts - the codec at the JS boundary.

   Phase 4.1 of PLAN.md, and the first file of the web side.  pokyd_api.h says
   it in its preamble: every char * that crosses the API is CP1250 in both
   directions and has to stay CP1250, because the engine switches on single
   bytes, indexes a 28-letter alphabet and checksums its own data files.  This
   module is the only place those bytes become text and text becomes those
   bytes.  Nothing above it should ever see a byte; nothing below it should ever
   see a JavaScript string.

   Why hand-rolled when the platform has one.  TextDecoder("windows-1250") is in
   every browser -- the Encoding Standard makes it mandatory -- and the decode
   half of this file agrees with it byte for byte, which the test asserts.  The
   encode half has no platform equivalent at all: TextEncoder only ever emits
   UTF-8.  So the reverse direction had to be written, and once the table is
   here anyway both directions may as well come from the same 256 entries and be
   provably each other's inverse.

   Provenance of the table.  Generated from TextDecoder("windows-1250") and
   cross-checked against Python's cp1250 codec: the two agree on all 251 bytes
   Python defines.  The five Python calls undefined -- 0x81 0x83 0x88 0x90 0x98
   -- are the C1 controls U+0081 U+0083 U+0088 U+0090 U+0098 here, which is what
   the Encoding Standard says and what every browser does.  Filling them matters
   rather more here than it would elsewhere: it makes the map a bijection on all
   256 values, so decode never loses a byte and encode never invents one, and
   both SLOVNIK.IQP and IQPOKYD.IQP use every one of the 256 (0x90 included --
   hazard 6 met it in the CP852 tables).  A codec with five holes in it could not
   round-trip the author's own data files.

   Two invariants worth knowing, both tested:

     - every byte maps to exactly one UTF-16 code unit (the highest is U+20AC),
       so a decoded string has exactly as many code units as the input had bytes
     - encodeCp1250(decodeCp1250(b)) === b for every byte sequence

   What encode does with text CP1250 cannot hold is a decision, not a fact, and
   it is ours -- see BEST_FIT below.

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code; the table is spelled in \u escapes for that reason.
   The Czech naming of the 2005 original belongs to src/engine/, which is a
   byte-exact mirror of it -- nothing on this side of the boundary inherits it.
*/

/* ------------------------------------------------------------------- table */

/* Bytes 0x00-0x7F are US-ASCII and map to themselves; only the top half needs
   spelling out.  Row comments are the byte the row starts at.  For the letters
   this project actually cares about see CZECH_ALPHABET below, which names them. */
const UPPER_HALF =
  /* 0x80 */ "\u20ac\u0081\u201a\u0083\u201e\u2026\u2020\u2021" +
  /* 0x88 */ "\u0088\u2030\u0160\u2039\u015a\u0164\u017d\u0179" +
  /* 0x90 */ "\u0090\u2018\u2019\u201c\u201d\u2022\u2013\u2014" +
  /* 0x98 */ "\u0098\u2122\u0161\u203a\u015b\u0165\u017e\u017a" +
  /* 0xa0 */ "\u00a0\u02c7\u02d8\u0141\u00a4\u0104\u00a6\u00a7" +
  /* 0xa8 */ "\u00a8\u00a9\u015e\u00ab\u00ac\u00ad\u00ae\u017b" +
  /* 0xb0 */ "\u00b0\u00b1\u02db\u0142\u00b4\u00b5\u00b6\u00b7" +
  /* 0xb8 */ "\u00b8\u0105\u015f\u00bb\u013d\u02dd\u013e\u017c" +
  /* 0xc0 */ "\u0154\u00c1\u00c2\u0102\u00c4\u0139\u0106\u00c7" +
  /* 0xc8 */ "\u010c\u00c9\u0118\u00cb\u011a\u00cd\u00ce\u010e" +
  /* 0xd0 */ "\u0110\u0143\u0147\u00d3\u00d4\u0150\u00d6\u00d7" +
  /* 0xd8 */ "\u0158\u016e\u00da\u0170\u00dc\u00dd\u0162\u00df" +
  /* 0xe0 */ "\u0155\u00e1\u00e2\u0103\u00e4\u013a\u0107\u00e7" +
  /* 0xe8 */ "\u010d\u00e9\u0119\u00eb\u011b\u00ed\u00ee\u010f" +
  /* 0xf0 */ "\u0111\u0144\u0148\u00f3\u00f4\u0151\u00f6\u00f7" +
  /* 0xf8 */ "\u0159\u016f\u00fa\u0171\u00fc\u00fd\u0163\u02d9";

/* The whole codepage as one 256-character string, index = byte.  Everything
   else in this file is derived from it. */
const TABLE = (() => {
  let s = "";
  for (let b = 0; b < 0x80; b++) s += String.fromCharCode(b);
  return s + UPPER_HALF;
})();

/* Byte -> Unicode code point.  Exported because it is the artifact: anything
   that wants to check our work, or to build its own table, should read this and
   not re-derive it. */
export const CP1250_TO_UNICODE: readonly number[] =
  Object.freeze(Array.from(TABLE, (ch) => ch.charCodeAt(0)));

/* Unicode code point -> byte.  A bijection, so this has 256 entries too. */
const TO_BYTE = new Map<number, number>();
for (let b = 0; b < 256; b++) TO_BYTE.set(CP1250_TO_UNICODE[b], b);

/* Single-character strings, so decode can build its output without a second
   lookup per byte. */
const CHARS = Array.from(TABLE);

/* The fifteen accented letters of Czech and their capitals, named rather than
   drawn so this file stays ASCII.  Not used by the codec -- it is documentation
   with a test attached (test/web/cp1250.test.ts re-derives these by hand from
   the alphabet and asserts the table agrees). */
export const CZECH_ALPHABET: ReadonlyArray<readonly [string, number]> = Object.freeze([
  ["a-acute", 0xe1], ["c-caron", 0xe8], ["d-caron", 0xef], ["e-acute", 0xe9],
  ["e-caron", 0xec], ["i-acute", 0xed], ["n-caron", 0xf2], ["o-acute", 0xf3],
  ["r-caron", 0xf8], ["s-caron", 0x9a], ["t-caron", 0x9d], ["u-acute", 0xfa],
  ["u-ring", 0xf9], ["y-acute", 0xfd], ["z-caron", 0x9e],
  ["A-acute", 0xc1], ["C-caron", 0xc8], ["D-caron", 0xcf], ["E-acute", 0xc9],
  ["E-caron", 0xcc], ["I-acute", 0xcd], ["N-caron", 0xd2], ["O-acute", 0xd3],
  ["R-caron", 0xd8], ["S-caron", 0x8a], ["T-caron", 0x8d], ["U-acute", 0xda],
  ["U-ring", 0xd9], ["Y-acute", 0xdd], ["Z-caron", 0x8e],
]);

/* ------------------------------------------------------------------ decode */

const CHUNK = 8192;

/* CP1250 bytes -> string.  Total: every one of the 256 values has a character,
   so this cannot fail and cannot lose anything.  Accepts a Uint8Array (what the
   wasm boundary hands over) or anything array-like; values are masked to a byte,
   which keeps a caller's stray 0x100 from silently producing "undefined". */
export function decodeCp1250(bytes: Uint8Array | ArrayLike<number>): string {
  const n = bytes.length;
  if (n === 0) return "";
  if (n <= CHUNK) {
    let out = "";
    for (let i = 0; i < n; i++) out += CHARS[bytes[i] & 0xff];
    return out;
  }
  /* Chunked for the long ones -- KYDY.TXT (phase 8.1) is the only thing here
     likely to get big, but a transcript grows without bound and string += in a
     tight loop over megabytes is the one way this function could be slow. */
  const chunks: string[] = [];
  for (let start = 0; start < n; start += CHUNK) {
    const end = Math.min(start + CHUNK, n);
    let chunk = "";
    for (let i = start; i < end; i++) chunk += CHARS[bytes[i] & 0xff];
    chunks.push(chunk);
  }
  return chunks.join("");
}

/* ------------------------------------------------------------------ encode */

/* The byte an unmappable character becomes by default.  '?' and not something
   cleverer because of what the engine does with it: JELI_PISMENO (vstup.fu)
   accepts 181 of the 256 bytes as letters and '?' (0x3F) is not among them, so a
   replacement lands as a word separator.  The bot sees a sentence with a break
   in it rather than a word with a foreign letter inside it, which is the
   failure the tokenizer is built to survive. */
export const REPLACEMENT_BYTE = 0x3f;

/* The leftovers NFD cannot reach: characters with no decomposition and no
   CP1250 equivalent, plus the invisibles a paste can carry.  Same spirit as
   Windows' best-fit conversion, which is what an MFC CString handed the engine
   in 2005 when the user pasted something the codepage did not have -- so this
   is not only the kinder behaviour, it is closer to the original's.  Small on
   purpose: everything else becomes REPLACEMENT_BYTE. */
const BEST_FIT = new Map<number, string>([
  [0x00f8, "o"],   /* o-slash        */ [0x00d8, "O"],
  [0x00e6, "ae"],  /* ae ligature    */ [0x00c6, "AE"],
  [0x0153, "oe"],  /* oe ligature    */ [0x0152, "OE"],
  [0x00f0, "d"],   /* eth            */ [0x00d0, "D"],
  [0x00fe, "th"],  /* thorn          */ [0x00de, "Th"],
  [0x0131, "i"],   /* dotless i      */
  [0x2212, "-"],   /* minus sign     */
  [0x200b, ""],    /* zero width space    */
  [0x200c, ""],    /* zero width non-joiner */
  [0x200d, ""],    /* zero width joiner   */
  [0xfeff, ""],    /* byte order mark     */
]);

export interface EncodeOptions {
  /** NFC-normalize first.  Default true, and it is load-bearing on Apple
   *  keyboards: they hand over decomposed Czech, "c" + U+030C rather than the
   *  single character, and CP1250 has no combining caron.  Without this a
   *  perfectly ordinary word arrives at the engine cut in half. */
  normalize?: boolean;
  /** Fall back to the unaccented base letter (and to BEST_FIT) before
   *  giving up on a character.  Default true.  A combining mark that arrives on
   *  its own is all mark and nothing else, so this drops it rather than
   *  substituting -- which is why decomposed text encoded with normalize:false
   *  comes out unaccented rather than broken. */
  bestFit?: boolean;
  /** The byte an unmappable character becomes.  Default REPLACEMENT_BYTE. */
  replacement?: number;
  /** Throw a RangeError instead of substituting.  Default false. */
  fatal?: boolean;
}

/* Strip the combining marks off one character and see what is left.  "a" with a
   macron becomes "a"; a Greek letter or an emoji becomes nothing, and the caller
   falls through to the replacement byte. */
function stripMarks(ch: string): string {
  return ch.normalize("NFD").replace(/\p{M}/gu, "");
}

/* string -> CP1250 bytes.  Iterates by code point, not by code unit, so an
   emoji outside the BMP costs one replacement byte and not two. */
export function encodeCp1250(text: string, options?: EncodeOptions): Uint8Array {
  const doNormalize = options?.normalize !== false;
  const doBestFit = options?.bestFit !== false;
  const replacementByte = options?.replacement ?? REPLACEMENT_BYTE;
  const fatal = options?.fatal === true;

  const input = doNormalize ? text.normalize("NFC") : text;

  /* Upper bound: one code unit yields at most two bytes (a surrogate pair is
     two code units and yields at most two, so the bound holds there too). */
  const out = new Uint8Array(input.length * 2);
  let len = 0;
  let index = 0;

  for (const ch of input) {
    const cp = ch.codePointAt(0) as number;
    const direct = TO_BYTE.get(cp);
    if (direct !== undefined) {
      out[len++] = direct;
      index += ch.length;
      continue;
    }

    let done = false;
    if (doBestFit) {
      const substitute = BEST_FIT.get(cp) ?? stripMarks(ch);
      if (substitute !== ch) {
        /* Only if the whole of it fits -- a half-converted character is worse
           than a clean separator. */
        const bytes: number[] = [];
        let fits = true;
        for (const z of substitute) {
          const b = TO_BYTE.get(z.codePointAt(0) as number);
          if (b === undefined) { fits = false; break; }
          bytes.push(b);
        }
        if (fits) {
          for (const b of bytes) out[len++] = b;
          done = true;
        }
      }
    }

    if (!done) {
      if (fatal) {
        throw new RangeError(
          "encodeCp1250: U+" + cp.toString(16).toUpperCase().padStart(4, "0") +
          " at index " + index + " has no CP1250 representation");
      }
      out[len++] = replacementByte & 0xff;
    }
    index += ch.length;
  }

  return out.subarray(0, len);
}

/* ----------------------------------------------------------------- helpers */

/* Whether a single character survives the trip without substitution.  Takes a
   character rather than a code point because that is what a caller validating
   an input field has. */
export function canEncode(ch: string): boolean {
  if (ch.length === 0) return false;
  const cp = ch.codePointAt(0) as number;
  if (String.fromCodePoint(cp) !== ch) return false;   /* more than one char */
  return TO_BYTE.has(cp);
}

/* The same question for a whole string, NFC and all: does encoding it lose
   anything?  What a UI would call to warn before sending, if it ever wants to. */
export function isEncodable(text: string, options?: EncodeOptions): boolean {
  try {
    encodeCp1250(text, { ...options, fatal: true });
    return true;
  } catch {
    return false;
  }
}

/* CP1250 bytes with the NUL the C side reads to.  The engine takes const char *
   and pokyd_say walks it to a terminator; the phase 4.2 worker copies this
   straight into wasm memory.  Kept here rather than there so there is exactly
   one place that knows how a sentence becomes bytes. */
export function encodeCp1250Z(text: string, options?: EncodeOptions): Uint8Array {
  const body = encodeCp1250(text, options);
  const out = new Uint8Array(body.length + 1);
  out.set(body);
  out[body.length] = 0;
  return out;
}
