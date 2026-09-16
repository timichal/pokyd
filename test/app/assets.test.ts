/* IQ Pokyd - test/app/assets.test.ts - phase 6.2 of PLAN.md.

   src/app/assets/ claims to be the author's own pictures.  This is what makes
   that claim checkable, and the claim is a strong one: **not one pixel moved.**

   The comparison is deliberately not a comparison of bytes.  Running the
   extractor again and diffing the PNGs would test this machine's zlib rather
   than this repository -- a different node on the Linux runner could deflate
   the same image differently and fail a test that nothing was wrong with.  So
   what is compared here is the *image*: every committed PNG is decoded by a
   decoder written in this file, independently of the encoder that made it, and
   held against the BMP or ICO it came from, pixel for pixel, alpha included.

   In order of how much it would hurt to be wrong:

     1. **nothing was altered.**  18 files, every pixel of every one of them,
        against the archive.  A lossy re-encode, a dropped alpha channel, a
        palette off by one -- none of them survives this.
     2. **nothing was invented and nothing was dropped.**  The set of files in
        src/app/assets/ is exactly what BITMAPS and ICONS ask for, and the
        manifest imports exactly the files that are there.
     3. **the decoder is not merely agreeing with itself.**  The extractor's BMP
        reader is on one side of check 1, so a bug in it would cancel out.  The
        geometry of every bitmap is therefore read straight out of the BMP
        header here, and the whole of `bmp00001.bmp` is read out of its raw
        bits by a reader written in this file, which shares nothing with it.
     4. **the icons kept their transparency.**  The AND mask of each ICO entry
        is read bit by bit here and compared with the alpha channel that came
        back out of the PNG.
     5. **the favicon is the author's file.**  Byte for byte, not re-encoded.
     6. **the committed module is the generated one.**  renderModule() is run
        in memory and compared with src/app/assets.ts, so "generated" cannot
        quietly become "hand-edited".

   Run it:   node test/app/assets.test.ts

   Needs nothing but node: no browser, no engine, no build.  Written by us, not
   ported; ASCII only, like the rest of the non-engine code.
*/

import { readFileSync, readdirSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { BITMAPS, ICONS } from "../../src/app/resources.ts";
import {
  readAssets, renderModule, resolveInArchive, decodeBmp, decodeIco,
  FAVICON_SOURCE, FAVICON_NAME,
} from "../../tools/extract-assets.mjs";
import type { RgbaImage } from "../../tools/extract-assets.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ASSET_DIR = join(ROOT, "src", "app", "assets");
const MODULE_PATH = join(ROOT, "src", "app", "assets.ts");
const INDEX_PATH = join(ROOT, "index.html");

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
  ok(label, a === b, a === b ? undefined : "got " + a + "\n          expected " + b);
}

function heading(text: string): void {
  console.log("\n" + text);
}

console.log("IQ Pokyd - phase 6.2, the pictures read back\n");

/* ------------------------------------------------------------ a PNG decoder */

/** Read a PNG back to RGBA.  Deliberately its own code: it shares nothing with
 *  tools/extract-assets.mjs but node's zlib, so the two can disagree.  It
 *  handles the three colour types the extractor emits at the one bit depth it
 *  emits, and says so loudly rather than guessing if it meets anything else. */
