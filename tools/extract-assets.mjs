/* IQ Pokyd - tools/extract-assets.mjs - phase 6.2 of PLAN.md: the pictures.

   Phase 6.1 turned `IQPokyd.rc` into a list of the images the program loads.
   This turns that list into images a browser will accept: every bitmap and
   every icon in `src/app/resources.ts` is decoded out of the archive and
   written to src/app/assets/ as PNG, with src/app/assets.ts as the manifest
   phase 6.3 imports.

   Run it:   node tools/extract-assets.mjs           # rewrite src/app/assets/
             node tools/extract-assets.mjs --check   # say whether it is current
             node tools/extract-assets.mjs --dump    # print what was decoded

   Three decisions are worth the space they take here.

   **PNG and not WebP, and lossless.**  PLAN.md 6.2 said "PNG/WebP"; the answer
   is PNG.  Nothing on this machine encodes WebP -- no Pillow, no cwebp, no
   ImageMagick -- and the one encoder within reach is a headless Chrome, whose
   output is a browser version rather than a function of the input.  Lossy WebP
   would also be the first thing in this port to change what the author made:
   1.2 MB of `pozadi-iqpokyd.bmp` is a night photograph already posterised to
   135 colours, and re-quantising it is exactly the kind of "improvement" a
   museum piece should refuse.  An 8-bit indexed PNG carries those 135 colours
   exactly and costs about 164 KB -- 87% off, with every pixel the author's.

   **Indexed when it fits, and the filter is chosen by trying.**  135 colours in
   a 900x459 image is a palette, not a photograph, so colour type 3 is both
   smaller and exact.  And the row filters that help a photograph hurt an index:
   filtering `pozadi-iqpokyd` adaptively costs 200 KB where filtering it not at
   all costs 164 KB.  So encodePng() deflates the image five ways and keeps the
   smallest, which is cheap and needs no table of rules.

   **The archive's filenames, lowercased.**  A generated asset keeps the name
   the author gave it, because it is a copy of his file and not a new one --
   `bitmap2.png` is unhelpful and honest, and src/app/assets.ts is where a
   helpful name (IDB_MENUKONEC) is attached to it.  Lowercased because of the
   one thing 6.1 found: IDB_POZADIMALE names `res\POZMALE.BMP` and the file on
   disk is `res/pozmale.bmp`, which a 2005 Windows filesystem forgave and a web
   server will not.

   What --check compares and what the test compares are deliberately different.
   Here, the PNG bytes: if they moved, this machine's encoder disagrees with
   what is committed.  In test/app/assets.test.ts, the *pixels*: it decodes the
   committed PNGs with its own decoder and compares them with the archive, which
   is the stronger claim and the only one that survives a different zlib.

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code.
*/

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { BITMAPS, ICONS, RES_DIR } from "../src/app/resources.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARCHIVE = join(ROOT, ...RES_DIR.split("/"));
const OUT_DIR = join(ROOT, "src", "app", "assets");
const MODULE_PATH = join(ROOT, "src", "app", "assets.ts");

/** The icon the page wears in a tab.  Copied out of the archive byte for byte
 *  rather than re-encoded: every browser reads ICO, the file is 1,078 bytes,
 *  and the author's own bytes are a better favicon than our copy of them. */
export const FAVICON_SOURCE = "res/IQPokyd.ico";
export const FAVICON_NAME = "favicon.ico";

/* ------------------------------------------------------------- the archive */

/** Resolve a path out of the .rc against the real directory, ignoring case.
 *  The .rc is a Windows file and says `res\POZMALE.BMP`; the archive holds
 *  `res/pozmale.bmp`.  Returns the real path and the name as it is on disk. */
export function resolveInArchive(rcPath) {
  const parts = rcPath.replace(/\\/g, "/").split("/");
  let dir = ARCHIVE;
  const real = [];
  for (const part of parts) {
    const entries = readdirSync(dir);
    const hit = entries.find((e) => e.toLowerCase() === part.toLowerCase());
    if (hit === undefined) {
      throw new Error("IQ Pokyd: " + rcPath + " is not in " + RES_DIR
        + " (looking for " + part + " in " + dir + ")");
    }
    real.push(hit);
    dir = join(dir, hit);
  }
  return { path: dir, name: real[real.length - 1] };
}

