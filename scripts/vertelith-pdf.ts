import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { Song } from "./types.ts";
import {
  DECK_CODE,
  GRID,
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  SPOT_CUT,
  SPOT_VARNISH,
  SPOT_WHITE,
  TRIM_MM,
  artboardBox,
  cardOrigin,
  mmToPt,
  playUrl,
  trimBox,
} from "./card-layout.ts";
import {
  NEON_RINGS,
  PURE_BLACK,
  PURE_WHITE,
  TEXT_BLACK,
  cardColor,
  type Cmyk,
} from "./card-colors.ts";
import {
  drawPrintSheetLabelPdfKit,
  drawSheetRegMarksPdfKit,
} from "./sheet-regmarks.ts";

type PdfDoc = InstanceType<typeof PDFDocument>;

/** Fixed typography for info card backs — same on every card (no per-string scaling). */
const INFO_ARTIST_SIZE = 8;
const INFO_ARTIST_SIZE_2LINE = 7.2;
const INFO_YEAR_SIZE = 32;
const INFO_TITLE_SIZE = 8.6;
const INFO_MOVIE_SIZE = 7.6;
const INFO_CODE_SIZE = 5;

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function truncateText(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

async function createQrPng(url: string): Promise<Buffer> {
  const dataUrl = await QRCode.toDataURL(url, {
    margin: 1,
    width: 1000,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

function registerSpotColors(doc: PdfDoc) {
  doc.addSpotColor(SPOT_WHITE, 0, 0, 0, 0);
  doc.addSpotColor(SPOT_VARNISH, 0, 0, 0, 0);
  doc.addSpotColor(SPOT_CUT, 0, 0, 0, 0);
}

function setCmykFill(doc: PdfDoc, color: Cmyk) {
  doc.fillColor(color);
}

function setCmykStroke(doc: PdfDoc, color: Cmyk) {
  doc.strokeColor(color);
}

function drawArcCmyk(
  doc: PdfDoc,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  color: Cmyk,
  thickness: number,
) {
  const steps = Math.max(12, Math.ceil(Math.abs(endAngle - startAngle) * 10));
  setCmykStroke(doc, color);
  doc.lineWidth(thickness);
  for (let i = 0; i < steps; i++) {
    const t1 = startAngle + ((endAngle - startAngle) * i) / steps;
    const t2 = startAngle + ((endAngle - startAngle) * (i + 1)) / steps;
    doc
      .moveTo(cx + radius * Math.cos(t1), cy + radius * Math.sin(t1))
      .lineTo(cx + radius * Math.cos(t2), cy + radius * Math.sin(t2))
      .stroke();
  }
}

function drawArcSpot(
  doc: PdfDoc,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  spotName: string,
  thickness: number,
) {
  const steps = Math.max(12, Math.ceil(Math.abs(endAngle - startAngle) * 10));
  doc.strokeColor(spotName);
  doc.lineWidth(thickness);
  for (let i = 0; i < steps; i++) {
    const t1 = startAngle + ((endAngle - startAngle) * i) / steps;
    const t2 = startAngle + ((endAngle - startAngle) * (i + 1)) / steps;
    doc
      .moveTo(cx + radius * Math.cos(t1), cy + radius * Math.sin(t1))
      .lineTo(cx + radius * Math.cos(t2), cy + radius * Math.sin(t2))
      .stroke();
  }
}

function drawNeonRingsCmyk(
  doc: PdfDoc,
  cx: number,
  cy: number,
  maxRadius: number,
  seed: number,
) {
  const ringCount = 9;
  for (let ring = 0; ring < ringCount; ring++) {
    const radius = maxRadius * (0.34 + (ring / (ringCount - 1)) * 0.66);
    const segments = 2 + (ring % 4);
    const stroke = ring < 3 ? 0.9 : 1.1;

    for (let segment = 0; segment < segments; segment++) {
      const color = NEON_RINGS[(ring + segment + seed) % NEON_RINGS.length];
      const phase = seed * 0.55 + ring * 0.75 + segment * 1.35;
      const startAngle = phase + segment * ((Math.PI * 2) / segments) * 0.35;
      const arcLength = Math.PI * (0.28 + (segment % 3) * 0.12 + ring * 0.015);
      drawArcCmyk(doc, cx, cy, radius, startAngle, startAngle + arcLength, color, stroke);
    }
  }
}

function drawNeonRingsVarnish(
  doc: PdfDoc,
  cx: number,
  cy: number,
  maxRadius: number,
  seed: number,
) {
  const ringCount = 9;
  for (let ring = 0; ring < ringCount; ring++) {
    const radius = maxRadius * (0.34 + (ring / (ringCount - 1)) * 0.66);
    const segments = 2 + (ring % 4);
    const stroke = 1.2;

    for (let segment = 0; segment < segments; segment++) {
      const phase = seed * 0.55 + ring * 0.75 + segment * 1.35;
      const startAngle = phase + segment * ((Math.PI * 2) / segments) * 0.35;
      const arcLength = Math.PI * (0.28 + (segment % 3) * 0.12 + ring * 0.015);
      drawArcSpot(doc, cx, cy, radius, startAngle, startAngle + arcLength, SPOT_VARNISH, stroke);
    }
  }
}

function drawFilmReelIcon(doc: PdfDoc, x: number, y: number, scale: number) {
  const r = 2.2 * scale;
  const gap = 3.8 * scale;
  setCmykStroke(doc, PURE_WHITE);
  doc.lineWidth(0.55 * scale);
  doc.circle(x, y, r).stroke();
  doc.circle(x + gap, y, r).stroke();
  doc
    .moveTo(x + r, y + r)
    .lineTo(x + gap - r, y + r)
    .moveTo(x + r, y - r)
    .lineTo(x + gap - r, y - r)
    .stroke();
}

function drawCropMarks(doc: PdfDoc, trimX: number, trimY: number) {
  const markLen = mmToPt(3);
  const offset = mmToPt(1.5);
  const w = mmToPt(TRIM_MM);
  const h = mmToPt(TRIM_MM);
  setCmykStroke(doc, PURE_BLACK);
  doc.lineWidth(0.25);

  const corners = [
    [trimX, trimY],
    [trimX + w, trimY],
    [trimX, trimY + h],
    [trimX + w, trimY + h],
  ] as const;

  for (const [cx, cy] of corners) {
    doc
      .moveTo(cx + (cx === trimX ? -markLen : markLen), cy)
      .lineTo(cx + (cx === trimX ? -offset : offset), cy)
      .moveTo(cx, cy + (cy === trimY ? -markLen : markLen))
      .lineTo(cx, cy + (cy === trimY ? -offset : offset))
      .stroke();
  }
}

function drawCutContour(doc: PdfDoc, trimX: number, trimY: number) {
  doc.strokeColor(SPOT_CUT);
  doc.lineWidth(0.25);
  doc.rect(trimX, trimY, mmToPt(TRIM_MM), mmToPt(TRIM_MM)).stroke();
}

function drawRegistrationMarks(doc: PdfDoc, label: string) {
  doc.save();
  drawSheetRegMarksPdfKit(doc, { cmyk: PURE_BLACK });
  drawPrintSheetLabelPdfKit(doc, label, { cmyk: PURE_BLACK });
  doc.restore();
}

function trimCoords(cellX: number, cellY: number) {
  const art = artboardBox(cellX, cellY);
  const trim = trimBox(cellX, cellY);
  const trimX = mmToPt(trim.x);
  const trimY = mmToPt(trim.y);
  const trimW = mmToPt(trim.width);
  const trimH = mmToPt(trim.height);
  return {
    art,
    trim,
    trimX,
    trimY,
    trimW,
    trimH,
    cx: trimX + trimW / 2,
    cy: trimY + trimH / 2,
  };
}

function drawFilmReelIconSpot(doc: PdfDoc, x: number, y: number, scale: number) {
  const r = 2.2 * scale;
  const gap = 3.8 * scale;
  doc.strokeColor(SPOT_WHITE);
  doc.lineWidth(0.55 * scale);
  doc.circle(x, y, r).stroke();
  doc.circle(x + gap, y, r).stroke();
  doc
    .moveTo(x + r, y + r)
    .lineTo(x + gap - r, y + r)
    .moveTo(x + r, y - r)
    .lineTo(x + gap - r, y - r)
    .stroke();
}

/** Visible CMYK composite — drawn first so PDF viewers render every card. */
async function drawScanCardCmyk(
  doc: PdfDoc,
  cellX: number,
  cellY: number,
  song: Song,
  baseUrl: string,
  seed: number,
) {
  const { art, trimX, trimY, trimW, trimH, cx, cy } = trimCoords(cellX, cellY);

  setCmykFill(doc, PURE_WHITE);
  doc.rect(mmToPt(art.x), mmToPt(art.y), mmToPt(art.width), mmToPt(art.height)).fill();

  setCmykFill(doc, PURE_BLACK);
  doc.rect(trimX, trimY, trimW, trimH).fill();

  drawNeonRingsCmyk(doc, cx, cy, trimW * 0.49, seed % 7);

  const qrSizeMm = TRIM_MM * 0.4;
  const qrPadMm = 2;
  const whiteBoxMm = qrSizeMm + qrPadMm * 2;
  const whiteX = cx - mmToPt(whiteBoxMm / 2);
  const whiteY = cy - mmToPt(whiteBoxMm / 2);

  setCmykFill(doc, PURE_WHITE);
  doc.rect(whiteX, whiteY, mmToPt(whiteBoxMm), mmToPt(whiteBoxMm)).fill();

  const qrPng = await createQrPng(playUrl(baseUrl, song.id));
  doc.image(qrPng, cx - mmToPt(qrSizeMm / 2), cy - mmToPt(qrSizeMm / 2), {
    width: mmToPt(qrSizeMm),
    height: mmToPt(qrSizeMm),
  });

  drawCropMarks(doc, trimX, trimY);
}

function drawSpotWhitePlate(doc: PdfDoc, cellX: number, cellY: number, includeQrIsland: boolean) {
  const { art, trimX, trimY, trimW, trimH, cx, cy } = trimCoords(cellX, cellY);

  doc.fillColor(SPOT_WHITE);
  doc.rect(mmToPt(art.x), mmToPt(art.y), mmToPt(art.width), mmToPt(art.height)).fill();

  if (includeQrIsland) {
    const qrSizeMm = TRIM_MM * 0.4;
    const qrPadMm = 2;
    const whiteBoxMm = qrSizeMm + qrPadMm * 2;
    doc.rect(
      cx - mmToPt(whiteBoxMm / 2),
      cy - mmToPt(whiteBoxMm / 2),
      mmToPt(whiteBoxMm),
      mmToPt(whiteBoxMm),
    ).fill();
  } else {
    drawFilmReelIconSpot(doc, trimX + mmToPt(3.5), trimY + mmToPt(7), 1.1);
  }

  void trimW;
  void trimH;
}

function drawInfoCardCmyk(
  doc: PdfDoc,
  cellX: number,
  cellY: number,
  song: Song,
  colorIndex: number,
) {
  const { art, trimX, trimY, trimW, trimH } = trimCoords(cellX, cellY);

  setCmykFill(doc, PURE_WHITE);
  doc.rect(mmToPt(art.x), mmToPt(art.y), mmToPt(art.width), mmToPt(art.height)).fill();

  setCmykFill(doc, cardColor(colorIndex));
  doc.rect(trimX, trimY, trimW, trimH).fill();

  drawFilmReelIcon(doc, trimX + mmToPt(3.5), trimY + mmToPt(7), 1.1);

  doc.font("Helvetica-Bold");
  setCmykFill(doc, TEXT_BLACK);
  const artistLines = wrapText(song.artist, 18, 2);
  const artistSize = artistLines.length > 1 ? INFO_ARTIST_SIZE_2LINE : INFO_ARTIST_SIZE;
  let textY = trimY + mmToPt(8.5);
  doc.fontSize(artistSize);
  for (const line of artistLines) {
    doc.text(line, trimX, textY, { width: trimW, align: "center" });
    textY += mmToPt(artistLines.length > 1 ? 2.6 : 2.8);
  }

  const yearText = String(song.year);
  doc.fontSize(INFO_YEAR_SIZE);
  doc.text(yearText, trimX, trimY + trimH * 0.38, { width: trimW, align: "center" });

  doc.font("Helvetica-BoldOblique");
  const titleLines = wrapText(song.title, 20, 2);
  textY = trimY + trimH - mmToPt(17);
  doc.fontSize(INFO_TITLE_SIZE);
  for (const line of titleLines) {
    doc.text(line, trimX, textY, { width: trimW, align: "center" });
    textY += mmToPt(3.2);
  }

  if (song.movie) {
    doc.font("Helvetica-Bold");
    const movieLine = truncateText(wrapText(song.movie, 22, 1)[0] ?? "", 28);
    doc.fontSize(INFO_MOVIE_SIZE);
    doc.text(movieLine, trimX, textY, { width: trimW, align: "center" });
  }

  doc.font("Helvetica-Bold");
  doc.fontSize(INFO_CODE_SIZE);
  setCmykFill(doc, [0, 0, 0, 55]);
  doc.text(DECK_CODE, trimX + mmToPt(2), trimY + trimH - mmToPt(5));
  doc.text(song.id, trimX + trimW - mmToPt(8), trimY + trimH - mmToPt(5), {
    width: mmToPt(7),
    align: "right",
  });

  drawCropMarks(doc, trimX, trimY);
}

function drawScanCardSpots(doc: PdfDoc, cellX: number, cellY: number, seed: number) {
  const { trimX, trimY, trimW, trimH, cx, cy } = trimCoords(cellX, cellY);
  drawNeonRingsVarnish(doc, cx, cy, trimW * 0.49, seed % 7);
  drawCutContour(doc, trimX, trimY);
}

function drawInfoCardSpots(doc: PdfDoc, cellX: number, cellY: number) {
  const { trimX, trimY } = trimCoords(cellX, cellY);
  drawCutContour(doc, trimX, trimY);
}

export async function buildSpotWhitePdf(
  songs: Song[],
  side: "front" | "back",
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: [mmToPt(PAGE_WIDTH_MM), mmToPt(PAGE_HEIGHT_MM)],
      autoFirstPage: false,
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    registerSpotColors(doc);

    const pageCount = Math.ceil(songs.length / GRID.cardsPerPage);

    try {
      for (let page = 0; page < pageCount; page++) {
        doc.addPage();
        const startIndex = page * GRID.cardsPerPage;
        const count = Math.min(GRID.cardsPerPage, songs.length - startIndex);

        for (let i = 0; i < count; i++) {
          const indexOnPage = side === "back" ? GRID.cardsPerPage - 1 - i : i;
          const { x, y } = cardOrigin(indexOnPage);
          drawSpotWhitePlate(doc, x, y, side === "front");
        }
      }
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function buildVerteLithPdf(
  songs: Song[],
  baseUrl: string,
  side: "front" | "back",
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: [mmToPt(PAGE_WIDTH_MM), mmToPt(PAGE_HEIGHT_MM)],
      autoFirstPage: false,
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    registerSpotColors(doc);

    const pageCount = Math.ceil(songs.length / GRID.cardsPerPage);

    const run = async () => {
      for (let page = 0; page < pageCount; page++) {
        doc.addPage();
        const startIndex = page * GRID.cardsPerPage;
        const label =
          side === "front"
            ? "Disney Hitster — FRONT (scan / QR side)"
            : "Disney Hitster — BACK (info side)";

        const count = Math.min(GRID.cardsPerPage, songs.length - startIndex);
        const placements: Array<{ x: number; y: number; song: Song; seed: number }> = [];
        for (let i = 0; i < count; i++) {
          const song = songs[startIndex + i];
          const indexOnPage = side === "back" ? GRID.cardsPerPage - 1 - i : i;
          const { x, y } = cardOrigin(indexOnPage);
          placements.push({ x, y, song, seed: startIndex + i });
        }

        for (const { x, y, song, seed } of placements) {
          if (side === "front") {
            await drawScanCardCmyk(doc, x, y, song, baseUrl, seed);
          } else {
            drawInfoCardCmyk(doc, x, y, song, seed);
          }
        }

        for (const { x, y, seed } of placements) {
          if (side === "front") {
            drawScanCardSpots(doc, x, y, seed);
          } else {
            drawInfoCardSpots(doc, x, y);
          }
        }

        drawRegistrationMarks(doc, label);
      }
      doc.end();
    };

    run().catch(reject);
  });
}

/** CMYK composite only — no Spot_White, Spot_Varnish, or CutContour. */
export async function buildFlatCmykPdf(
  songs: Song[],
  baseUrl: string,
  side: "front" | "back",
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: [mmToPt(PAGE_WIDTH_MM), mmToPt(PAGE_HEIGHT_MM)],
      autoFirstPage: false,
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageCount = Math.ceil(songs.length / GRID.cardsPerPage);

    const run = async () => {
      for (let page = 0; page < pageCount; page++) {
        doc.addPage();
        const startIndex = page * GRID.cardsPerPage;
        const label =
          side === "front"
            ? "Disney Hitster — FRONT flat CMYK"
            : "Disney Hitster — BACK flat CMYK";

        const count = Math.min(GRID.cardsPerPage, songs.length - startIndex);

        for (let i = 0; i < count; i++) {
          const song = songs[startIndex + i];
          const indexOnPage = side === "back" ? GRID.cardsPerPage - 1 - i : i;
          const { x, y } = cardOrigin(indexOnPage);
          const seed = startIndex + i;

          if (side === "front") {
            await drawScanCardCmyk(doc, x, y, song, baseUrl, seed);
          } else {
            drawInfoCardCmyk(doc, x, y, song, seed);
          }
        }

        drawRegistrationMarks(doc, label);
      }
      doc.end();
    };

    run().catch(reject);
  });
}
