import "server-only";
import { prisma } from "@/lib/prisma";
import { normalize } from "@/lib/search/normalize";
import { scoreName, normalizeRef, MIN_CONFIDENCE } from "@/lib/linking/matchers";
import { runLinking, type LinkCounts } from "@/lib/linking/service";
import { CRM_REGISTRY } from "@/lib/crm/registry";
import type { EntityKind } from "@/lib/crm/constants";
import { FIELD_KEYS } from "@/lib/extraction/types";
import { LINK_ENTITY_TYPES, type LinkEntityType } from "@/lib/linking/types";
import type {
  BootstrapEvent,
  BootstrapReport,
  CreatedRecord,
  KindReport,
  MatchStrategy,
  RunBootstrapOptions,
} from "./types";

/**
 * Smart CRM Bootstrap engine (Phase 5.1). Seeds the CRM catalog from real AI
 * extraction results and nothing else. For each supported kind it collects the
 * extracted values, de-duplicates them against the existing catalog and against
 * records created earlier in the same run — reusing the linker's own matching so
 * every record it creates is guaranteed to be linkable — then creates the
 * genuinely new ones through the standard CRM services (which emit the
 * `crm.record.created` event and write the audit trail). Each created record
 * gets a provenance row pointing back to its source document. When done, the
 * linker is rerun so the new records get their suggested links.
 *
 * Idempotent: a second run finds every record it made last time and creates
 * nothing. `dryRun` computes the full report without writing anything.
 */

/** How each supported kind derives records from extracted values. */
interface KindSpec {
  entityType: LinkEntityType;
  fieldKey: string;
  strategy: MatchStrategy;
  /** The extracted value → validated create input, or null if uncreatable. */
  buildInput: (value: string, normKey: string) => Record<string, unknown> | null;
  /** Reason a kind cannot auto-create (shown when it has values but no builder). */
  uncreatableNote?: string;
}

/** The six CRM kinds, in report order. Name kinds create; ref kinds are gated. */
const KIND_SPECS: KindSpec[] = [
  {
    entityType: LINK_ENTITY_TYPES.COMPANY,
    fieldKey: FIELD_KEYS.COMPANY,
    strategy: "name",
    buildInput: (value) => ({ name: value }),
  },
  {
    entityType: LINK_ENTITY_TYPES.PROJECT,
    fieldKey: FIELD_KEYS.PROJECT,
    strategy: "name",
    buildInput: (value) => ({ name: value }),
  },
  {
    entityType: LINK_ENTITY_TYPES.SITE,
    fieldKey: FIELD_KEYS.SITE,
    strategy: "name",
    buildInput: (value) => ({ name: value }),
  },
  {
    entityType: LINK_ENTITY_TYPES.PURCHASE,
    fieldKey: FIELD_KEYS.PURCHASE_NUMBER,
    strategy: "ref",
    buildInput: (value, normKey) => ({
      purchaseNumber: normKey,
      title: `أمر شراء رقم ${value}`,
    }),
  },
  {
    entityType: LINK_ENTITY_TYPES.PRACTICE,
    fieldKey: FIELD_KEYS.PRACTICE_NUMBER,
    strategy: "ref",
    buildInput: (value, normKey) => ({
      referenceNumber: normKey,
      title: `ممارسة رقم ${value}`,
    }),
  },
  {
    // A contract cannot be created from an extracted number alone: the schema
    // requires a company. Detected and reported, completed by hand.
    entityType: LINK_ENTITY_TYPES.CONTRACT,
    fieldKey: FIELD_KEYS.CONTRACT_NUMBER,
    strategy: "ref",
    buildInput: () => null,
    uncreatableNote: "يتطلب ربط الشركة يدويًا — لا يُنشأ تلقائيًا",
  },
];

/** An extracted value with the provenance needed to seed a record. */
interface Candidate {
  value: string;
  normKey: string;
  confidence: number;
  documentId: string;
  documentName: string;
  provider: string;
}

/** A record known to the engine (existing or created this run). */
interface KnownRecord {
  id: string;
  normKey: string;
}

/** The comparison key for a value under a kind's strategy. */
function keyFor(strategy: MatchStrategy, value: string): string {
  return strategy === "ref" ? normalizeRef(value) : normalize(value);
}

