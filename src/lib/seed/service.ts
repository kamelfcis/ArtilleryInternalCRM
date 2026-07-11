import "server-only";
import { prisma } from "@/lib/prisma";
import { normalize } from "@/lib/search/normalize";
import { scoreName, normalizeRef } from "@/lib/linking/matchers";
import { ENTITY_KINDS, ENTITY_KIND_META, type EntityKind } from "@/lib/crm/constants";
import { provisionEntityFolder } from "@/lib/crm/entity-folder";
import { emitCrmEvent } from "@/lib/crm/services/shared";
import { resolveImportActor } from "@/lib/import/service";
import {
  SEED_KINDS,
  SEED_SOURCE,
  SEED_CREATED_FROM,
  emptyKindResult,
  type Candidate,
  type EntityCluster,
  type RunSeedOptions,
  type SeedCounts,
  type SeedEvent,
  type SeedKindSpec,
} from "./types";

/**
 * Smart CRM Seed Engine (Phase 4.5).
 *
 * Bootstraps the CRM tables (Company / Site / Project / Practice / Contract /
 * Purchase) from the REAL entities Phase 4.3 extracted out of the imported
 * documents. It never invents sample data: every record traces back to an
 * extracted DocumentField and carries its provenance (source document, OCR
 * origin, confidence) on the emitted `crm.record.created` event — which the
 * audit subscriber turns into a CREATE_RECORD audit entry.
 *
 * Pipeline per kind:
 *   1. Gather the extracted values for the kind's field key.
 *   2. Quality-gate each value (confidence floor, sane length, non-empty).
 *   3. Normalize + Arabic-fold, then fuzzy-cluster duplicates WITHIN the batch.
 *   4. For each cluster, fuzzy/exact-match against EXISTING CRM records:
 *        match → reuse (never duplicate);  no match → create a new record.
 *
 * Idempotent: a cleaned value stored on run 1 folds to the same key on run 2, so
 * every cluster re-matches its own record and nothing is recreated.
 */

/** Merge same-entity variants/fragments seen within one batch (containment-level). */
const WITHIN_BATCH_MERGE = 0.72;
/** Reuse an EXISTING record only for near-identical names — keeps reruns idempotent
 *  without wrongly merging distinct entities. Exact folded-equality scores 0.9. */
const DB_REUSE_THRESHOLD = 0.85;

/**
 * Tidy an extracted name for storage/display: turn stray slash separators into
 * spaces, collapse whitespace, trim edge punctuation. Deterministic, so rerunning
 * over the same source value yields the identical stored name.
 */
function cleanName(raw: string): string {
  return raw
    .replace(/\s*[/\\]\s*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:.,،؛]+|[\s\-–—:.,،؛]+$/g, "")
    .trim();
}

/** Folded comparison key for a name (whitespace-collapsed). */
const nameKey = (v: string): string => normalize(v).replace(/\s+/g, " ").trim();

interface Evaluation {
  value: string;
  matchKey: string;
  reason: string | null;
}

/** Quality-gate one extracted occurrence for a kind; `reason` set = rejected. */
function evaluate(
  spec: SeedKindSpec,
  f: { value: string; normalizedValue: string | null; confidence: number },
): Evaluation {
  if (spec.mode === "ref") {
    const value = (f.normalizedValue ?? f.value).trim();
    const matchKey = normalizeRef(value);
    if (!matchKey) return { value, matchKey, reason: "لا يوجد رقم مرجعي صالح" };
    if (f.confidence < spec.minConfidence)
      return { value, matchKey, reason: `ثقة منخفضة (${f.confidence.toFixed(2)})` };
    return { value, matchKey, reason: null };
  }
  const value = cleanName(f.value);
  const matchKey = nameKey(value);
  if (matchKey.length < 3) return { value, matchKey, reason: "قيمة قصيرة جدًا" };
  if (value.length > spec.maxNameLength)
    return { value, matchKey, reason: "قيمة طويلة (وصف وليست كيانًا)" };
  if (f.confidence < spec.minConfidence)
    return { value, matchKey, reason: `ثقة منخفضة (${f.confidence.toFixed(2)})` };
  return { value, matchKey, reason: null };
}

