import type { DocumentParser, ExtractionResult, ParserInput } from "../types";
import { detectLanguage } from "../language";

/** Plain-text parser — decodes `.txt` bytes as UTF-8, no OCR needed. */
class TextParser implements DocumentParser {
  readonly name = "text";

  supports(extension: string): boolean {
    return extension === "txt";
  }

  async parse(input: ParserInput): Promise<ExtractionResult> {
    const text = input.buffer.toString("utf8").trim();
    return {
      pages: [
        {
          pageNumber: 1,
          text,
          language: detectLanguage(text),
          confidence: 100,
          method: "text-layer",
        },
      ],
    };
  }
}

export const textParser = new TextParser();
