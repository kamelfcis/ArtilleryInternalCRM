/**
 * Smart CRM seeding contracts (Phase 4.5).
 *
 * The seed engine bootstraps the CRM tables from the *real* entities that Phase
 * 4.3 extracted out of the imported documents — it never fabricates sample data.
 * Each candidate value (a company/site/project name, or a contract/purchase/
 * practice reference number) is normalized, Arabic-folded, fuzzy-deduplicated
 * against both the current batch and the existing CRM records, and then either
 * reused (a match was found) or turned into a new record. Every created record
 * carries its provenance (source document, OCR origin, confidence) on the
 * emitted domain event so the audit trail records where it came from.
 */
import { ENTITY_KINDS, type EntityKind } from "@/lib/crm/constants";
import { FIELD_KEYS } from "@/lib/extraction/types";

/** Marks a record as originating from the AI extraction pipeline. */
export const SEED_SOURCE = "AI_EXTRACTION" as const;
export const SEED_CREATED_FROM = "OCR" as const;

/** How a kind's candidate values are matched: by fuzzy name or by exact ref. */
export type MatchMode = "name" | "ref";

/** Static description of one seedable CRM kind. */
export interface SeedKindSpec {
  kind: EntityKind;
  /** The DocumentField.key whose values seed this kind. */
  fieldKey: string;
  mode: MatchMode;
  /** Minimum field confidence to consider a value (quality gate). */
  minConfidence: number;
  /** Max character length of a value to treat it as a name (name mode only). */
  maxNameLength: number;
}

/**
 * The six seedable kinds, in dependency order: Company before Contract/Purchase
 * (which reference a company), and names before ref-number kinds. Projects and
 * sites are independent. Ref-number kinds only produce records when the rule
 * pass actually extracted such numbers.
 */
export const SEED_KINDS: readonly SeedKindSpec[] = [
  { kind: ENTITY_KINDS.COMPANY, fieldKey: FIELD_KEYS.COMPANY, mode: "name", minConfidence: 0.7, maxNameLength: 80 },
  { kind: ENTITY_KINDS.SITE, fieldKey: FIELD_KEYS.SITE, mode: "name", minConfidence: 0.7, maxNameLength: 60 },
  { kind: ENTITY_KINDS.PROJECT, fieldKey: FIELD_KEYS.PROJECT, mode: "name", minConfidence: 0.8, maxNameLength: 70 },
  { kind: ENTITY_KINDS.PRACTICE, fieldKey: FIELD_KEYS.PRACTICE_NUMBER, mode: "ref", minConfidence: 0.6, maxNameLength: 40 },
  { kind: ENTITY_KINDS.CONTRACT, fieldKey: FIELD_KEYS.CONTRACT_NUMBER, mode: "ref", minConfidence: 0.6, maxNameLength: 40 },
  { kind: ENTITY_KINDS.PURCHASE, fieldKey: FIELD_KEYS.PURCHASE_NUMBER, mode: "ref", minConfidence: 0.6, maxNameLength: 40 },
];

/** One extracted occurrence of a candidate value, with its document origin. */
export interface Candidate {
  /** Cleaned display value (whitespace collapsed, separators tidied). */
  value: string;
  /** Comparison key (Arabic-folded name, or normalized ref). */
  matchKey: string;
  confidence: number;
  documentId: string;
  documentName: string;
}

/** A cluster of candidate occurrences agreed to be the same real-world entity. */
export interface EntityCluster {
  /** The chosen canonical display value for the record. */
  canonical: string;
  matchKey: string;
  /** Best confidence seen across the cluster's occurrences. */
  confidence: number;
  /** Distinct source documents that mentioned this entity. */
  documentIds: string[];
  /** Representative (highest-confidence) source document. */
  primaryDocumentId: string;
  primaryDocumentName: string;
}

/** Per-kind tally. */
export interface KindResult {
  created: number;
  reused: number;
  skipped: number;
  errors: number;
}

export type SeedCounts = Record<EntityKind, KindResult>;

export const emptyKindResult = (): KindResult => ({ created: 0, reused: 0, skipped: 0, errors: 0 });

/** Progress + lifecycle events emitted by the engine for the CLI to render. */
export type SeedEvent =
  | { type: "scanning" }
  | { type: "scanned"; fields: number; documents: number }
  | { type: "kind-start"; kind: EntityKind; candidates: number }
  | { type: "created"; kind: EntityKind; name: string; confidence: number; document: string }
  | { type: "reused"; kind: EntityKind; name: string; existing: string }
  | { type: "skipped"; kind: EntityKind; value: string; reason: string }
  | { type: "error"; kind: EntityKind; value: string; reason: string }
  | { type: "kind-done"; kind: EntityKind; result: KindResult }
  | { type: "done"; counts: SeedCounts };

export interface RunSeedOptions {
  actorId: string;
  /** Log every decision (verbose) rather than only the summary. */
  onEvent?: (event: SeedEvent) => void;
}