/* ---------------------------------------------------------------- decoding */

/** An image on the way through: 8-bit RGBA, top row first, no stride padding. */
function blank(width, height) {
  return { width, height, rgba: new Uint8Array(width * height * 4) };
}

function put(image, x, y, r, g, b, a) {
  const i = (y * image.width + x) * 4;
  image.rgba[i] = r;
  image.rgba[i + 1] = g;
  image.rgba[i + 2] = b;
  image.rgba[i + 3] = a;
}

/** Read the palette that follows a BITMAPINFOHEADER: BGRx, four bytes each. */
function readPalette(buf, at, count) {
  const palette = [];
  for (let i = 0; i < count; i++) {
    const o = at + i * 4;
    palette.push([buf[o + 2], buf[o + 1], buf[o], 255]);
  }
  return palette;
}

/** The pixel data of a DIB, given its header.  Shared by the .bmp reader and
 *  the .ico one, which is the whole reason it takes a header object: an icon is
 *  a BITMAPINFOHEADER whose biHeight counts the AND mask rows as well, so the
 *  height it decodes is not the height the header states. */
function decodeDib(buf, header, dataAt, height) {
  const { width, bitCount, compression, palette, topDown } = header;
  const image = blank(width, height);
  const row = (y) => (topDown ? y : height - 1 - y);
  const paletted = (index) => palette[index] ?? [0, 0, 0, 255];

  if (compression === 0) {
    const stride = Math.floor((width * bitCount + 31) / 32) * 4;
    for (let y = 0; y < height; y++) {
      const base = dataAt + y * stride;
      for (let x = 0; x < width; x++) {
        let c;
        if (bitCount === 1) {
          c = paletted((buf[base + (x >> 3)] >> (7 - (x & 7))) & 1);
        } else if (bitCount === 4) {
          const byte = buf[base + (x >> 1)];
          c = paletted((x & 1) === 0 ? byte >> 4 : byte & 15);
        } else if (bitCount === 8) {
          c = paletted(buf[base + x]);
        } else if (bitCount === 24) {
          const o = base + x * 3;
          c = [buf[o + 2], buf[o + 1], buf[o], 255];
        } else if (bitCount === 32) {
          const o = base + x * 4;
          c = [buf[o + 2], buf[o + 1], buf[o], 255];
        } else {
          throw new Error("IQ Pokyd: " + bitCount + " bits per pixel is not a"
            + " format this archive contains; nothing here decodes it.");
        }
        put(image, x, row(y), c[0], c[1], c[2], c[3]);
      }
    }
    return image;
  }

  if (compression === 1 || compression === 2) {
    /* RLE8 and RLE4.  Pixels the run-length stream never reaches keep palette
       entry 0, which is what Windows leaves them as. */
    const rle4 = compression === 2;
    let p = dataAt;
    let x = 0;
    let y = 0;
    const set = (index) => {
      if (x < width && y < height) {
        const c = paletted(index);
        put(image, x, row(y), c[0], c[1], c[2], c[3]);
      }
      x++;
    };
    for (;;) {
      if (p + 1 >= buf.length) break;
      const count = buf[p++];
      const value = buf[p++];
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          set(rle4 ? (i & 1 ? value & 15 : value >> 4) : value);
        }
      } else if (value === 0) {            /* end of line */
        x = 0;
        y++;
      } else if (value === 1) {            /* end of bitmap */
        break;
      } else if (value === 2) {            /* delta */
        x += buf[p++];
        y += buf[p++];
      } else {                             /* absolute run */
        if (rle4) {
          for (let i = 0; i < value; i++) {
            const byte = buf[p + (i >> 1)];
            set((i & 1) === 0 ? byte >> 4 : byte & 15);
          }
          p += Math.ceil(value / 2);
        } else {
          for (let i = 0; i < value; i++) set(buf[p + i]);
          p += value;
        }
        if ((p - dataAt) & 1) p++;         /* runs are word-aligned */
      }
    }
    return image;
  }

  throw new Error("IQ Pokyd: BITMAPINFOHEADER compression " + compression
    + " is not a format this archive contains; nothing here decodes it.");
}

/** A .bmp file.  Everything in the archive is a 40-byte BITMAPINFOHEADER at
 *  1, 4, 8 or 24 bits, uncompressed or RLE. */