function decodePng(buf: Buffer): RgbaImage & { colourType: number; palette: number } {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== signature[i]) throw new Error("not a PNG at byte " + i);
  }

  let at = 8;
  let ihdr: Buffer | null = null;
  let plte: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  const seen: string[] = [];

  while (at < buf.length) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString("latin1", at + 4, at + 8);
    const data = buf.subarray(at + 8, at + 8 + length);
    const stated = buf.readUInt32BE(at + 8 + length);
    /* The CRC covers the type and the data, and a wrong one means the file is
       damaged -- which is the whole reason it is checked here. */
    const computed = crc32(buf.subarray(at + 4, at + 8 + length));
    if (stated !== computed) throw new Error(type + " chunk CRC is wrong");
    seen.push(type);
    if (type === "IHDR") ihdr = Buffer.from(data);
    else if (type === "PLTE") plte = Buffer.from(data);
    else if (type === "tRNS") trns = Buffer.from(data);
    else if (type === "IDAT") idat.push(Buffer.from(data));
    at += 12 + length;
    if (type === "IEND") break;
  }
  if (ihdr === null) throw new Error("no IHDR");
  if (seen[seen.length - 1] !== "IEND") throw new Error("no IEND at the end");

  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const depth = ihdr[8];
  const colourType = ihdr[9];
  if (depth !== 8) throw new Error("bit depth " + depth + ", expected 8");
  if (ihdr[10] !== 0 || ihdr[11] !== 0 || ihdr[12] !== 0) {
    throw new Error("compression/filter/interlace is not 0/0/0");
  }
  const bpp = colourType === 3 ? 1 : colourType === 2 ? 3 : colourType === 6 ? 4 : 0;
  if (bpp === 0) throw new Error("colour type " + colourType + " is not one we emit");

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  if (raw.length !== (stride + 1) * height) {
    throw new Error("inflated " + raw.length + " bytes, expected "
      + (stride + 1) * height);
  }

  /* Undo the row filters.  The same five as the spec, read the other way. */
  const flat = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? flat[y * stride + i - bpp] : 0;
      const b = y > 0 ? flat[(y - 1) * stride + i] : 0;
      const c = i >= bpp && y > 0 ? flat[(y - 1) * stride + i - bpp] : 0;
      let add;
      if (type === 0) add = 0;
      else if (type === 1) add = a;
      else if (type === 2) add = b;
      else if (type === 3) add = (a + b) >> 1;
      else if (type === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else throw new Error("filter type " + type + " on row " + y);
      flat[y * stride + i] = (src[i] + add) & 0xff;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (colourType === 3) {
      if (plte === null) throw new Error("indexed, but no PLTE");
      const index = flat[i];
      rgba[i * 4] = plte[index * 3];
      rgba[i * 4 + 1] = plte[index * 3 + 1];
      rgba[i * 4 + 2] = plte[index * 3 + 2];
      rgba[i * 4 + 3] = trns !== null && index < trns.length ? trns[index] : 255;
    } else if (colourType === 2) {
      rgba[i * 4] = flat[i * 3];
      rgba[i * 4 + 1] = flat[i * 3 + 1];
      rgba[i * 4 + 2] = flat[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    } else {
      for (let k = 0; k < 4; k++) rgba[i * 4 + k] = flat[i * 4 + k];
    }
  }
  return {
    width, height, rgba, colourType,
    palette: plte === null ? 0 : plte.length / 3,
  };
}

/** CRC-32, written out here rather than imported, for the same reason as the
 *  decoder around it. */
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Where the first difference between two images is, or null. */
function firstDifference(a: RgbaImage, b: RgbaImage): string | null {
  if (a.width !== b.width || b.height !== a.height) {
    return a.width + "x" + a.height + " against " + b.width + "x" + b.height;
  }
  for (let i = 0; i < a.width * a.height; i++) {
    for (let k = 0; k < 4; k++) {
      if (a.rgba[i * 4 + k] !== b.rgba[i * 4 + k]) {
        return "pixel " + (i % a.width) + "," + Math.floor(i / a.width)
          + " channel " + "rgba"[k] + ": " + a.rgba[i * 4 + k]
          + " against " + b.rgba[i * 4 + k];
      }
    }
  }
  return null;
}

/* ---------------------------------------------------------- 1. every pixel */

const assets = readAssets();
const committed = (name: string): Buffer => readFileSync(join(ASSET_DIR, name));

heading("every committed PNG is the archive's image, pixel for pixel");
{
  for (const bitmap of assets.bitmaps) {
    const source = decodeBmp(readFileSync(resolveInArchive(bitmap.source).path));
    const png = decodePng(committed(bitmap.name));
    const diff = firstDifference(png, source);
    ok(bitmap.name.padEnd(22) + bitmap.id.padEnd(24)
      + (source.width + "x" + source.height).padStart(9), diff === null, diff ?? undefined);
  }
  for (const icon of assets.icons) {
    const images = decodeIco(readFileSync(resolveInArchive(icon.source).path));
    icon.sizes.forEach((size, i) => {
      const png = decodePng(committed(size.name));
      const diff = firstDifference(png, images[i]);
      ok(size.name.padEnd(22) + icon.id.padEnd(24)
        + (size.width + "x" + size.height).padStart(9), diff === null, diff ?? undefined);
    });
  }
}

