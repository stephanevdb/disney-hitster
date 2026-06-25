export const MM_TO_PT = 72 / 25.4;

export const TRIM_MM = 50;
export const BLEED_MM = 1;
export const ARTBOARD_MM = TRIM_MM + BLEED_MM * 2;
export const PAGE_WIDTH_MM = 594;
export const PAGE_HEIGHT_MM = 841;
export const MARGIN_MM = 8;
export const GAP_MM = 2;
export const DECK_CODE = "DH";

export const SPOT_WHITE = "Spot_White";
export const SPOT_VARNISH = "Spot_Varnish";
export const SPOT_CUT = "CutContour";
export const SPOT_THRU_CUT = "Thru-cut";
export const SPOT_REGMARK = "Regmark";

/** Summa / sheet alignment circles at page corners (OPOS). */
export const REG_MARK_DIAMETER_MM = 5;
export const REG_MARK_INSET_MM = 5;
/** Additional solid regmarks along the sheet perimeter (outside edges). */
export const REG_MARK_SPACING_MM = 300;

export function mmToPt(mm: number) {
  return mm * MM_TO_PT;
}

export function computeGrid(pageWidthMm: number, pageHeightMm: number) {
  const pitchMm = TRIM_MM + GAP_MM;
  const usableWidth = pageWidthMm - MARGIN_MM * 2;
  const usableHeight = pageHeightMm - MARGIN_MM * 2;
  const cols = Math.floor((usableWidth + GAP_MM) / pitchMm);
  const rows = Math.floor((usableHeight + GAP_MM) / pitchMm);
  return {
    cols: Math.max(1, cols),
    rows: Math.max(1, rows),
    pitchMm,
    cardsPerPage: Math.max(1, cols) * Math.max(1, rows),
  };
}

export const GRID = computeGrid(PAGE_WIDTH_MM, PAGE_HEIGHT_MM);

export function cardOrigin(indexOnPage: number) {
  const col = indexOnPage % GRID.cols;
  const row = Math.floor(indexOnPage / GRID.cols);
  const x = MARGIN_MM + col * GRID.pitchMm;
  const y = MARGIN_MM + row * GRID.pitchMm;
  return { x, y };
}

/** Trim box within a card cell (1 mm bleed on each side). */
export function trimBox(cellX: number, cellY: number) {
  return {
    x: cellX + BLEED_MM,
    y: cellY + BLEED_MM,
    width: TRIM_MM,
    height: TRIM_MM,
  };
}

export function artboardBox(cellX: number, cellY: number) {
  return {
    x: cellX,
    y: cellY,
    width: ARTBOARD_MM,
    height: ARTBOARD_MM,
  };
}

export function playUrl(baseUrl: string, id: string) {
  return `${baseUrl.replace(/\/$/, "")}/play/${id}`;
}
