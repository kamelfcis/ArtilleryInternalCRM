/**
 * Deterministic, offline matchers for CRM linking (Phase 4.4). Two families:
 *
 *  • Exact identifier matchers compare a normalized reference number (digits +
 *    slash, Arabic-Indic folded) — high confidence, no false positives.
 *      contractNumber → Contract.contractNumber
 *      purchaseNumber → Purchase.purchaseNumber
 *      practiceNumber → Practice.referenceNumber
 *
 *  • Fuzzy name matchers compare Arabic-folded names with a bounded edit
 *    distance (reusing the global-search normalizer) — conservative thresholds
 *    keep confidential records from mis-linking.
 *      company → Company.name   ·   project → Project.name   ·   site → Site.name
 *
 * All matchers are pure: they receive a pre-loaded snapshot of CRM records and
 * never touch the database. No network. Fully unit-testable.
 */
import { normalize, levenshtein } from "@/lib/search/normalize";
import { foldDigits } from "@/lib/extraction/rules";
import { FIELD_KEYS } from "@/lib/extraction/types";
import {
  LINK_ENTITY_TYPES,
  type CrmRecord,
  type FieldValue,
  type LinkCandidate,
  type LinkEntityType,
  type Matcher,
} from "./types";

/** Confidence floor below which a candidate is discarded. */
export const MIN_CONFIDENCE = 0.6;

/**
 * Reduce a reference number to its comparable core: fold Arabic-Indic digits,
 * keep only digits and slashes, collapse repeats, and trim edge slashes. This
 * lets "١٢٣ / ٢٠٢٥", "123/2025" and "ع/123/2025" all compare on "123/2025".
 */
export function normalizeRef(input: string): string {
  return foldDigits(input)
    .replace(/[^\d/]/g, "")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

/** Best matching value for a field (prefer the canonical normalizedValue). */
function fieldText(f: FieldValue): string {
  return (f.normalizedValue ?? f.value).trim();
}

/** Keep only the highest-confidence candidate per linked record. */
function dedupeByEntity(candidates: LinkCandidate[]): LinkCandidate[] {
  const best = new Map<string, LinkCandidate>();
  for (const c of candidates) {
    const prev = best.get(c.entityId);
    if (!prev || c.confidence > prev.confidence) best.set(c.entityId, c);
  }
  return [...best.values()];
}

/** Exact identifier matcher for one entity kind + one field key. */
class ExactRefMatcher implements Matcher {
  readonly fieldKeys: readonly string[];
  constructor(
    readonly entityType: LinkEntityType,
    fieldKey: string,
  ) {
    this.fieldKeys = [fieldKey];
  }

  match(fields: FieldValue[], records: CrmRecord[]): LinkCandidate[] {
    const fieldKey = this.fieldKeys[0]!;
    const refs = fields
      .filter((f) => f.key === fieldKey)
      .map((f) => ({ raw: fieldText(f), norm: normalizeRef(fieldText(f)) }))
      .filter((r) => r.norm.length > 0);
    if (refs.length === 0) return [];

    const out: LinkCandidate[] = [];
    for (const rec of records) {
      const recNorm = normalizeRef(rec.key);
      if (!recNorm) continue;
      const hit = refs.find((r) => r.norm === recNorm);
      if (hit) {
        out.push({
          entityType: this.entityType,
          entityId: rec.id,
          matchedKey: fieldKey,
          matchedValue: hit.raw,
          method: "exact",
          confidence: 0.97,
        });
      }
    }
    return dedupeByEntity(out);
  }
}

/** Levenshtein allowance scaled to the compared length. */
function allowedDistance(maxLen: number): number {
  if (maxLen <= 6) return 1;
  if (maxLen <= 12) return 2;
  return 3;
}

/**
 * Score two Arabic-folded names. Returns a confidence in [MIN_CONFIDENCE, 0.9]
 * or 0 when they are too dissimilar to propose.
 */
export function scoreName(a: string, b: string): number {
  if (a.length < 3 || b.length < 3) return 0;
  if (a === b) return 0.9;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  // Substring containment (e.g. "شركه النصر" inside "شركه النصر للمقاولات").
  if (shorter.length >= 4 && longer.includes(shorter)) return 0.72;

  const maxLen = longer.length;
  const dist = levenshtein(a, b, allowedDistance(maxLen) + 1);
  if (shorter.length >= 4 && dist <= allowedDistance(maxLen)) {
    const conf = 1 - dist / maxLen;
    return Math.max(MIN_CONFIDENCE, Math.min(0.85, conf));
  }
  return 0;
}

/** Fuzzy name matcher for one entity kind + one field key. */
class FuzzyNameMatcher implements Matcher {
  readonly fieldKeys: readonly string[];
  constructor(
    readonly entityType: LinkEntityType,
    fieldKey: string,
  ) {
    this.fieldKeys = [fieldKey];
  }

  match(fields: FieldValue[], records: CrmRecord[]): LinkCandidate[] {
    const fieldKey = this.fieldKeys[0]!;
    const values = fields
      .filter((f) => f.key === fieldKey)
      .map((f) => ({ raw: fieldText(f), norm: normalize(fieldText(f)) }))
      .filter((v) => v.norm.length >= 3);
    if (values.length === 0) return [];

    const out: LinkCandidate[] = [];
    for (const rec of records) {
      const recNorm = normalize(rec.key);
      if (recNorm.length < 3) continue;
      for (const v of values) {
        const confidence = scoreName(v.norm, recNorm);
        if (confidence >= MIN_CONFIDENCE) {
          out.push({
            entityType: this.entityType,
            entityId: rec.id,
            matchedKey: fieldKey,
            matchedValue: v.raw,
            method: "fuzzy",
            confidence,
          });
        }
      }
    }
    return dedupeByEntity(out);
  }
}

/** The full matcher set. Each targets one CRM kind via one extracted field. */
export const MATCHERS: readonly Matcher[] = [
  new ExactRefMatcher(LINK_ENTITY_TYPES.CONTRACT, FIELD_KEYS.CONTRACT_NUMBER),
  new ExactRefMatcher(LINK_ENTITY_TYPES.PURCHASE, FIELD_KEYS.PURCHASE_NUMBER),
  new ExactRefMatcher(LINK_ENTITY_TYPES.PRACTICE, FIELD_KEYS.PRACTICE_NUMBER),
  new FuzzyNameMatcher(LINK_ENTITY_TYPES.COMPANY, FIELD_KEYS.COMPANY),
  new FuzzyNameMatcher(LINK_ENTITY_TYPES.PROJECT, FIELD_KEYS.PROJECT),
  new FuzzyNameMatcher(LINK_ENTITY_TYPES.SITE, FIELD_KEYS.SITE),
];
