import {
  PDFDocument,
  StandardFonts,
  type PDFPage,
  type PDFFont,
  rgb,
  type RGB,
} from "pdf-lib";
import QRCode from "qrcode";
import type { Song } from "./types.ts";
import {
  DECK_CODE,
  GRID,
  MARGIN_MM,
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  TRIM_MM,
  artboardBox,
  cardOrigin,
  mmToPt,
  playUrl,
  trimBox,
} from "./card-layout.ts";
import {
  NEON_RINGS as NEON_RINGS_CMYK,
  PURE_BLACK,
  cardColor,
  type Cmyk,
} from "./card-colors.ts";

const TEXT_MUTED = rgb(0.35, 0.35, 0.38);
const WHITE = rgb(1, 1, 1);

function cmykToRgb([c, m, y, k]: Cmyk): RGB {
  const c1 = c / 100;
  const m1 = m / 100;
  const y1 = y / 100;
  const k1 = k / 100;
  return rgb((1 - c1) * (1 - k1), (1 - m1) * (1 - k1), (1 - y1) * (1 - k1));
}

const TEXT = cmykToRgb(PURE_BLACK);
const QR_BLACK = cmykToRgb(PURE_BLACK);
const NEON_RINGS = NEON_RINGS_CMYK.map(cmykToRgb);

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

function fitSingleLine(
  text: string,
  font: PDFFont,
  maxSize: number,
  maxWidth: number,
): { text: string; size: number } {
  let size = maxSize;
  let value = text;
  while (size > 4 && font.widthOfTextAtSize(value, size) > maxWidth) {
    size -= 0.5;
  }
  if (font.widthOfTextAtSize(value, size) <= maxWidth) {
    return { text: value, size };
  }
  while (value.length > 3 && font.widthOfTextAtSize(`${value}…`, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return { text: `${value}…`, size };
}

/** pdf-lib bottom-left box from layout mm (page origin top-left). */
function boxFromMm(box: { x: number; y: number; width: number; height: number }) {
  const x = mmToPt(box.x);
  const y = mmToPt(PAGE_HEIGHT_MM - box.y - box.height);
  const w = mmToPt(box.width);
  const h = mmToPt(box.height);
  return { x, y, w, h };
}

/** Baseline Y for text whose cap line sits at pageTopMm (mm from physical page top). */
function baselineFromPageTop(pageTopMm: number, fontSize: number): number {
  return mmToPt(PAGE_HEIGHT_MM - pageTopMm) - fontSize * 0.72;
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  x: number,
  width: number,
  baselineY: number,
  size: number,
  font: PDFFont,
  color: RGB,
) {
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: x + (width - textWidth) / 2,
    y: baselineY,
    size,
    font,
    color,
  });
}

function drawArc(
  page: PDFPage,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  color: RGB,
  thickness: number,
) {
  const steps = Math.max(12, Math.ceil(Math.abs(endAngle - startAngle) * 10));
  for (let i = 0; i < steps; i++) {
    const t1 = startAngle + ((endAngle - startAngle) * i) / steps;
    const t2 = startAngle + ((endAngle - startAngle) * (i + 1)) / steps;
    page.drawLine({
      start: { x: cx + radius * Math.cos(t1), y: cy + radius * Math.sin(t1) },
      end: { x: cx + radius * Math.cos(t2), y: cy + radius * Math.sin(t2) },
      thickness,
      color,
    });
  }
}

function drawNeonRings(
  page: PDFPage,
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
      drawArc(page, cx, cy, radius, startAngle, startAngle + arcLength, color, stroke);
    }
  }
}

function drawFilmReelIcon(page: PDFPage, x: number, y: number, scale: number) {
  const r = 2.2 * scale;
  const gap = 3.8 * scale;
  const stroke = 0.55 * scale;

  page.drawCircle({ x, y, size: r * 2, borderColor: WHITE, borderWidth: stroke });
  page.drawCircle({
    x: x + gap,
    y,
    size: r * 2,
    borderColor: WHITE,
    borderWidth: stroke,
  });
  page.drawLine({
    start: { x: x + r, y: y + r },
    end: { x: x + gap - r, y: y + r },
    thickness: stroke,
    color: WHITE,
  });
  page.drawLine({
    start: { x: x + r, y: y - r },
    end: { x: x + gap - r, y: y - r },
    thickness: stroke,
    color: WHITE,
  });
}