/* ------------------------------------------ 2. nothing invented or dropped */

heading("the directory holds exactly what resources.ts asks for");
{
  const onDisk = readdirSync(ASSET_DIR).sort();
  const wanted = assets.files.map((f) => f.name).sort();
  eq("18 files, and they are the generated set", onDisk, wanted);
  eq("one PNG per bitmap", assets.bitmaps.length, BITMAPS.length);
  eq("one entry per icon", assets.icons.length, ICONS.length);
  eq("six PNGs across the three icons",
    assets.icons.reduce((n, i) => n + i.sizes.length, 0), 6);
  ok("every file is a PNG but the favicon",
    onDisk.filter((n) => !n.endsWith(".png")).join() === FAVICON_NAME);
}

heading("the manifest imports exactly those files");
{
  const module_ = readFileSync(MODULE_PATH, "utf8");
  const imported = [...module_.matchAll(/^import \w+ from "\.\/assets\/(.+)";$/gm)]
    .map((m) => m[1]).sort();
  eq("one import per file", imported, assets.files.map((f) => f.name).sort());
  ok("nothing in it is a hand-written URL",
    !/["'][^"']*\/assets\/[^"']*["']\s*[,;)]/.test(
      module_.replace(/^import .*$/gm, "")));
  ok("index.html links the favicon",
    readFileSync(INDEX_PATH, "utf8").includes("src/app/assets/" + FAVICON_NAME));
}

/* -------------------------------------- 3. the extractor is not its own judge */

heading("the geometry comes off the BMP headers, not off the extractor");
{
  for (const bitmap of assets.bitmaps) {
    const raw = readFileSync(resolveInArchive(bitmap.source).path);
    const width = raw.readInt32LE(18);
    const height = Math.abs(raw.readInt32LE(22));
    const png = decodePng(committed(bitmap.name));
    ok(bitmap.name.padEnd(22) + "BITMAPINFOHEADER says " + width + "x" + height,
      png.width === width && png.height === height,
      "the PNG is " + png.width + "x" + png.height);
  }
}

heading("bmp00001.bmp, read bit by bit by this file");
{
  /* IDB_KURZORKLAVESNICE is the caret bitmap of the sentence box
     (mfcDlg.cpp:1014): 7x28, one bit per pixel, bottom-up, rows padded to four
     bytes.  Small enough to decode here from first principles, which is what
     makes check 1 something other than the extractor agreeing with itself. */
  const raw = readFileSync(resolveInArchive("res/bmp00001.bmp").path);
  const dataAt = raw.readUInt32LE(10);
  const width = raw.readInt32LE(18);
  const height = raw.readInt32LE(22);
  eq("it is the 7x28 monochrome caret", [width, height, raw.readUInt16LE(28)],
    [7, 28, 1]);

  const palette = [0, 1].map((i) => [
    raw[54 + i * 4 + 2], raw[54 + i * 4 + 1], raw[54 + i * 4],
  ]);
  const png = decodePng(committed("bmp00001.png"));
  const stride = Math.floor((width + 31) / 32) * 4;
  let wrong = 0;
  let set = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bit = (raw[dataAt + (height - 1 - y) * stride + (x >> 3)]
        >> (7 - (x & 7))) & 1;
      if (bit === 1) set++;
      const want = palette[bit];
      const i = (y * width + x) * 4;
      if (png.rgba[i] !== want[0] || png.rgba[i + 1] !== want[1]
        || png.rgba[i + 2] !== want[2] || png.rgba[i + 3] !== 255) wrong++;
    }
  }
  eq("all 196 pixels agree", wrong, 0);
  ok("and it is not a blank bitmap (" + set + " of 196 bits set)",
    set > 0 && set < width * height);
}