export function decodeBmp(buf) {
  if (buf[0] !== 0x42 || buf[1] !== 0x4d) {
    throw new Error("IQ Pokyd: not a BMP (no 'BM' at the front).");
  }
  const dataAt = buf.readUInt32LE(10);
  const headerSize = buf.readUInt32LE(14);
  if (headerSize < 40) {
    throw new Error("IQ Pokyd: a " + headerSize + "-byte DIB header is not a"
      + " format this archive contains.");
  }
  const width = buf.readInt32LE(18);
  const signedHeight = buf.readInt32LE(22);
  const bitCount = buf.readUInt16LE(28);
  const compression = buf.readUInt32LE(30);
  let clrUsed = buf.readUInt32LE(46);
  if (clrUsed === 0 && bitCount <= 8) clrUsed = 1 << bitCount;
  const palette = readPalette(buf, 14 + headerSize, clrUsed);
  const header = { width, bitCount, compression, palette, topDown: signedHeight < 0 };
  return decodeDib(buf, header, dataAt, Math.abs(signedHeight));
}

/** A .ico file: a directory, then one DIB per size whose biHeight counts the
 *  colour rows and the AND mask rows together.  The mask is what makes an icon
 *  transparent, and it is why these are the only images here with an alpha
 *  channel that is not all 255. */
export function decodeIco(buf) {
  const reserved = buf.readUInt16LE(0);
  const type = buf.readUInt16LE(2);
  if (reserved !== 0 || type !== 1) {
    throw new Error("IQ Pokyd: not an ICO (reserved/type is "
      + reserved + "/" + type + ").");
  }
  const count = buf.readUInt16LE(4);
  const images = [];
  for (let i = 0; i < count; i++) {
    const offset = buf.readUInt32LE(6 + i * 16 + 12);
    if (buf.readUInt32LE(offset) === 0x474e5089) {
      throw new Error("IQ Pokyd: a PNG-compressed icon entry is not a format"
        + " this archive contains (it is a Vista thing, and this is 2005).");
    }
    const headerSize = buf.readUInt32LE(offset);
    const width = buf.readInt32LE(offset + 4);
    const height = buf.readInt32LE(offset + 8) / 2;    /* colour + mask */
    const bitCount = buf.readUInt16LE(offset + 14);
    const compression = buf.readUInt32LE(offset + 16);
    let clrUsed = buf.readUInt32LE(offset + 32);
    if (clrUsed === 0 && bitCount <= 8) clrUsed = 1 << bitCount;
    const palette = readPalette(buf, offset + headerSize, clrUsed);
    const colourAt = offset + headerSize + clrUsed * 4;
    const header = { width, bitCount, compression, palette, topDown: false };
    const image = decodeDib(buf, header, colourAt, height);

    /* The AND mask: 1 bit per pixel, bottom-up, rows padded to four bytes.
       A set bit means "leave the screen alone", which is transparent here. */
    const colourStride = Math.floor((width * bitCount + 31) / 32) * 4;
    const maskAt = colourAt + colourStride * height;
    const maskStride = Math.floor((width + 31) / 32) * 4;
    for (let y = 0; y < height; y++) {
      const base = maskAt + y * maskStride;
      for (let x = 0; x < width; x++) {
        const bit = (buf[base + (x >> 3)] >> (7 - (x & 7))) & 1;
        if (bit === 1) image.rgba[((height - 1 - y) * width + x) * 4 + 3] = 0;
      }
    }
    images.push(image);
  }
  return images;
}

/* ---------------------------------------------------------------- encoding */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/* The CRC-32 the PNG spec prints, built once. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head, body, tail]);
}

/** One row, filtered by one of the five PNG filter types, into `out`. */
function filterRow(type, row, prev, bpp, out) {
  for (let i = 0; i < row.length; i++) {
    const a = i >= bpp ? row[i - bpp] : 0;
    const b = prev[i];
    const c = i >= bpp ? prev[i - bpp] : 0;
    let v;
    if (type === 0) {
      v = row[i];
    } else if (type === 1) {
      v = row[i] - a;
    } else if (type === 2) {
      v = row[i] - b;
    } else if (type === 3) {
      v = row[i] - ((a + b) >> 1);
    } else {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      v = row[i] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
    }
    out[i] = v & 0xff;
  }
}

