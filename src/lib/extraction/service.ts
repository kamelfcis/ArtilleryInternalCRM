import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { emitEvent, EVENT_NAMES } from "@/lib/events";
import { ENTITY_TYPES } from "@/lib/constants";
import { resolveImportActor } from "@/lib/import/service";
import { ruleExtractor } from "./rules";
import { llmExtractor } from "./llm";
import type { FieldCandidate } from "./types";

/**
 * Structured extraction pipeline (Phase 4.3). Reads each document's OCR text
 * (Phase 4.2), runs the hybrid extractor (local rules + optional Claude pass),
 * and persists the structured fields into DocumentField without ever touching
 * the OCR text. Idempotent + content-addressed: the extraction records the
 * SHA-256 of the OCR text it derived from, so a rerun skips documents whose
 * text is unchanged and re-extracts only when the OCR changed (or with --force).
 *
 * The extracted fields are the input to Phase 4.4 (CRM linking) — NOT built here.
 */

export type ExtractOutcomeStatus = "extracted" | "empty" | "skipped" | "failed";

export interface ExtractCounts {
  extracted: number;
  empty: number;
  skipped: number;
  failed: number;
}

export type ExtractEvent =
  | { type: "scanning" }
  | { type: "scanned"; total: number; llm: boolean }
  | {
      type: "document";
      status: ExtractOutcomeStatus;
      name: string;
      fields?: number;
      reason?: string;
    }
  | { type: "progress"; done: number; total: number } & ExtractCounts
  | { type: "done"; total: number } & ExtractCounts;

export interface RunExtractionOptions {
  actorId: string;
  force?: boolean;
  documentId?: string;
  limit?: number;
  onEvent?: (event: ExtractEvent) => void;
}

interface DocRow {
  id: string;
  name: string;
  texts: { pageNumber: number; rawText: string }[];
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

interface DocOutcome {
  status: ExtractOutcomeStatus;
  fields?: number;
  reason?: string;
}

/** Replace a document's extraction + fields atomically. */
async function persistExtraction(
  documentId: string,
  sourceHash: string,
  engine: string,
  model: string | null,
  fields: FieldCandidate[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.documentExtraction.deleteMany({ where: { documentId } });
    await tx.documentExtraction.create({
      data: {
        documentId,
        engine,
        model,
        sourceHash,
        fields: {
          create: fields.map((f) => ({
            documentId,
            key: f.key,
            value: f.value,
            normalizedValue: f.normalizedValue ?? null,
            confidence: f.confidence,
            source: f.source,
          })),
        },
      },
    });
  });
}

async function extractOneDocument(
  doc: DocRow,
  actorId: string,
  force: boolean,
): Promise<DocOutcome> {
  const text = doc.texts
    .slice()
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((t) => t.rawText)
    .join("\n\n")
    .trim();

  const sourceHash = sha256(text);

  const existing = await prisma.documentExtraction.findUnique({
    where: { documentId: doc.id },
    select: { sourceHash: true },
  });
  if (!force && existing && existing.sourceHash === sourceHash) {
    return { status: "skipped", reason: "مستخرج مسبقًا (لم يتغيّر النص)" };
  }

  // Rules always run; the LLM pass runs only when an API key is configured.
  const [ruleFields, llmFields] = await Promise.all([
    ruleExtractor.extract(text),
    llmExtractor.extract(text),
  ]);
  const fields = [...ruleFields, ...llmFields];

  const engine = llmExtractor.isAvailable() ? "hybrid" : "rules-only";
  const model = llmExtractor.isAvailable() ? llmExtractor.model : null;

  await persistExtraction(doc.id, sourceHash, engine, model, fields);

  await emitEvent({
    actorId,
    eventName: EVENT_NAMES.DocumentFieldsExtracted,
    entityType: ENTITY_TYPES.DOCUMENT,
    entityId: doc.id,
    metadata: {
      name: doc.name,
      fields: fields.length,
      engine,
      ruleFields: ruleFields.length,
      llmFields: llmFields.length,
    },
  });

  return fields.length > 0
    ? { status: "extracted", fields: fields.length }
    : { status: "empty", fields: 0 };
}

/**
 * Run structured extraction over every OCR'd document. Safe to run repeatedly —
 * unchanged documents are skipped.
 */
export async function runExtraction(opts: RunExtractionOptions): Promise<ExtractCounts> {
  const { actorId, force = false, documentId, limit, onEvent } = opts;
  const emit = (e: ExtractEvent) => onEvent?.(e);

  emit({ type: "scanning" });
  const docs = (await prisma.document.findMany({
    where: {
      deletedAt: null,
      texts: { some: {} },
      ...(documentId ? { id: documentId } : {}),
    },
    select: {
      id: true,
      name: true,
      texts: { select: { pageNumber: true, rawText: true } },
    },
    orderBy: { createdAt: "asc" },
    ...(limit ? { take: limit } : {}),
  })) satisfies DocRow[];
  emit({ type: "scanned", total: docs.length, llm: llmExtractor.isAvailable() });

  const counts: ExtractCounts = { extracted: 0, empty: 0, skipped: 0, failed: 0 };

  let done = 0;
  for (const doc of docs) {
    let outcome: DocOutcome;
    try {
      outcome = await extractOneDocument(doc, actorId, force);
    } catch (error) {
      outcome = {
        status: "failed",
        reason: error instanceof Error ? error.message : "خطأ غير معروف",
      };
    }
    counts[outcome.status] += 1;
    done += 1;

    emit({
      type: "document",
      status: outcome.status,
      name: doc.name,
      fields: outcome.fields,
      reason: outcome.reason,
    });
    emit({ type: "progress", done, total: docs.length, ...counts });
  }

  emit({ type: "done", total: docs.length, ...counts });
  return counts;
}

export { resolveImportActor };