/* -------------------------------------------------- 4. the icons kept alpha */

heading("every icon's alpha channel is its AND mask");
{
  for (const icon of assets.icons) {
    const raw = readFileSync(resolveInArchive(icon.source).path);
    icon.sizes.forEach((size, i) => {
      const offset = raw.readUInt32LE(6 + i * 16 + 12);
      const headerSize = raw.readUInt32LE(offset);
      const bitCount = raw.readUInt16LE(offset + 14);
      const clrUsed = raw.readUInt32LE(offset + 32) || (1 << bitCount);
      const colourAt = offset + headerSize + clrUsed * 4;
      const colourStride = Math.floor((size.width * bitCount + 31) / 32) * 4;
      const maskAt = colourAt + colourStride * size.height;
      const maskStride = Math.floor((size.width + 31) / 32) * 4;

      const png = decodePng(committed(size.name));
      let wrong = 0;
      let clear = 0;
      for (let y = 0; y < size.height; y++) {
        for (let x = 0; x < size.width; x++) {
          const bit = (raw[maskAt + y * maskStride + (x >> 3)] >> (7 - (x & 7))) & 1;
          if (bit === 1) clear++;
          const alpha = png.rgba[((size.height - 1 - y) * size.width + x) * 4 + 3];
          if (alpha !== (bit === 1 ? 0 : 255)) wrong++;
        }
      }
      ok(size.name.padEnd(22) + clear + " of " + size.width * size.height
        + " pixels masked out", wrong === 0, wrong + " pixels disagree");
    });
  }
}

/* ---------------------------------------------------------- 5. the favicon */

heading("the favicon is the author's file and not a copy of it");
{
  const original = readFileSync(resolveInArchive(FAVICON_SOURCE).path);
  const shipped = committed(FAVICON_NAME);
  ok("src/app/assets/" + FAVICON_NAME + " is res/IQPokyd.ico, byte for byte ("
    + original.length + " bytes)", shipped.equals(original));
  eq("and it is the icon IDR_MAINFRAME names",
    ICONS.find((i) => i.id === "IDR_MAINFRAME")?.file, FAVICON_SOURCE);
}

/* ------------------------------------------------------- 6. no hand-editing */

heading("the committed module is the generated one");
{
  const wanted = renderModule(assets);
  const current = readFileSync(MODULE_PATH, "utf8");
  ok("src/app/assets.ts is what tools/extract-assets.mjs renders",
    current === wanted,
    current === wanted ? undefined : "run node tools/extract-assets.mjs");
  ok("it is ASCII", !/[^\x00-\x7f]/.test(current));
  ok("and CRLF, like everything else here", !/(^|[^\r])\n/.test(current));
}

/* ------------------------------------------------------ what came out of it */

heading("what the transcode cost");
{
  const png = assets.files.filter((f) => f.name.endsWith(".png"))
    .reduce((n, f) => n + f.bytes.length, 0);
  const sourceBytes = (n: number, a: { sourceBytes: number }): number => n + a.sourceBytes;
  const archive = assets.bitmaps.reduce(sourceBytes, 0)
    + assets.icons.reduce(sourceBytes, 0);
  console.log("        " + archive + " bytes of BMP and ICO -> " + png
    + " bytes of PNG (" + (100 - Math.round(png * 100 / archive)) + "% off)");
  const background = decodePng(committed("pozadi-iqpokyd.png"));
  console.log("        the background alone: 1239354 -> "
    + committed("pozadi-iqpokyd.png").length + ", indexed, "
    + background.palette + " colours");
  ok("the background is indexed and kept every colour it had",
    background.colourType === 3 && background.palette === 135,
    "colour type " + background.colourType + ", " + background.palette + " colours");
}

/* ------------------------------------------------------------------ verdict */

console.log(failures === 0
  ? "\nPASS -- " + checks + " checks.  src/app/assets/ is the author's pictures,"
    + " and not one pixel of them moved."
  : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
process.exit(failures === 0 ? 0 : 1);
