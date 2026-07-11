/**
 * Structured extraction contracts (Phase 4.3).
 *
 * An `Extractor` turns a document's OCR text into typed field candidates. The
 * hybrid pipeline composes two of them — deterministic local rules and an
 * optional Claude pass — behind this one port, so either can be swapped or run
 * alone. Extractors are pure with respect to the database; persistence and
 * idempotency live in `service.ts`.
 */

/** Which pass produced a field. */
export type FieldSource = "rule" | "llm";

/**
 * Canonical field keys. Structured/pattern fields come from the rule pass;
 * free-form entities come from the LLM pass. Keys are stored verbatim on
 * DocumentField.key so Phase 4.4 (CRM linking) can query by key.
 */
export const FIELD_KEYS = {
  // --- Rule pass (deterministic patterns) ---------------------------------
  DATE: "date",
  PHONE: "phone",
  NATIONAL_ID: "nationalId",
  TAX_ID: "taxId",
  AMOUNT: "amount",
  CURRENCY: "currency",
  CONTRACT_NUMBER: "contractNumber",
  PURCHASE_NUMBER: "purchaseNumber",
  PRACTICE_NUMBER: "practiceNumber",
  // --- LLM pass (free-form entities) --------------------------------------
  COMPANY: "company",
  GOVERNMENT_ENTITY: "governmentEntity",
  SITE: "site",
  PROJECT: "project",
  ADDRESS: "address",
  ENGINEER: "engineer",
  REPRESENTATIVE: "representative",
  STATUS: "status",
  NOTES: "notes",
} as const;

export type FieldKey = (typeof FIELD_KEYS)[keyof typeof FIELD_KEYS];

/** A single extracted field before persistence. */
export interface FieldCandidate {
  key: FieldKey;
  /** Raw value as extracted/inferred. */
  value: string;
  /** Canonical form when applicable (ISO date, digits-only phone), else null. */
  normalizedValue?: string | null;
  /** 0–1 confidence. */
  confidence: number;
  source: FieldSource;
}

/** Strategy: extracts field candidates from OCR text. */
export interface Extractor {
  readonly name: string;
  extract(text: string): Promise<FieldCandidate[]>;
}