/**
 * Cluster candidate occurrences into distinct real-world entities. Highest
 * confidence (then longer value) wins the canonical form; name mode merges
 * fuzzy variants, ref mode merges only exact normalized refs.
 */
function cluster(cands: Candidate[], mode: "name" | "ref"): EntityCluster[] {
  const sorted = [...cands].sort(
    (a, b) =>
      b.confidence - a.confidence ||
      b.value.length - a.value.length ||
      a.value.localeCompare(b.value),
  );
  const clusters: EntityCluster[] = [];
  for (const c of sorted) {
    const target = clusters.find((cl) =>
      cl.matchKey === c.matchKey ||
      (mode === "name" && scoreName(cl.matchKey, c.matchKey) >= WITHIN_BATCH_MERGE),
    );
    if (target) {
      if (!target.documentIds.includes(c.documentId)) target.documentIds.push(c.documentId);
      continue;
    }
    clusters.push({
      canonical: c.value,
      matchKey: c.matchKey,
      confidence: c.confidence,
      documentIds: [c.documentId],
      primaryDocumentId: c.documentId,
      primaryDocumentName: c.documentName,
    });
  }
  return clusters;
}

/** Minimal existing-record snapshot for reuse checks. */
interface ExistingRecord {
  id: string;
  /** Name (name mode) or reference number (ref mode). */
  key: string;
}

async function loadExisting(kind: EntityKind): Promise<ExistingRecord[]> {
  const map = (rows: { id: string; key: string }[]) => rows;
  switch (kind) {
    case ENTITY_KINDS.COMPANY:
      return map((await prisma.company.findMany({ where: { deletedAt: null }, select: { id: true, name: true } })).map((r) => ({ id: r.id, key: r.name })));
    case ENTITY_KINDS.SITE:
      return map((await prisma.site.findMany({ where: { deletedAt: null }, select: { id: true, name: true } })).map((r) => ({ id: r.id, key: r.name })));
    case ENTITY_KINDS.PROJECT:
      return map((await prisma.project.findMany({ where: { deletedAt: null }, select: { id: true, name: true } })).map((r) => ({ id: r.id, key: r.name })));
    case ENTITY_KINDS.PRACTICE:
      return map((await prisma.practice.findMany({ where: { deletedAt: null }, select: { id: true, referenceNumber: true } })).map((r) => ({ id: r.id, key: r.referenceNumber })));
    case ENTITY_KINDS.CONTRACT:
      return map((await prisma.contract.findMany({ where: { deletedAt: null }, select: { id: true, contractNumber: true } })).map((r) => ({ id: r.id, key: r.contractNumber })));
    case ENTITY_KINDS.PURCHASE:
      return map((await prisma.purchase.findMany({ where: { deletedAt: null }, select: { id: true, purchaseNumber: true } })).map((r) => ({ id: r.id, key: r.purchaseNumber })));
    default:
      return [];
  }
}

/** Return the id of an existing record this cluster should reuse, or null. */
function findExisting(
  spec: SeedKindSpec,
  entity: EntityCluster,
  existing: ExistingRecord[],
): string | null {
  if (spec.mode === "ref") {
    const hit = existing.find((e) => normalizeRef(e.key) === entity.matchKey);
    return hit?.id ?? null;
  }
  let best: { id: string; score: number } | null = null;
  for (const e of existing) {
    const score = scoreName(entity.matchKey, nameKey(e.key));
    if (score >= DB_REUSE_THRESHOLD && (!best || score > best.score)) {
      best = { id: e.id, score };
    }
  }
  return best?.id ?? null;
}

/** Human-readable provenance stored on the record's own notes/description field. */
function provenanceNote(entity: EntityCluster): string {
  return `مصدر: استخراج ذكي (${SEED_CREATED_FROM}) — وثيقة: ${entity.primaryDocumentName} — ثقة: ${entity.confidence.toFixed(2)}`;
}

/** Provenance metadata carried on the domain event → persisted in the audit trail. */
function provenanceMeta(spec: SeedKindSpec, entity: EntityCluster): Record<string, unknown> {
  return {
    source: SEED_SOURCE,
    createdFrom: SEED_CREATED_FROM,
    document: entity.primaryDocumentName,
    documentId: entity.primaryDocumentId,
    documentCount: entity.documentIds.length,
    confidence: Number(entity.confidence.toFixed(2)),
    field: spec.fieldKey,
  };
}

