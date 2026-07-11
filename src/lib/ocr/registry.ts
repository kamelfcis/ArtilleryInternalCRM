import type { DocumentParser } from "./types";
import { pdfParser } from "./parsers/pdf";
import { imageParser } from "./parsers/image";
import { wordParser } from "./parsers/word";
import { excelParser } from "./parsers/excel";
import { textParser } from "./parsers/text";

/**
 * Parser registry — the single place that maps a document's extension to the
 * strategy that extracts its text. Adding a new format = add a parser here.
 */
const PARSERS: readonly DocumentParser[] = [
  pdfParser,
  imageParser,
  wordParser,
  excelParser,
  textParser,
];

/** The parser for `extension` (lowercase, no dot), or null if none handles it. */
export function parserFor(extension: string | null | undefined): DocumentParser | null {
  if (!extension) return null;
  const ext = extension.toLowerCase();
  return PARSERS.find((p) => p.supports(ext)) ?? null;
}
