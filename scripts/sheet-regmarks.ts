import type { PDFPage, PDFFont, RGB } from "pdf-lib";
import PDFDocument from "pdfkit";
import {
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  REG_MARK_DIAMETER_MM,
  REG_MARK_INSET_MM,
  REG_MARK_SPACING_MM,
  mmToPt,
} from "./card-layout.ts";

type PdfKitDoc = InstanceType<typeof PDFDocument>;

export type RegMarkCenterMm = { cx: number; cy: number };

/** All regmark centers in mm (PDFKit top-left page origin). */
export function sheetRegMarkCentersMm(): RegMarkCenterMm[] {
  const inset = REG_MARK_INSET_MM;
  const spacing = REG_MARK_SPACING_MM;
  const right = PAGE_WIDTH_MM - inset;
  const bottom = PAGE_HEIGHT_MM - inset;
  const seen = new Set<string>();
  const marks: RegMarkCenterMm[] = [];

  const add = (cx: number, cy: number) => {
    const key = `${cx.toFixed(3)},${cy.toFixed(3)}`;
    if (seen.has(key)) return;
    seen.add(key);
    marks.push({ cx, cy });
  };

  // Corners
  add(inset, inset);
  add(right, inset);
  add(inset, bottom);
  add(right, bottom);

  // Top and bottom edges — every 30 cm along the outside
  for (let x = inset + spacing; x < right - 0.001; x += spacing) {
    add(x, inset);
    add(x, bottom);
  }

  // Left and right edges — every 30 cm along the outside
  for (let y = inset + spacing; y < bottom - 0.001; y += spacing) {
    add(inset, y);
    add(right, y);
  }

  return marks;
}

/** @deprecated Use sheetRegMarkCentersMm */
export function sheetRegMarkCornersMm(): RegMarkCenterMm[] {
  return sheetRegMarkCentersMm();
}

export function drawSheetRegMarksPdfKit(
  doc: PdfKitDoc,
  fill: { spotName: string } | { cmyk: [number, number, number, number] },
) {
  const radius = REG_MARK_DIAMETER_MM / 2;

  if ("spotName" in fill) {
    doc.fillColor(fill.spotName);
  } else {
    doc.fillColor(fill.cmyk);
  }

  for (const { cx, cy } of sheetRegMarkCentersMm()) {
    doc.circle(mmToPt(cx), mmToPt(cy), mmToPt(radius)).fill();
  }
}

export function drawSheetRegMarksPdfLib(page: PDFPage, color: RGB) {
  const radius = mmToPt(REG_MARK_DIAMETER_MM / 2);

  for (const { cx, cy } of sheetRegMarkCentersMm()) {
    page.drawCircle({
      x: mmToPt(cx),
      y: mmToPt(PAGE_HEIGHT_MM - cy),
      size: radius,
      color,
      borderWidth: 0,
    });
  }
}

export function drawPrintSheetLabelPdfKit(
  doc: PdfKitDoc,
  label: string,
  fill: { cmyk: [number, number, number, number] },
) {
  const inset = mmToPt(REG_MARK_INSET_MM);
  const pageH = mmToPt(PAGE_HEIGHT_MM);
  doc.fillColor(fill.cmyk);
  doc.fontSize(8).text(label, inset, pageH - inset - mmToPt(5), {
    width: mmToPt(80),
  });
}

export function drawPrintSheetLabelPdfLib(
  page: PDFPage,
  label: string,
  font: PDFFont,
  color: RGB,
) {
  const inset = mmToPt(REG_MARK_INSET_MM);
  const pageH = mmToPt(PAGE_HEIGHT_MM);
  page.drawText(label, {
    x: inset,
    y: pageH - inset - mmToPt(5),
    size: 8,
    font,
    color,
  });
}
