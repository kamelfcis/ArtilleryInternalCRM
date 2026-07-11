/**
 * CRM linking contracts (Phase 4.4).
 *
 * The linker turns the structured fields extracted in Phase 4.3 into *suggested*
 * associations between a document and existing CRM records. A `Matcher` looks at
 * a document's extracted field values plus a snapshot of the CRM records of one
 * kind, and proposes `LinkCandidate`s. Matchers are pure with respect to the
 * database (they receive a pre-loaded index); persistence, idempotency and event
 * emission live in `service.ts`.
 *
 * Links are never authoritative — the linker only ever proposes SUGGESTED links
 * and never mutates the CRM record. Confirmation happens in Phase 4.5.
 */
import { ENTITY_TYPES } from "@/lib/constants";

/** CRM record kinds a document can be linked to. Subset of ENTITY_TYPES. */
export const LINK_ENTITY_TYPES = {
  CONTRACT: ENTITY_TYPES.CONTRACT,
  PURCHASE: ENTITY_TYPES.PURCHASE,
  PRACTICE: ENTITY_TYPES.PRACTICE,
  COMPANY: ENTITY_TYPES.COMPANY,
  PROJECT: ENTITY_TYPES.PROJECT,
  SITE: ENTITY_TYPES.SITE,
} as const;

export type LinkEntityType = (typeof LINK_ENTITY_TYPES)[keyof typeof LINK_ENTITY_TYPES];

/** How a match was established. */
export type LinkMethod = "exact" | "fuzzy";

/** One extracted field value, as read from DocumentField. */
export interface FieldValue {
  key: string;
  value: string;
  normalizedValue: string | null;
}

/** A CRM record reduced to what the matchers need. */
export interface CrmRecord {
  id: string;
  /** The primary comparison string: identifier number or entity name. */
  key: string;
}

/** A proposed document→CRM association before persistence. */
export interface LinkCandidate {
  entityType: LinkEntityType;
  entityId: string;
  /** DocumentField.key that produced the match. */
  matchedKey: string;
  /** The extracted value that matched. */
  matchedValue: string;
  method: LinkMethod;
  /** 0–1 match strength. */
  confidence: number;
}

/**
 * Strategy: given a document's extracted fields and a snapshot of the CRM
 * records for its target kind, propose link candidates. Pure and DB-free.
 */
export interface Matcher {
  readonly entityType: LinkEntityType;
  /** DocumentField keys this matcher consumes. */
  readonly fieldKeys: readonly string[];
  match(fields: FieldValue[], records: CrmRecord[]): LinkCandidate[];
}
