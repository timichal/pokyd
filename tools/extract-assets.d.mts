/* IQ Pokyd - tools/extract-assets.d.mts - phase 6.2 of PLAN.md.

   What tools/extract-assets.mjs exports, for the one caller that is
   typechecked: test/app/assets.test.ts, which decodes the committed PNGs with
   a decoder of its own and compares them with the archive.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

/** 8-bit RGBA, top row first, no stride padding.  The one shape every decoder
 *  here produces and the only one encodePng() accepts. */
export interface RgbaImage {
  width: number;
  height: number;
  rgba: Uint8Array;
}

/** A file to write into src/app/assets/. */
export interface AssetFile {
  name: string;
  bytes: Buffer;
}

export interface AssetBitmap {
  /** The author's symbol, e.g. IDB_POZADIMALE. */
  id: string;
  /** The generated filename, e.g. "pozmale.png". */
  name: string;
  width: number;
  height: number;
  /** What the .rc called it, backslash and original case and all. */
  source: string;
  /** What the archive actually calls it, which is not always `source`. */
  onDisk: string;
  sourceBytes: number;
}

export interface AssetIconSize {
  name: string;
  width: number;
  height: number;
}

export interface AssetIcon {
  id: string;
  source: string;
  onDisk: string;
  sourceBytes: number;
  sizes: AssetIconSize[];
}

export interface Assets {
  files: AssetFile[];
  bitmaps: AssetBitmap[];
  icons: AssetIcon[];
}

export declare const FAVICON_SOURCE: string;
export declare const FAVICON_NAME: string;

export declare function resolveInArchive(rcPath: string): { path: string; name: string };
export declare function decodeBmp(buf: Buffer): RgbaImage;
export declare function decodeIco(buf: Buffer): RgbaImage[];
export declare function encodePng(image: RgbaImage): Buffer;
export declare function readAssets(): Assets;
export declare function renderModule(assets: Assets): string;