/** Title for a reference-number kind: the source document name, else label + ref. */
function refTitle(spec: SeedKindSpec, entity: EntityCluster): string {
  const fromDoc = entity.primaryDocumentName.replace(/\.[^.]+$/, "").trim();
  return fromDoc || `${ENTITY_KIND_META[spec.kind].labelSingular} ${entity.canonical}`;
}

async function setFolderId(kind: EntityKind, id: string, folderId: string): Promise<void> {
  switch (kind) {
    case ENTITY_KINDS.COMPANY: await prisma.company.update({ where: { id }, data: { folderId } }); break;
    case ENTITY_KINDS.SITE: await prisma.site.update({ where: { id }, data: { folderId } }); break;
    case ENTITY_KINDS.PROJECT: await prisma.project.update({ where: { id }, data: { folderId } }); break;
    case ENTITY_KINDS.PRACTICE: await prisma.practice.update({ where: { id }, data: { folderId } }); break;
    case ENTITY_KINDS.CONTRACT: await prisma.contract.update({ where: { id }, data: { folderId } }); break;
    case ENTITY_KINDS.PURCHASE: await prisma.purchase.update({ where: { id }, data: { folderId } }); break;
  }
}

/**
 * Create one CRM record from a cluster, mirroring the CRM services' pattern:
 * insert → provision a dedicated document folder → emit `crm.record.created`
 * (with provenance) so the audit subscriber records it. Returns the stored key
 * and display name, or a skip reason when the record can't be formed.
 */
async function persistRecord(
  spec: SeedKindSpec,
  entity: EntityCluster,
  actorId: string,
  companyId: string | null,
): Promise<{ id: string; storedKey: string; displayName: string } | { skip: string }> {
  const note = provenanceNote(entity);
  const kind = spec.kind;
  let id: string;
  let displayName: string;
  let storedKey: string;

  if (kind === ENTITY_KINDS.COMPANY) {
    displayName = storedKey = entity.canonical;
    id = (await prisma.company.create({ data: { name: displayName, status: "ACTIVE", notes: note, createdById: actorId } })).id;
  } else if (kind === ENTITY_KINDS.SITE) {
    displayName = storedKey = entity.canonical;
    id = (await prisma.site.create({ data: { name: displayName, description: note, createdById: actorId } })).id;
  } else if (kind === ENTITY_KINDS.PROJECT) {
    displayName = storedKey = entity.canonical;
    id = (await prisma.project.create({ data: { name: displayName, status: "PLANNED", description: note, createdById: actorId } })).id;
  } else if (kind === ENTITY_KINDS.PRACTICE) {
    displayName = refTitle(spec, entity);
    storedKey = entity.canonical;
    id = (await prisma.practice.create({ data: { referenceNumber: entity.canonical, title: displayName, description: note, status: "DRAFT", createdById: actorId } })).id;
  } else if (kind === ENTITY_KINDS.CONTRACT) {
    if (!companyId) return { skip: "لا توجد شركة مرتبطة (العقد يتطلب شركة)" };
    displayName = refTitle(spec, entity);
    storedKey = entity.canonical;
    id = (await prisma.contract.create({ data: { contractNumber: entity.canonical, title: displayName, description: note, status: "DRAFT", companyId, createdById: actorId } })).id;
  } else {
    displayName = refTitle(spec, entity);
    storedKey = entity.canonical;
    id = (await prisma.purchase.create({ data: { purchaseNumber: entity.canonical, title: displayName, description: note, status: "REQUESTED", companyId: companyId ?? undefined, createdById: actorId } })).id;
  }

  const folderId = await provisionEntityFolder(kind, displayName, actorId);
  await setFolderId(kind, id, folderId);
  await emitCrmEvent("create", kind, id, displayName, actorId, provenanceMeta(spec, entity));
  return { id, storedKey, displayName };
}

/**
 * Run the Smart Seed Engine over every extracted document field. Safe to run
 * repeatedly — an already-seeded entity is reused, never duplicated.
 */