/** Find a known record the value belongs to, or null. */
function findMatch(
  index: KnownRecord[],
  normKey: string,
  strategy: MatchStrategy,
): KnownRecord | null {
  const exact = index.find((r) => r.normKey === normKey);
  if (exact) return exact;
  if (strategy === "name") {
    for (const r of index) {
      if (scoreName(r.normKey, normKey) >= MIN_CONFIDENCE) return r;
    }
  }
  return null;
}

/** Load existing (non-deleted) records for a kind, reduced to id + norm key. */
async function loadExisting(
  entityType: LinkEntityType,
  strategy: MatchStrategy,
): Promise<KnownRecord[]> {
  const sel = { id: true } as const;
  let rows: { id: string; key: string }[] = [];
  switch (entityType) {
    case LINK_ENTITY_TYPES.COMPANY:
      rows = (await prisma.company.findMany({ where: { deletedAt: null }, select: { ...sel, name: true } })).map((r) => ({ id: r.id, key: r.name }));
      break;
    case LINK_ENTITY_TYPES.PROJECT:
      rows = (await prisma.project.findMany({ where: { deletedAt: null }, select: { ...sel, name: true } })).map((r) => ({ id: r.id, key: r.name }));
      break;
    case LINK_ENTITY_TYPES.SITE:
      rows = (await prisma.site.findMany({ where: { deletedAt: null }, select: { ...sel, name: true } })).map((r) => ({ id: r.id, key: r.name }));
      break;
    case LINK_ENTITY_TYPES.PURCHASE:
      rows = (await prisma.purchase.findMany({ where: { deletedAt: null }, select: { ...sel, purchaseNumber: true } })).map((r) => ({ id: r.id, key: r.purchaseNumber }));
      break;
    case LINK_ENTITY_TYPES.PRACTICE:
      rows = (await prisma.practice.findMany({ where: { deletedAt: null }, select: { ...sel, referenceNumber: true } })).map((r) => ({ id: r.id, key: r.referenceNumber }));
      break;
    case LINK_ENTITY_TYPES.CONTRACT:
      rows = (await prisma.contract.findMany({ where: { deletedAt: null }, select: { ...sel, contractNumber: true } })).map((r) => ({ id: r.id, key: r.contractNumber }));
      break;
  }
  return rows.map((r) => ({ id: r.id, normKey: keyFor(strategy, r.key) }));
}

/** Collect extracted values for a field key, de-duplicated by document+value. */
async function loadCandidates(
  fieldKey: string,
  strategy: MatchStrategy,
): Promise<Candidate[]> {
  const fields = await prisma.documentField.findMany({
    where: { key: fieldKey, extraction: { document: { deletedAt: null } } },
    select: {
      value: true,
      confidence: true,
      documentId: true,
      extraction: {
        select: {
          engine: true,
          model: true,
          document: { select: { name: true } },
        },
      },
    },
    orderBy: { confidence: "desc" },
  });

  return fields
    .map((f) => ({
      value: f.value.trim(),
      normKey: keyFor(strategy, f.value),
      confidence: f.confidence,
      documentId: f.documentId,
      documentName: f.extraction.document.name,
      provider: f.extraction.model
        ? `${f.extraction.engine}:${f.extraction.model}`
        : f.extraction.engine,
    }))
    .filter((c) => c.normKey.length > 0);
}

