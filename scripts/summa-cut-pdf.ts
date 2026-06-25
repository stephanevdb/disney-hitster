import { PDFDocument, rgb } from "pdf-lib";
import type { Song } from "./types.ts";
import {
  GRID,
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  SPOT_REGMARK,
  SPOT_THRU_CUT,
  TRIM_MM,
  cardOrigin,
  mmToPt,
  trimBox,
} from "./card-layout.ts";
import { PdfOcgLayerRegistry } from "./pdf-ocg-layers.ts";
import { drawSheetRegMarksPdfLib } from "./sheet-regmarks.ts";

function trimRectPdfLib(trim: { x: number; y: number; width: number; height: number }) {
  const x = mmToPt(trim.x);
  const y = mmToPt(PAGE_HEIGHT_MM - trim.y - trim.height);
  return { x, y, width: mmToPt(trim.width), height: mmToPt(trim.height) };
}

function drawThruCutRect(
  page: ReturnType<PDFDocument["addPage"]>,
  trim: { x: number; y: number; width: number; height: number },
) {
  const { x, y, width, height } = trimRectPdfLib(trim);
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderWidth: 0.25,
    borderColor: rgb(0, 0, 0),
  });
}

export async function buildThruCutPdf(
  songs: Song[],
  side: "front" | "back",
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const layers = new PdfOcgLayerRegistry(pdf);
  const pageCount = Math.ceil(songs.length / GRID.cardsPerPage);

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const page = pdf.addPage([mmToPt(PAGE_WIDTH_MM), mmToPt(PAGE_HEIGHT_MM)]);
    const startIndex = pageIndex * GRID.cardsPerPage;
    const count = Math.min(GRID.cardsPerPage, songs.length - startIndex);

    layers.beginLayer(page, SPOT_THRU_CUT);
    for (let i = 0; i < count; i++) {
      const indexOnPage = side === "back" ? GRID.cardsPerPage - 1 - i : i;
      const { x, y } = cardOrigin(indexOnPage);
      drawThruCutRect(page, trimBox(x, y));
    }
    layers.endLayer(page);

    layers.beginLayer(page, SPOT_REGMARK);
    drawSheetRegMarksPdfLib(page, rgb(0, 0, 0));
    layers.endLayer(page);
  }

  layers.attachToCatalog();
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