function drawCropMarks(page: PDFPage, trim: { x: number; y: number; width: number; height: number }) {
  const markLen = mmToPt(3);
  const offset = mmToPt(1.5);
  const { x, y, w, h } = boxFromMm(trim);

  const corners = [
    { x, y: y + h, hx: -1, vy: 1 },
    { x: x + w, y: y + h, hx: 1, vy: 1 },
    { x, y, hx: -1, vy: -1 },
    { x: x + w, y, hx: 1, vy: -1 },
  ] as const;

  for (const corner of corners) {
    page.drawLine({
      start: { x: corner.x, y: corner.y },
      end: { x: corner.x + corner.hx * offset, y: corner.y },
      thickness: 0.25,
      color: TEXT,
    });
    page.drawLine({
      start: { x: corner.x, y: corner.y },
      end: { x: corner.x, y: corner.y + corner.vy * offset },
      thickness: 0.25,
      color: TEXT,
    });
    page.drawLine({
      start: { x: corner.x + corner.hx * offset, y: corner.y },
      end: { x: corner.x + corner.hx * markLen, y: corner.y },
      thickness: 0.25,
      color: TEXT,
    });
    page.drawLine({
      start: { x: corner.x, y: corner.y + corner.vy * offset },
      end: { x: corner.x, y: corner.y + corner.vy * markLen },
      thickness: 0.25,
      color: TEXT,
    });
  }
}

function drawRegistrationMarks(page: PDFPage, label: string, font: PDFFont) {
  const pageW = mmToPt(PAGE_WIDTH_MM);
  const pageH = mmToPt(PAGE_HEIGHT_MM);
  const arm = mmToPt(6);
  const inset = mmToPt(MARGIN_MM / 2);

  const marks: Array<[number, number, number, number]> = [
    [inset, pageH - inset, arm, 0],
    [inset, pageH - inset, 0, -arm],
    [pageW - inset, pageH - inset, -arm, 0],
    [pageW - inset, pageH - inset, 0, -arm],
    [inset, inset, arm, 0],
    [inset, inset, 0, arm],
    [pageW - inset, inset, -arm, 0],
    [pageW - inset, inset, 0, arm],
  ];

  for (const [x, y, dx, dy] of marks) {
    page.drawLine({
      start: { x, y },
      end: { x: x + dx, y: y + dy },
      thickness: 0.35,
      color: TEXT,
    });
  }

  page.drawText(label, {
    x: inset,
    y: pageH - inset - mmToPt(5),
    size: 8,
    font,
    color: TEXT,
  });
}

async function createQrPng(url: string): Promise<Uint8Array> {
  const dataUrl = await QRCode.toDataURL(url, {
    margin: 1,
    width: 1000,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  return Uint8Array.from(Buffer.from(dataUrl.split(",")[1], "base64"));
}

async function drawScanCard(
  pdf: PDFDocument,
  page: PDFPage,
  cellX: number,
  cellY: number,
  song: Song,
  baseUrl: string,
  seed: number,
) {
  const art = artboardBox(cellX, cellY);
  const trim = trimBox(cellX, cellY);
  const artBox = boxFromMm(art);
  const { x, y, w, h } = boxFromMm(trim);
  const cx = x + w / 2;
  const cy = y + h / 2;

  page.drawRectangle({
    x: artBox.x,
    y: artBox.y,
    width: artBox.w,
    height: artBox.h,
    color: WHITE,
  });

  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: QR_BLACK,
  });

  drawNeonRings(page, cx, cy, w * 0.49, seed % 7);

  const qrSizeMm = TRIM_MM * 0.4;
  const qrPadMm = 2;
  const whiteBoxMm = qrSizeMm + qrPadMm * 2;
  const whiteSize = mmToPt(whiteBoxMm);
  const qrSize = mmToPt(qrSizeMm);

  page.drawRectangle({
    x: cx - whiteSize / 2,
    y: cy - whiteSize / 2,
    width: whiteSize,
    height: whiteSize,
    color: WHITE,
  });

  const qrPng = await createQrPng(playUrl(baseUrl, song.id));
  const qrImage = await pdf.embedPng(qrPng);
  page.drawImage(qrImage, {
    x: cx - qrSize / 2,
    y: cy - qrSize / 2,
    width: qrSize,
    height: qrSize,
  });

  drawCropMarks(page, trim);
}

