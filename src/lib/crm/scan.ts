import "server-only";
import { prisma } from "@/lib/prisma";
import { parserFor } from "@/lib/ocr/registry";
import { ruleExtractor } from "@/lib/extraction/rules";
import { llmExtractor } from "@/lib/extraction/llm";
import { FIELD_KEYS } from "@/lib/extraction/types";
import type { FieldCandidate } from "@/lib/extraction/types";
import { normalize } from "@/lib/search/normalize";
import { scoreName, MIN_CONFIDENCE } from "@/lib/linking/matchers";
import { ENTITY_KINDS, CURRENCY_OPTIONS } from "@/lib/crm/constants";
import { ValidationError } from "@/lib/errors";

/**
 * Scan-to-form service for contracts and purchases (Phase 5.5). Takes an
 * uploaded image/PDF of a contract or purchase invoice, extracts its text with
 * the OCR parsers (Phase 4.2) and pulls structured fields with the hybrid
 * extractor (Phase 4.3) — the exact same pipeline the batch jobs use — then maps
 * the result to the entity's form inputs so the create dialog can be pre-filled.
 *
 * Nothing is persisted: no Document, no DocumentField, no CRM record. The number
 * field is auto-filled — the value found in the document when present, otherwise
 * a freshly generated `YYYY/NNN` number unique within the entity.
 */

export type ScanKind = typeof ENTITY_KINDS.CONTRACT | typeof ENTITY_KINDS.PURCHASE;

export interface ScanInput {
  kind: ScanKind;
  buffer: Buffer;
  /** Original filename, used only to pick the parser by extension. */
  filename: string;
  mimeType: string;
}

export interface ScanResult {
  /** Form field name → prefilled value (strings, ready for the inputs). */
  values: Record<string, string>;
  /** Human-readable notes about what was and wasn't found (Arabic). */
  warnings: string[];
  /** Extraction provider used, e.g. "hybrid:gemini-2.5-flash" or "rules-only". */
  provider: string;
  /** True when the number was generated rather than read from the document. */
  numberGenerated: boolean;
}

const CURRENCY_VALUES = new Set<string>(CURRENCY_OPTIONS.map((c) => c.value));
const MAX_TITLE = 250;