export async function runSeed(opts: RunSeedOptions): Promise<SeedCounts> {
  const { actorId, onEvent } = opts;
  const emit = (e: SeedEvent) => onEvent?.(e);

  emit({ type: "scanning" });

  const keys = SEED_KINDS.map((s) => s.fieldKey);
  const fields = await prisma.documentField.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true, normalizedValue: true, confidence: true, documentId: true },
  });
  const docIds = [...new Set(fields.map((f) => f.documentId))];
  const docs = await prisma.document.findMany({
    where: { id: { in: docIds }, deletedAt: null },
    select: { id: true, name: true },
  });
  const docName = new Map(docs.map((d) => [d.id, d.name]));
  emit({ type: "scanned", fields: fields.length, documents: docs.length });

  const counts = Object.fromEntries(
    Object.values(ENTITY_KINDS).map((k) => [k, emptyKindResult()]),
  ) as SeedCounts;

  // Records the company chosen for each document, so a contract/purchase from the
  // same document can attach to it (Contract.company is required).
  const companyByDocument = new Map<string, string>();
  const companyFor = (documentIds: string[]): string | null => {
    for (const d of documentIds) {
      const id = companyByDocument.get(d);
      if (id) return id;
    }
    return null;
  };

  for (const spec of SEED_KINDS) {
    const raw = fields.filter((f) => f.key === spec.fieldKey);

    // Quality gate → passing candidates + distinct values that never qualified.
    const passing: Candidate[] = [];
    const passedKeys = new Set<string>();
    const failed = new Map<string, string>();
    for (const f of raw) {
      const ev = evaluate(spec, f);
      if (ev.reason) {
        if (!failed.has(ev.matchKey)) failed.set(ev.matchKey, `${ev.value} — ${ev.reason}`);
        continue;
      }
      passedKeys.add(ev.matchKey);
      passing.push({
        value: ev.value,
        matchKey: ev.matchKey,
        confidence: f.confidence,
        documentId: f.documentId,
        documentName: docName.get(f.documentId) ?? "—",
      });
    }

    const clusters = cluster(passing, spec.mode);
    emit({ type: "kind-start", kind: spec.kind, candidates: clusters.length });

    const existing = await loadExisting(spec.kind);

    for (const entity of clusters) {
      const existingId = findExisting(spec, entity, existing);
      if (existingId) {
        counts[spec.kind].reused += 1;
        if (spec.kind === ENTITY_KINDS.COMPANY)
          for (const d of entity.documentIds) companyByDocument.set(d, existingId);
        emit({ type: "reused", kind: spec.kind, name: entity.canonical, existing: existingId });
        continue;
      }
      try {
        const companyId =
          spec.kind === ENTITY_KINDS.CONTRACT || spec.kind === ENTITY_KINDS.PURCHASE
            ? companyFor(entity.documentIds)
            : null;
        const res = await persistRecord(spec, entity, actorId, companyId);
        if ("skip" in res) {
          counts[spec.kind].skipped += 1;
          emit({ type: "skipped", kind: spec.kind, value: entity.canonical, reason: res.skip });
          continue;
        }
        counts[spec.kind].created += 1;
        existing.push({ id: res.id, key: res.storedKey });
        if (spec.kind === ENTITY_KINDS.COMPANY)
          for (const d of entity.documentIds) companyByDocument.set(d, res.id);
        emit({
          type: "created",
          kind: spec.kind,
          name: res.displayName,
          confidence: entity.confidence,
          document: entity.primaryDocumentName,
        });
      } catch (error) {
        counts[spec.kind].errors += 1;
        emit({
          type: "error",
          kind: spec.kind,
          value: entity.canonical,
          reason: error instanceof Error ? error.message : "خطأ غير معروف",
        });
      }
    }

    // Distinct values that never passed the gate in any document → skipped.
    for (const [key, detail] of failed) {
      if (passedKeys.has(key)) continue;
      counts[spec.kind].skipped += 1;
      emit({ type: "skipped", kind: spec.kind, value: detail, reason: "لم تجتز فلترة الجودة" });
    }

    emit({ type: "kind-done", kind: spec.kind, result: counts[spec.kind] });
  }

  emit({ type: "done", counts });
  return counts;
}

export { resolveImportActor };
