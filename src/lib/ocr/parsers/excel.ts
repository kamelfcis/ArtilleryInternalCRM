import type {
  DocumentParser,
  ExtractedPage,
  ExtractionResult,
  ParserInput,
} from "../types";
import { detectLanguage } from "../language";

/**
 * Excel parser — reads `.xlsx`/`.xls` with SheetJS and emits one page per sheet
 * (page number = sheet ordinal). Each sheet is rendered as tab-separated rows so
 * the raw text stays human-readable and searchable.
 */
class ExcelParser implements DocumentParser {
  readonly name = "excel";

  supports(extension: string): boolean {
    return extension === "xlsx" || extension === "xls";
  }

  async parse(input: ParserInput): Promise<ExtractionResult> {
    const XLSX = await import("xlsx");
    const book = XLSX.read(input.buffer, { type: "buffer" });

    const pages: ExtractedPage[] = book.SheetNames.map((sheetName, index) => {
      const sheet = book.Sheets[sheetName];
      const body = sheet ? XLSX.utils.sheet_to_csv(sheet, { FS: "\t" }).trim() : "";
      const text = `# ${sheetName}\n${body}`.trim();
      return {
        pageNumber: index + 1,
        text,
        language: detectLanguage(text),
        confidence: 100,
        method: "office" as const,
      };
    });

    return { pages: pages.length > 0 ? pages : [] };
  }
}

export const excelParser = new ExcelParser();
