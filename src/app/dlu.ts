/* IQ Pokyd - src/app/dlu.ts - the two measurements the resource script cannot
   contain.  Phase 6.3 of PLAN.md.

   src/app/resources.ts holds the author's geometry in the units he wrote it in
   -- dialog units for the templates, an lfHeight for every font -- and
   deliberately makes neither of them a pixel, because neither is one until
   something has measured a font:

     - a dialog unit is a quarter of the font's average character width
       horizontally and an eighth of its cell height vertically (MapDialogRect),
       and `dluToPx` in resources.ts asks the caller for both.
     - a LOGFONT's lfHeight is a *cell* height when it is positive and an em
       size when it is negative (CreateFont).  PROSTRED.FU:918 writes
       `font.lfHeight = 20` for the conversation, so the hundred statics are 20
       pixels from the top of one line to the top of the next -- and 20 is not a
       CSS font-size, it is what `GetTextExtentPoint32(hDc,"a",1)` came back
       with at :951 and what the layout then counts in.

   Windows had the answers because it had the font.  So does a browser: a canvas
   2D context measures the face the visitor will actually get, which is the part
   that matters, because most visitors have no Trebuchet MS and the point of
   measuring is that the fallback lands on the author's 20 pixels anyway.

   Both functions take a whole CSS font-family list rather than one face, for
   the same reason: what gets measured has to be what gets drawn.

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code.
*/

import type { DialogBaseUnits } from "./resources.ts";

/* MSDN's own recipe for the base units of a dialog with a font of its own
   ("DLU"): the average character width is the width of these 52 letters over
   26, plus one, halved -- not the arithmetic mean, which is what makes it worth
   copying rather than inventing. */
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/* What a measurement costs is one canvas and one layout, and every caller wants
   the same three or four answers, so they are remembered by the exact font
   string that produced them. */
const cellCache = new Map<string, number>();
const baseCache = new Map<string, DialogBaseUnits>();

let context: CanvasRenderingContext2D | null | undefined;

/** The one canvas, made on first use.  `null` if this environment has no 2D
 *  context at all, which is not an error here -- see `FALLBACK` below. */
function measurer(): CanvasRenderingContext2D | null {
  if (context === undefined) {
    context = typeof document === "undefined"
      ? null
      : document.createElement("canvas").getContext("2d");
  }
  return context;
}

/* Measured on this machine, in Chrome 152, with Trebuchet MS present:
   a 100 px em of it is a 116.16 px cell, and 12 pt of it gives base units of
   7 x 19.  They are here so that a headless environment with no canvas still
   draws a window with the right proportions rather than no window at all; they
   are never used when there is anything to measure. */
const FALLBACK_CELL_RATIO = 1.1611;
const FALLBACK_BASE: DialogBaseUnits = { x: 7, y: 19 };

/** The cell height of `family` at a 1 px em, which is what turns one of the
 *  author's positive lfHeights into a CSS font-size.  Trebuchet MS comes back
 *  at about 1.161: its ascent and descent are 1923 and 455 of a 2048-unit em. */
export function cellRatio(family: string): number {
  const cached = cellCache.get(family);
  if (cached !== undefined) return cached;

  let ratio = FALLBACK_CELL_RATIO;
  const ctx = measurer();
  if (ctx !== null) {
    /* Measured at 100 px rather than 1 px and divided back down: a browser
       rounds these metrics, and at 1 px the rounding is the answer. */
    ctx.font = "100px " + family;
    const m = ctx.measureText(ALPHABET);
    const cell = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
    if (Number.isFinite(cell) && cell > 0) ratio = cell / 100;
  }
  cellCache.set(family, ratio);
  return ratio;
}

/** The CSS font-size that gives `family` a cell exactly `cell` pixels tall --
 *  a positive LOGFONT.lfHeight, in other words, answered for the font the
 *  visitor actually has.  `cell` itself is the line-height that goes with it. */
export function emForCellHeight(family: string, cell: number): number {
  return cell / cellRatio(family);
}

/** The horizontal and vertical dialog base units of a dialog whose template
 *  says `FONT size, face` -- 12-point Trebuchet MS for IDD_HLAVNI_OKNO.  The
 *  point size is converted the way CreateFont's caller does it, at 96 dpi:
 *  a 12-point font is a 16-pixel em. */
export function dialogBaseUnits(family: string, points: number): DialogBaseUnits {
  const px = Math.round((points * 96) / 72);
  const key = px + "px " + family;
  const cached = baseCache.get(key);
  if (cached !== undefined) return cached;

  let units = FALLBACK_BASE;
  const ctx = measurer();
  if (ctx !== null) {
    ctx.font = key;
    const m = ctx.measureText(ALPHABET);
    const height = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
    if (Number.isFinite(m.width) && m.width > 0 && Number.isFinite(height)) {
      units = {
        x: Math.floor((m.width / 26 + 1) / 2),
        y: Math.round(height),
      };
    }
  }
  baseCache.set(key, units);
  return units;
}
