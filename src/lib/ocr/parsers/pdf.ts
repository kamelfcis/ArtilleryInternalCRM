import type {
  DocumentParser,
  ExtractedPage,
  ExtractionResult,
  ParserInput,
} from "../types";
import { detectLanguage, isReadableText } from "../language";
import { ocrImage } from "../tesseract";

/**
 * PDF parser. For each page it first reads the embedded text layer; if that
 * text is genuinely readable (see `isReadableText`) it is used as-is with full
 * confidence. Otherwise the page is a scan (or a fontless Arabic export), so it
 * is rasterized with @napi-rs/canvas and run through Tesseract OCR. A single
 * document can therefore mix text-layer and OCR pages.
 */

/** Render scale for OCR rasterization — higher = better OCR, slower. */
const RENDER_SCALE = 2;

// pdfjs and canvas are heavy, ESM-only, and Node-unfriendly to import eagerly;
// load them lazily and cache the modules across pages.
type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsPromise: Promise<PdfjsModule> | null = null;
function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsPromise;
}

type CanvasModule = typeof import("@napi-rs/canvas");
let canvasPromise: Promise<CanvasModule> | null = null;
function loadCanvas(): Promise<CanvasModule> {
  if (!canvasPromise) canvasPromise = import("@napi-rs/canvas");
  return canvasPromise;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfPage = any;

async function textLayer(page: PdfPage): Promise<string> {
  const content = await page.getTextContent();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts = content.items.map((i: any) => ("str" in i ? i.str : ""));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function ocrPage(page: PdfPage): Promise<{ text: string; confidence: number }> {
  const { createCanvas } = await loadCanvas();
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext("2d");
  await page.render({
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
    canvas: canvas as unknown as HTMLCanvasElement,
  }).promise;
  const png = canvas.toBuffer("image/png");
  return ocrImage(png);
}

class PdfParser implements DocumentParser {
  readonly name = "pdf";

  supports(extension: string): boolean {
    return extension === "pdf";
  }

  async parse(input: ParserInput): Promise<ExtractionResult> {
    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(input.buffer),
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise;

    const pages: ExtractedPage[] = [];
    try {
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        try {
          const embedded = await textLayer(page);
          if (isReadableText(embedded)) {
            pages.push({
              pageNumber: n,
              text: embedded,
              language: detectLanguage(embedded),
              confidence: 100,
              method: "text-layer",
            });
          } else {
            const { text, confidence } = await ocrPage(page);
            pages.push({
              pageNumber: n,
              text,
              language: detectLanguage(text),
              confidence,
              method: "ocr",
            });
          }
        } finally {
          page.cleanup();
        }
      }
    } finally {
      await doc.destroy();
    }
    return { pages };
  }
}

export const pdfParser = new PdfParser();
