/**
 * Smart CRM Bootstrap contracts (Phase 5.1).
 *
 * The bootstrap engine seeds the CRM catalog from *real* AI extraction results
 * (Phase 4.3) — never fabricated data. Each extracted entity value becomes at
 * most one CRM record; values that match an existing record (or one created
 * earlier in the same run) are reused, not duplicated. Every created record
 * carries provenance back to the source document.
 *
 * The engine reuses the linker's matching (`scoreName` / normalized-ref
 * equality, see src/lib/linking/matchers) for de-duplication, so any record it
 * creates is guaranteed to be found by the linker on the subsequent rerun.
 */
import type { LinkEntityType } from "@/lib/linking/types";
import type { LinkCounts } from "@/lib/linking/service";

/** How a bootstrappable kind derives its de-duplication key from a value. */
export type MatchStrategy = "name" | "ref";

/** Per-kind accounting produced by the engine. */
export interface KindReport {
  entityType: LinkEntityType;
  /** Distinct extracted values considered for this kind. */
  rawValues: number;
  /** New CRM records inserted. */
  created: number;
  /** Extracted entities that resolved to a record that already existed. */
  reused: number;
  /** Redundant mentions collapsed into an already-known record. */
  duplicatesPrevented: number;
  /** Present when the kind has no extracted source field yet. */
  note?: string;
}

/** One created record, for the detailed listing. */
export interface CreatedRecord {
  entityType: LinkEntityType;
  entityId: string;
  name: string;
  sourceDocument: string;
  confidence: number;
  provider: string;
}

/** Full bootstrap report. */
export interface BootstrapReport {
  dryRun: boolean;
  perKind: KindReport[];
  totals: {
    rawValues: number;
    created: number;
    reused: number;
    duplicatesPrevented: number;
  };
  createdRecords: CreatedRecord[];
  /** Result of the automatic linking rerun (null when skipped, e.g. dry run). */
  linking: LinkCounts | null;
  /** Net new SUGGESTED link rows produced by the rerun. */
  linksCreated: number;
  /** SUGGESTED links awaiting review after the rerun. */
  suggestedLinksAfter: number;
  /** Documents with extraction that produced no link at all. */
  unmatchedDocuments: number;
}

export interface RunBootstrapOptions {
  actorId: string;
  /** Compute and report without writing any records or provenance. */
  dryRun?: boolean;
  onEvent?: (event: BootstrapEvent) => void;
}

export type BootstrapEvent =
  | { type: "kind-start"; entityType: LinkEntityType; rawValues: number }
  | {
      type: "record";
      entityType: LinkEntityType;
      outcome: "created" | "reused" | "duplicate";
      value: string;
      matchedName?: string;
    }
  | { type: "kind-done"; report: KindReport }
  | { type: "linking-start" }
  | { type: "linking-done"; counts: LinkCounts };