/** The sum of signed magnitudes the PNG spec suggests for choosing a filter row
 *  by row.  It is a guess about the deflate that follows, which is why the
 *  caller tries it against four fixed filters rather than trusting it. */
function absSum(bytes) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) {
    sum += bytes[i] < 128 ? bytes[i] : 256 - bytes[i];
  }
  return sum;
}

function filterAll(raw, width, height, bpp, strategy) {
  const stride = width * bpp;
  const out = Buffer.alloc((stride + 1) * height);
  let prev = Buffer.alloc(stride);
  const work = Buffer.alloc(stride);
  const best = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const row = raw.subarray(y * stride, (y + 1) * stride);
    let type = strategy;
    if (strategy === "adaptive") {
      let bestSum = Infinity;
      for (let t = 0; t < 5; t++) {
        filterRow(t, row, prev, bpp, work);
        const sum = absSum(work);
        if (sum < bestSum) {
          bestSum = sum;
          type = t;
          work.copy(best);
        }
      }
      best.copy(out, y * (stride + 1) + 1);
    } else {
      filterRow(type, row, prev, bpp, work);
      work.copy(out, y * (stride + 1) + 1);
    }
    out[y * (stride + 1)] = type;
    prev = row;
  }
  return out;
}

/** Deflate the image five ways and keep the smallest.  See the header: on this
 *  archive the winner is "no filter at all" more often than not, because most
 *  of these images are palette indices and the delta between two indices means
 *  nothing at all. */
function smallestIdat(raw, width, height, bpp) {
  let best = null;
  for (const strategy of ["adaptive", 0, 1, 2, 4]) {
    const deflated = deflateSync(filterAll(raw, width, height, bpp, strategy),
      { level: 9 });
    if (best === null || deflated.length < best.length) best = deflated;
  }
  return best;
}

function colourKey(rgba, i) {
  return ((rgba[i * 4] << 24) | (rgba[i * 4 + 1] << 16)
    | (rgba[i * 4 + 2] << 8) | rgba[i * 4 + 3]) >>> 0;
}

/** Encode an RGBA image as PNG, choosing the colour type that fits it: indexed
 *  when 256 colours are enough, truecolour when it is opaque, RGBA otherwise.
 *  Every branch is lossless -- no quantisation, ever. */