async function processKind(
  spec: KindSpec,
  actorId: string,
  dryRun: boolean,
  createdRecords: CreatedRecord[],
  emit: (e: BootstrapEvent) => void,
): Promise<KindReport> {
  const candidates = await loadCandidates(spec.fieldKey, spec.strategy);
  emit({ type: "kind-start", entityType: spec.entityType, rawValues: candidates.length });

  const existing = await loadExisting(spec.entityType, spec.strategy);
  const createdThisRun: KnownRecord[] = [];
  const seenExisting = new Set<string>();

  const report: KindReport = {
    entityType: spec.entityType,
    rawValues: candidates.length,
    created: 0,
    reused: 0,
    duplicatesPrevented: 0,
  };

  const config = CRM_REGISTRY[spec.entityType as EntityKind];

  for (const cand of candidates) {
    // Already an existing catalog record?
    const ex = findMatch(existing, cand.normKey, spec.strategy);
    if (ex) {
      if (seenExisting.has(ex.id)) {
        report.duplicatesPrevented += 1;
        emit({ type: "record", entityType: spec.entityType, outcome: "duplicate", value: cand.value });
      } else {
        seenExisting.add(ex.id);
        report.reused += 1;
        emit({ type: "record", entityType: spec.entityType, outcome: "reused", value: cand.value });
      }
      continue;
    }

    // Already created earlier in this run?
    const cr = findMatch(createdThisRun, cand.normKey, spec.strategy);
    if (cr) {
      report.duplicatesPrevented += 1;
      emit({ type: "record", entityType: spec.entityType, outcome: "duplicate", value: cand.value });
      continue;
    }

    // Genuinely new — build a valid input; some kinds cannot auto-create.
    const raw = spec.buildInput(cand.value, cand.normKey);
    if (!raw) {
      if (!report.note && spec.uncreatableNote) report.note = spec.uncreatableNote;
      // Not creatable, but record the identity so later mentions collapse.
      createdThisRun.push({ id: `uncreatable:${cand.normKey}`, normKey: cand.normKey });
      report.duplicatesPrevented += 1;
      emit({ type: "record", entityType: spec.entityType, outcome: "duplicate", value: cand.value });
      continue;
    }

    if (dryRun) {
      createdThisRun.push({ id: `dry:${cand.normKey}`, normKey: cand.normKey });
      report.created += 1;
      emit({ type: "record", entityType: spec.entityType, outcome: "created", value: cand.value });
      continue;
    }

    const input = config.schema.parse(raw);
    const { id } = await config.create(input, actorId);
    await prisma.crmRecordProvenance.create({
      data: {
        entityType: spec.entityType,
        entityId: id,
        sourceDocumentId: cand.documentId,
        matchedKey: spec.fieldKey,
        extractedValue: cand.value,
        confidence: cand.confidence,
        provider: cand.provider,
      },
    });

    createdThisRun.push({ id, normKey: cand.normKey });
    report.created += 1;
    createdRecords.push({
      entityType: spec.entityType,
      entityId: id,
      name: cand.value,
      sourceDocument: cand.documentName,
      confidence: cand.confidence,
      provider: cand.provider,
    });
    emit({ type: "record", entityType: spec.entityType, outcome: "created", value: cand.value });
  }

  if (candidates.length === 0 && spec.uncreatableNote) report.note = spec.uncreatableNote;
  emit({ type: "kind-done", report });
  return report;
}

/** SUGGESTED link rows currently in the catalog (for delta reporting). */
function countSuggested(): Promise<number> {
  return prisma.documentLink.count({ where: { status: "SUGGESTED" } });
}

/** Documents that have an extraction but produced no link at all. */
async function countUnmatchedDocuments(): Promise<number> {
  return prisma.document.count({
    where: { deletedAt: null, extraction: { is: {} }, links: { none: {} } },
  });
}

export async function runBootstrap(
  opts: RunBootstrapOptions,
): Promise<BootstrapReport> {
  const { actorId, dryRun = false, onEvent } = opts;
  const emit = (e: BootstrapEvent) => onEvent?.(e);

  const createdRecords: CreatedRecord[] = [];
  const perKind: KindReport[] = [];
  for (const spec of KIND_SPECS) {
    perKind.push(await processKind(spec, actorId, dryRun, createdRecords, emit));
  }

  const totals = perKind.reduce(
    (acc, k) => ({
      rawValues: acc.rawValues + k.rawValues,
      created: acc.created + k.created,
      reused: acc.reused + k.reused,
      duplicatesPrevented: acc.duplicatesPrevented + k.duplicatesPrevented,
    }),
    { rawValues: 0, created: 0, reused: 0, duplicatesPrevented: 0 },
  );

  // Rerun linking so the freshly-created records get their suggested links.
  let linking: LinkCounts | null = null;
  let linksCreated = 0;
  const suggestedBefore = await countSuggested();
  if (!dryRun && totals.created > 0) {
    emit({ type: "linking-start" });
    linking = await runLinking({ actorId, force: true });
    emit({ type: "linking-done", counts: linking });
    linksCreated = Math.max(0, (await countSuggested()) - suggestedBefore);
  }

  return {
    dryRun,
    perKind,
    totals,
    createdRecords,
    linking,
    linksCreated,
    suggestedLinksAfter: await countSuggested(),
    unmatchedDocuments: await countUnmatchedDocuments(),
  };
}
