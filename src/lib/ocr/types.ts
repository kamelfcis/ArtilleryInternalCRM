/**
 * OCR / text-extraction contracts (Phase 4.2).
 *
 * A `DocumentParser` turns a document's raw bytes into per-page text. Parsers
 * are pure with respect to the database — they never touch Prisma; persistence
 * and idempotency live in `service.ts`. This mirrors the resolver-port strategy
 * pattern used elsewhere: one parser per family of extensions, selected by the
 * registry.
 */

/** How a page's text was obtained. */
export type ExtractionMethod = "text-layer" | "ocr" | "office" | "none";

/** Extracted text for a single page (PDF/image) or sheet (Excel). */
export interface ExtractedPage {
  /** 1-based page number (PDF/image) or sheet index (Excel). */
  pageNumber: number;
  /** Extracted text; empty string when nothing was extractable. */
  text: string;
  /** Detected script: "ara" | "eng" | "ara+eng" | "und". */
  language: string;
  /** 0–100. 100 for exact text-layer/office text; Tesseract's score for OCR. */
  confidence: number;
  method: ExtractionMethod;
}

/** Result of parsing one document. */
export interface ExtractionResult {
  pages: ExtractedPage[];
}

/** Bytes + type info handed to a parser. */
export interface ParserInput {
  buffer: Buffer;
  /** Lowercase extension without dot (e.g. "pdf"). */
  extension: string;
  mimeType: string;
}

/** Strategy: extracts text from one family of document formats. */
export interface DocumentParser {
  readonly name: string;
  /** True when this parser handles the given (lowercase, dotless) extension. */
  supports(extension: string): boolean;
  parse(input: ParserInput): Promise<ExtractionResult>;
}

/**
 * Thrown when a format is recognized but cannot be text-extracted (e.g. legacy
 * binary .doc/.ppt). The pipeline records these as a permanent empty result so
 * reruns do not retry them — distinct from transient runtime failures.
 */
export class UnsupportedFormatError extends Error {
  constructor(extension: string) {
    super(`استخراج النص غير مدعوم لهذا النوع من الملفات: .${extension}`);
    this.name = "UnsupportedFormatError";
  }
}