function drawInfoCard(
  page: PDFPage,
  cellX: number,
  cellY: number,
  song: Song,
  colorIndex: number,
  bold: PDFFont,
  boldOblique: PDFFont,
) {
  const art = artboardBox(cellX, cellY);
  const trim = trimBox(cellX, cellY);
  const artBox = boxFromMm(art);
  const { x, y, w, h } = boxFromMm(trim);
  const innerW = w - mmToPt(6);
  const bg = cmykToRgb(cardColor(colorIndex));

  page.drawRectangle({
    x: artBox.x,
    y: artBox.y,
    width: artBox.w,
    height: artBox.h,
    color: WHITE,
  });

  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: bg,
  });

  drawFilmReelIcon(page, x + mmToPt(3.5), y + h - mmToPt(7), 1.1);

  const artistLines = wrapText(song.artist, 18, 2);
  const artistSize = artistLines.length > 1 ? 7.2 : 8;
  let pageTopMm = trim.y + 8.5;
  for (const line of artistLines) {
    const size = fitSingleLine(line, bold, artistSize, innerW).size;
    drawCenteredText(
      page,
      line,
      x,
      w,
      baselineFromPageTop(pageTopMm, size),
      size,
      bold,
      TEXT,
    );
    pageTopMm += artistLines.length > 1 ? 2.6 : 2.8;
  }

  const yearText = String(song.year);
  const yearSize = fitSingleLine(
    yearText,
    bold,
    yearText.length >= 4 ? 32 : 34,
    innerW,
  ).size;
  drawCenteredText(
    page,
    yearText,
    x,
    w,
    baselineFromPageTop(trim.y + TRIM_MM * 0.38, yearSize),
    yearSize,
    bold,
    TEXT,
  );

  const titleLines = wrapText(song.title, 20, 2);
  pageTopMm = trim.y + TRIM_MM - 17;
  for (const line of titleLines) {
    const fitted = fitSingleLine(line, boldOblique, 8.6, innerW);
    drawCenteredText(
      page,
      fitted.text,
      x,
      w,
      baselineFromPageTop(pageTopMm, fitted.size),
      fitted.size,
      boldOblique,
      TEXT,
    );
    pageTopMm += 3.2;
  }

  if (song.movie) {
    const movieLine = wrapText(song.movie, 22, 1)[0] ?? "";
    const fittedMovie = fitSingleLine(movieLine, bold, 7.6, innerW);
    drawCenteredText(
      page,
      fittedMovie.text,
      x,
      w,
      baselineFromPageTop(pageTopMm, fittedMovie.size),
      fittedMovie.size,
      bold,
      TEXT,
    );
  }

  const codeSize = 5;
  const codeBaseline = baselineFromPageTop(trim.y + TRIM_MM - 5, codeSize);
  page.drawText(DECK_CODE, {
    x: x + mmToPt(2),
    y: codeBaseline,
    size: codeSize,
    font: bold,
    color: TEXT_MUTED,
  });
  const idWidth = bold.widthOfTextAtSize(song.id, codeSize);
  page.drawText(song.id, {
    x: x + w - mmToPt(8) + (mmToPt(7) - idWidth),
    y: codeBaseline,
    size: codeSize,
    font: bold,
    color: TEXT_MUTED,
  });

  drawCropMarks(page, trim);
}

export async function buildPreviewPdf(songs: Song[], baseUrl: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const boldOblique = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);
  const pageCount = Math.ceil(songs.length / GRID.cardsPerPage);

  for (let page = 0; page < pageCount; page++) {
    const startIndex = page * GRID.cardsPerPage;
    const frontPage = pdf.addPage([mmToPt(PAGE_WIDTH_MM), mmToPt(PAGE_HEIGHT_MM)]);
    const backPage = pdf.addPage([mmToPt(PAGE_WIDTH_MM), mmToPt(PAGE_HEIGHT_MM)]);
    const count = Math.min(GRID.cardsPerPage, songs.length - startIndex);

    drawRegistrationMarks(frontPage, "Disney Hitster — FRONT (scan / QR side)", bold);
    drawRegistrationMarks(backPage, "Disney Hitster — BACK (info side)", bold);

    for (let i = 0; i < count; i++) {
      const song = songs[startIndex + i];
      const frontOrigin = cardOrigin(i);
      await drawScanCard(
        pdf,
        frontPage,
        frontOrigin.x,
        frontOrigin.y,
        song,
        baseUrl,
        startIndex + i,
      );

      const backOrigin = cardOrigin(GRID.cardsPerPage - 1 - i);
      drawInfoCard(backPage, backOrigin.x, backOrigin.y, song, startIndex + i, bold, boldOblique);
    }
  }

  return pdf.save();
}
