import type { DocumentParser, ExtractionResult, ParserInput } from "../types";
import { detectLanguage } from "../language";
import { ocrImage } from "../tesseract";

/** Image parser — runs Tesseract OCR (Arabic + English) over the whole image. */
class ImageParser implements DocumentParser {
  readonly name = "image";

  supports(extension: string): boolean {
    return extension === "png" || extension === "jpg" || extension === "jpeg";
  }

  async parse(input: ParserInput): Promise<ExtractionResult> {
    const { text, confidence } = await ocrImage(input.buffer);
    return {
      pages: [
        {
          pageNumber: 1,
          text,
          language: detectLanguage(text),
          confidence,
          method: "ocr",
        },
      ],
    };
  }
}

export const imageParser = new ImageParser();
