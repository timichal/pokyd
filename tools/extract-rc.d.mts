/* IQ Pokyd - tools/extract-rc.d.mts - phase 6.1 of PLAN.md.

   What tools/extract-rc.mjs exports, for the one caller that is typechecked:
   test/app/resources.test.ts, which re-runs the parse in memory and compares it
   with the committed src/app/resources.ts.

   The shapes are the generated module's own, imported from it rather than
   written out again -- the parser produces exactly what the module holds, and
   saying so in two places is how the two would drift.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

import type {
  RcAccelerators, RcDialog, RcImage, RcMenu, RcSharedId, RcVersion,
} from "../src/app/resources.ts";

export interface RcSymbols {
  byName: Map<string, number>;
  byValue: Map<number, string[]>;
  shared: RcSharedId[];
}

export interface ParsedRc {
  dialogs: Record<string, RcDialog>;
  menus: Record<string, RcMenu>;
  accelerators: Record<string, RcAccelerators>;
  bitmaps: RcImage[];
  icons: RcImage[];
  /** `block` is the VERSIONINFO string block's name, which the module drops. */
  version: RcVersion & { block: string | null };
  symbols: RcSymbols;
}

export declare const RES_DIR: string;
export declare function parseSymbols(text: string): RcSymbols;
export declare function parseRc(text: string, symbols: RcSymbols): ParsedRc;
export declare function readRc(): ParsedRc;
export declare function renderModule(parsed: ParsedRc): string;
