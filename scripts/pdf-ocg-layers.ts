import type { PDFDocument, PDFPage } from "pdf-lib";
import {
  PDFDict,
  PDFName,
  PDFOperator,
  PDFOperatorNames,
  PDFString,
  endMarkedContent,
} from "pdf-lib";
import type PDFRef from "pdf-lib/cjs/core/objects/PDFRef.js";

type LayerEntry = {
  propName: PDFName;
  ocgRef: PDFRef;
};

/**
 * Acrobat Optional Content Groups (PDF "layers") for Summa GoSign/GoProduce.
 * Spot separations alone are not exposed as toggleable layers in most viewers.
 */
export class PdfOcgLayerRegistry {
  private readonly layers = new Map<string, LayerEntry>();
  private readonly order: PDFRef[] = [];

  constructor(private readonly doc: PDFDocument) {}

  ensureLayer(displayName: string): LayerEntry {
    const existing = this.layers.get(displayName);
    if (existing) return existing;

    const context = this.doc.context;
    const ocg = context.obj({
      Type: "OCG",
      Name: PDFString.of(displayName),
    });
    const ocgRef = context.register(ocg);
    const propName = PDFName.of(`L${this.order.length + 1}`);
    const entry = { propName, ocgRef };
    this.layers.set(displayName, entry);
    this.order.push(ocgRef);
    return entry;
  }

  beginLayer(page: PDFPage, displayName: string) {
    const { propName, ocgRef } = this.ensureLayer(displayName);
    this.registerPageProperty(page, propName, ocgRef);
    page.pushOperators(
      PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [
        PDFName.of("OC"),
        propName,
      ]),
    );
  }

  endLayer(page: PDFPage) {
    page.pushOperators(endMarkedContent());
  }

  attachToCatalog() {
    if (this.order.length === 0) return;

    const context = this.doc.context;
    const ocgs = context.obj(this.order);
    const order = context.obj(this.order);
    const defaultConfig = context.obj({
      Order: order,
      ON: order,
      OFF: [],
      RBGroups: [],
    });
    const ocProperties = context.obj({
      OCGs: ocgs,
      D: defaultConfig,
    });
    this.doc.catalog.set(PDFName.of("OCProperties"), ocProperties);
  }

  private registerPageProperty(page: PDFPage, propName: PDFName, ocgRef: PDFRef) {
    const context = this.doc.context;
    const resources = page.node.Resources()!;
    let properties = resources.lookupMaybe(PDFName.of("Properties"), PDFDict);
    if (!properties) {
      properties = context.obj({});
      resources.set(PDFName.of("Properties"), properties);
    }

    if (!properties.has(propName)) {
      const membership = context.obj({
        Type: "OCMD",
        OCGs: [ocgRef],
        P: PDFName.of("AllOn"),
      });
      properties.set(propName, membership);
    }
  }
}