function extension(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

/** Best (highest-confidence) candidate for a field key, or null. */
function best(fields: FieldCandidate[], key: string): FieldCandidate | null {
  let winner: FieldCandidate | null = null;
  for (const f of fields) {
    if (f.key === key && (!winner || f.confidence > winner.confidence)) winner = f;
  }
  return winner;
}

/** A date candidate reduced to an <input type=date> value (YYYY-MM-DD). */
function dateValue(f: FieldCandidate | null): string {
  if (!f) return "";
  const iso = f.normalizedValue ?? f.value;
  return /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : "";
}

/** A money candidate reduced to a plain number string. */
function moneyValue(f: FieldCandidate | null): string {
  if (!f) return "";
  const digits = (f.normalizedValue ?? f.value).replace(/[^\d.]/g, "");
  return digits && Number.isFinite(Number(digits)) ? digits : "";
}

/** Fuzzy-match an extracted name to an existing record id, reusing linker logic. */
async function matchRecordId(
  extractedName: string | undefined,
  records: { id: string; name: string }[],
): Promise<string> {
  if (!extractedName) return "";
  const target = normalize(extractedName);
  if (target.length < 3) return "";
  let bestId = "";
  let bestScore = MIN_CONFIDENCE;
  for (const r of records) {
    const s = scoreName(normalize(r.name), target);
    if (s >= bestScore) {
      bestScore = s;
      bestId = r.id;
    }
  }
  return bestId;
}

/**
 * Generate the next `YYYY/NNN` number for a kind, unique across all records
 * (including soft-deleted, since the number column is globally unique).
 */
async function nextNumber(kind: ScanKind): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${year}/`;
  const rows =
    kind === ENTITY_KINDS.CONTRACT
      ? await prisma.contract.findMany({
          where: { contractNumber: { startsWith: prefix } },
          select: { contractNumber: true },
        })
      : await prisma.purchase.findMany({
          where: { purchaseNumber: { startsWith: prefix } },
          select: { purchaseNumber: true },
        });

  let max = 0;
  for (const row of rows) {
    const raw = kind === ENTITY_KINDS.CONTRACT
      ? (row as { contractNumber: string }).contractNumber
      : (row as { purchaseNumber: string }).purchaseNumber;
    const n = Number.parseInt(raw.slice(prefix.length), 10);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export async function scanForEntity(input: ScanInput): Promise<ScanResult> {
  const { kind, buffer, filename, mimeType } = input;
  if (kind !== ENTITY_KINDS.CONTRACT && kind !== ENTITY_KINDS.PURCHASE) {
    throw new ValidationError("النوع غير مدعوم للمسح الضوئي");
  }

  const ext = extension(filename);
  const parser = parserFor(ext);
  if (!parser) {
    throw new ValidationError(`نوع الملف غير مدعوم للمسح: .${ext || "?"}`);
  }

  const result = await parser.parse({ buffer, extension: ext, mimeType });
  const text = result.pages
    .slice()
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((p) => p.text)
    .join("\n\n")
    .trim();

  const warnings: string[] = [];
  if (!text) {
    throw new ValidationError("تعذّر قراءة أي نص من الملف. جرّب صورة أوضح.");
  }

  const [ruleFields, llmFields] = await Promise.all([
    ruleExtractor.extract(text),
    llmExtractor.extract(text),
  ]);
  const fields = [...ruleFields, ...llmFields];
  const provider = llmExtractor.isAvailable()
    ? `hybrid:${llmExtractor.model}`
    : "rules-only";
  if (!llmExtractor.isAvailable()) {
    warnings.push("لم يُفعّل الاستخراج الذكي (بدون مفتاح) — أُدرجت الأرقام والتواريخ فقط.");
  }

  const isContract = kind === ENTITY_KINDS.CONTRACT;
  const numberKey = isContract ? FIELD_KEYS.CONTRACT_NUMBER : FIELD_KEYS.PURCHASE_NUMBER;

  // Number: prefer a value read from the document, else auto-generate.
  const extractedNumber = best(fields, numberKey);
  let numberGenerated = false;
  let numberValue = extractedNumber?.value.trim() ?? "";
  if (!numberValue) {
    numberValue = await nextNumber(kind);
    numberGenerated = true;
    warnings.push(`لم يُعثر على رقم في المستند — تم توليد رقم تلقائي: ${numberValue}`);
  }

  // Relations: fuzzy-match extracted names to existing records.
  const [companies, projects] = await Promise.all([
    prisma.company.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    prisma.project.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
  ]);
  const companyName = best(fields, FIELD_KEYS.COMPANY)?.value;
  const projectName = best(fields, FIELD_KEYS.PROJECT)?.value;
  const companyId = await matchRecordId(companyName, companies);
  const projectId = await matchRecordId(projectName, projects);
  if (companyName && !companyId) {
    warnings.push(`تعذّر مطابقة الشركة «${companyName}» بسجل موجود — اخترها يدويًا.`);
  }

  // Title: no dedicated extracted field — use the works subject (project) or notes.
  const titleSource = projectName ?? best(fields, FIELD_KEYS.NOTES)?.value ?? "";
  const title = titleSource.trim().slice(0, MAX_TITLE);

  const description = best(fields, FIELD_KEYS.NOTES)?.value.trim() ?? "";
  const money = moneyValue(best(fields, FIELD_KEYS.AMOUNT));
  const currencyRaw = best(fields, FIELD_KEYS.CURRENCY)?.normalizedValue ?? "";
  const currency = CURRENCY_VALUES.has(currencyRaw) ? currencyRaw : "";
  const date = dateValue(best(fields, FIELD_KEYS.DATE));

  const values: Record<string, string> = isContract
    ? {
        contractNumber: numberValue,
        title,
        companyId,
        value: money,
        ...(currency ? { currency } : {}),
        projectId,
        signedDate: date,
        description,
      }
    : {
        purchaseNumber: numberValue,
        title,
        companyId,
        amount: money,
        ...(currency ? { currency } : {}),
        projectId,
        requestDate: date,
        description,
      };

  // Drop empties so we never overwrite a field with a blank default.
  for (const k of Object.keys(values)) {
    if (values[k] === "") delete values[k];
  }

  return { values, warnings, provider, numberGenerated };
}