export function encodePng(image) {
  const { width, height, rgba } = image;
  const pixels = width * height;

  /* Distinct RGBA values, in the order they first appear, giving up at 257. */
  const seen = new Set();
  let opaque = true;
  for (let i = 0; i < pixels; i++) {
    if (rgba[i * 4 + 3] !== 255) opaque = false;
    if (seen.size < 257) seen.add(colourKey(rgba, i));
  }

  let colourType;
  let bpp;
  let raw;
  let extra = Buffer.alloc(0);

  if (seen.size <= 256) {
    /* Indexed.  tRNS covers a prefix of the palette, so the entries that are
       not fully opaque have to come first. */
    const colours = [...seen].map((key) => [
      (key >>> 24) & 0xff, (key >>> 16) & 0xff, (key >>> 8) & 0xff, key & 0xff,
    ]);
    colours.sort((a, b) => (a[3] === 255 ? 1 : 0) - (b[3] === 255 ? 1 : 0));
    const index = new Map();
    colours.forEach((c, i) => {
      index.set(((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | c[3]) >>> 0, i);
    });

    colourType = 3;
    bpp = 1;
    raw = Buffer.alloc(pixels);
    for (let i = 0; i < pixels; i++) raw[i] = index.get(colourKey(rgba, i));

    const plte = Buffer.alloc(colours.length * 3);
    colours.forEach((c, i) => {
      plte[i * 3] = c[0];
      plte[i * 3 + 1] = c[1];
      plte[i * 3 + 2] = c[2];
    });
    extra = chunk("PLTE", plte);

    const transparent = colours.filter((c) => c[3] !== 255).length;
    if (transparent > 0) {
      const trns = Buffer.alloc(transparent);
      for (let i = 0; i < transparent; i++) trns[i] = colours[i][3];
      extra = Buffer.concat([extra, chunk("tRNS", trns)]);
    }
  } else if (opaque) {
    colourType = 2;
    bpp = 3;
    raw = Buffer.alloc(pixels * 3);
    for (let i = 0; i < pixels; i++) {
      raw[i * 3] = rgba[i * 4];
      raw[i * 3 + 1] = rgba[i * 4 + 1];
      raw[i * 3 + 2] = rgba[i * 4 + 2];
    }
  } else {
    colourType = 6;
    bpp = 4;
    raw = Buffer.from(rgba);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;             /* bit depth; 8 everywhere, indexed included */
  ihdr[9] = colourType;
  ihdr[10] = 0;            /* deflate */
  ihdr[11] = 0;            /* adaptive filtering */
  ihdr[12] = 0;            /* no interlace */

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    extra,
    chunk("IDAT", smallestIdat(raw, width, height, bpp)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ----------------------------------------------------------- the whole set */

/** The output name for a resource, from the archive's own filename. */
function assetName(rcPath, suffix) {
  const base = rcPath.replace(/\\/g, "/").split("/").pop().toLowerCase()
    .replace(/\.(bmp|ico)$/, "");
  return base + (suffix === undefined ? "" : "-" + suffix) + ".png";
}

/** Decode everything src/app/resources.ts lists.  Returns the bytes to write,
 *  the names to write them under, and enough about each for the manifest. */
export function readAssets() {
  const files = [];
  const bitmaps = [];
  const icons = [];

  for (const entry of BITMAPS) {
    const found = resolveInArchive(entry.file);
    const source = readFileSync(found.path);
    const image = decodeBmp(source);
    const name = assetName(entry.file);
    files.push({ name, bytes: encodePng(image) });
    bitmaps.push({
      id: entry.id,
      name,
      width: image.width,
      height: image.height,
      source: entry.file,
      onDisk: found.name,
      sourceBytes: source.length,
    });
  }

  for (const entry of ICONS) {
    const found = resolveInArchive(entry.file);
    const source = readFileSync(found.path);
    const sizes = [];
    for (const image of decodeIco(source)) {
      const name = assetName(entry.file, image.width + "x" + image.height);
      files.push({ name, bytes: encodePng(image) });
      sizes.push({ name, width: image.width, height: image.height });
    }
    icons.push({
      id: entry.id,
      source: entry.file,
      onDisk: found.name,
      sourceBytes: source.length,
      sizes,
    });
  }

  const favicon = resolveInArchive(FAVICON_SOURCE);
  files.push({ name: FAVICON_NAME, bytes: readFileSync(favicon.path) });

  return { files, bitmaps, icons };
}

/* --------------------------------------------------------------- the module */

/** A JavaScript identifier for an image, from the author's symbol. */
function importName(id, suffix) {
  const stem = id.replace(/^ID[BIR]_/, "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return "img_" + stem + (suffix === undefined ? "" : "_" + suffix);
}

export function renderModule(assets) {
  const lines = [];
  const w = (s) => lines.push(s);

  w("/* IQ Pokyd - src/app/assets.ts - GENERATED by tools/extract-assets.mjs.");
  w("   Phase 6.2 of PLAN.md.  Do not edit it: run the extractor.");
  w("");
  w("   Every image src/app/resources.ts lists, decoded out of the archive and");
  w("   re-encoded as a lossless PNG, with one Vite import each so that the build");
  w("   fingerprints and emits them.  The URLs are what phase 6.3 draws with; the");
  w("   sizes are the author's, in pixels, and are here because a menu bitmap that");
  w("   is 14x14 has to be told so before it is on the screen.");
  w("");
  w("   The filenames are the archive's own, lowercased -- see the extractor's");
  w("   header for why, and for the one file whose case had to be folded.");
  w("*/");
  w("");

  const imports = [];
  for (const b of assets.bitmaps) imports.push([importName(b.id), b.name]);
  for (const icon of assets.icons) {
    for (const size of icon.sizes) {
      imports.push([importName(icon.id, size.width + "x" + size.height), size.name]);
    }
  }
  imports.push(["faviconUrl", FAVICON_NAME]);
  for (const [name, file] of imports) {
    w("import " + name + " from \"./assets/" + file + "\";");
  }
  w("");

  w("/** One picture out of the author's `res/` directory. */");
  w("export interface AssetImage {");
  w("  /** The author's symbol, spelled as src/app/resources.ts spells it. */");
  w("  id: string;");
  w("  /** The URL the bundler gave it.  Read it from here, never build it. */");
  w("  url: string;");
  w("  width: number;");
  w("  height: number;");
  w("  /** What the .rc called the file, backslash and original case and all. */");
  w("  source: string;");
  w("}");
  w("");

  w("/** The bitmaps, keyed by the author's symbol. */");
  w("export const BITMAP_ASSETS: Record<string, AssetImage> = {");
  for (const b of assets.bitmaps) {
    w("  " + b.id + ": {");
    w("    id: \"" + b.id + "\",");
    w("    url: " + importName(b.id) + ",");
    w("    width: " + b.width + ", height: " + b.height + ",");
    w("    source: " + JSON.stringify(b.source) + ",");
    w("  },");
  }
  w("};");
  w("");

  w("/** The icons.  Each .ico in the archive holds more than one size, so each");
  w(" *  entry is a list, in the order the file's own directory gives them. */");
  w("export const ICON_ASSETS: Record<string, AssetImage[]> = {");
  for (const icon of assets.icons) {
    w("  " + icon.id + ": [");
    for (const size of icon.sizes) {
      w("    {");
      w("      id: \"" + icon.id + "\",");
      w("      url: " + importName(icon.id, size.width + "x" + size.height) + ",");
      w("      width: " + size.width + ", height: " + size.height + ",");
      w("      source: " + JSON.stringify(icon.source) + ",");
      w("    },");
    }
    w("  ],");
  }
  w("};");
  w("");

  w("/** `res/IQPokyd.ico`, copied out of the archive byte for byte.  index.html");
  w(" *  links it as the tab icon; nothing else should need it. */");
  w("export const FAVICON_URL: string = faviconUrl;");
  w("");

  return lines.join("\r\n");
}

/* ------------------------------------------------------------------ driving */

function dump(assets) {
  const png = (name) => assets.files.find((f) => f.name === name).bytes.length;
  console.log("bitmaps");
  for (const b of assets.bitmaps) {
    console.log("  " + b.id.padEnd(24)
      + (b.width + "x" + b.height).padStart(9) + "  "
      + b.source.padEnd(24) + String(b.sourceBytes).padStart(8) + " B  ->  "
      + b.name.padEnd(22) + String(png(b.name)).padStart(8) + " B");
  }
  console.log("icons");
  for (const icon of assets.icons) {
    console.log("  " + icon.id.padEnd(24) + icon.source
      + " (" + icon.sourceBytes + " B)");
    for (const size of icon.sizes) {
      console.log("      " + (size.width + "x" + size.height).padStart(9) + "  "
        + size.name.padEnd(22) + String(png(size.name)).padStart(8) + " B");
    }
  }
}

const invokedDirectly = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  const assets = readAssets();
  const rendered = renderModule(assets);

  if (process.argv.includes("--dump")) {
    dump(assets);
  } else if (process.argv.includes("--check")) {
    const stale = [];
    for (const file of assets.files) {
      const path = join(OUT_DIR, file.name);
      if (!existsSync(path) || !readFileSync(path).equals(file.bytes)) {
        stale.push("src/app/assets/" + file.name);
      }
    }
    let current = "";
    try { current = readFileSync(MODULE_PATH, "utf8"); } catch { /* not there yet */ }
    if (current !== rendered) stale.push("src/app/assets.ts");

    if (stale.length === 0) {
      console.log("src/app/assets/ is up to date with the archive ("
        + assets.files.length + " files).");
    } else {
      console.error("stale -- run node tools/extract-assets.mjs\n  "
        + stale.join("\n  "));
      process.exit(1);
    }
  } else {
    mkdirSync(OUT_DIR, { recursive: true });
    let out = 0;
    for (const file of assets.files) {
      writeFileSync(join(OUT_DIR, file.name), file.bytes);
      out += file.bytes.length;
    }
    writeFileSync(MODULE_PATH, rendered);
    const was = assets.bitmaps.concat(assets.icons)
      .reduce((n, a) => n + a.sourceBytes, 0);
    console.log("src/app/assets/: " + assets.bitmaps.length + " bitmaps and "
      + assets.icons.length + " icons in " + assets.files.length + " files, "
      + out + " bytes -- the archive's own were " + was + ".");
  }
}
