import type { DocumentParser, ExtractionResult, ParserInput } from "../types";
import { detectLanguage } from "../language";
import { UnsupportedFormatError } from "../types";

/**
 * Word parser. Handles the modern `.docx` (Office Open XML) via mammoth, which
 * extracts the document's raw text. The legacy binary `.doc` format is not
 * supported by mammoth and raises `UnsupportedFormatError` (recorded as a
 * permanent empty result so reruns skip it).
 */
class WordParser implements DocumentParser {
  readonly name = "word";

  supports(extension: string): boolean {
    return extension === "docx" || extension === "doc";
  }

  async parse(input: ParserInput): Promise<ExtractionResult> {
    if (input.extension !== "docx") throw new UnsupportedFormatError(input.extension);

    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: input.buffer });
    const text = value.replace(/\n{3,}/g, "\n\n").trim();

    return {
      pages: [
        {
          pageNumber: 1,
          text,
          language: detectLanguage(text),
          confidence: 100,
          method: "office",
        },
      ],
    };
  }
}

export const wordParser = new WordParser();
