import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { readStored } from "@/lib/storage";
import { emitEvent, EVENT_NAMES } from "@/lib/events";
import { ENTITY_TYPES } from "@/lib/constants";
import { resolveImportActor } from "@/lib/import/service";
import { parserFor } from "./registry";
import { shutdownOcr } from "./tesseract";
import { UnsupportedFormatError, type ExtractedPage } from "./types";

/**
 * OCR / text-extraction pipeline (Phase 4.2). Walks stored documents, extracts
 * raw text (embedded PDF text layer when readable, else Tesseract OCR; office
 * formats via their parsers) and persists one DocumentText row per page/sheet.
 *
 * Idempotent + content-addressed: each row records the SHA-256 of the document
 * bytes it was derived from. A rerun skips a document whose stored text already
 * matches the current hash, and re-extracts (replacing old rows) only when the
 * file changed. This is RAW text only — Phase 4.3 (AI extraction) reads these
 * rows and never overwrites them.
 */

export type OcrOutcomeStatus = "extracted" | "skipped" | "unsupported" | "failed";

export interface OcrCounts {
  extracted: number;
  skipped: number;
  unsupported: number;
  failed: number;
}

export type OcrEvent =
  | { type: "scanning" }
  | { type: "scanned"; total: number }
  | {
      type: "document";
      status: OcrOutcomeStatus;
      name: string;
      pages?: number;
      reason?: string;
    }
  | { type: "progress"; done: number; total: number } & OcrCounts
  | { type: "done"; total: number } & OcrCounts;

export interface RunOcrOptions {
  actorId: string;
  /** Re-extract even if the stored text already matches the current hash. */
  force?: boolean;
  /** Only process this document id. */
  documentId?: string;
  /** Cap the number of documents processed (after ordering by createdAt). */
  limit?: number;
  onEvent?: (event: OcrEvent) => void;
}

interface DocRow {
  id: string;
  name: string;
  extension: string | null;
  mimeType: string;
  storageKey: string;
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Method reported on the audit event for the whole document. */
function summarizeMethod(pages: ExtractedPage[]): string {
  const methods = new Set(pages.map((p) => p.method));
  if (methods.size === 1) return [...methods][0] ?? "none";
  return "mixed";
}

function averageConfidence(pages: ExtractedPage[]): number {
  if (pages.length === 0) return 0;
  const sum = pages.reduce((acc, p) => acc + p.confidence, 0);
  return Math.round((sum / pages.length) * 10) / 10;
}

/** A single unextractable page recorded so unsupported files are not retried. */
function sentinelPages(): ExtractedPage[] {
  return [{ pageNumber: 1, text: "", language: "und", confidence: 0, method: "none" }];
}

/** Replace a document's extracted text with a fresh set of pages, atomically. */
async function persistPages(
  documentId: string,
  sourceHash: string,
  pages: ExtractedPage[],
): Promise<void> {
  await prisma.$transaction([
    prisma.documentText.deleteMany({ where: { documentId } }),
    prisma.documentText.createMany({
      data: pages.map((p) => ({
        documentId,
        pageNumber: p.pageNumber,
        rawText: p.text,
        language: p.language,
        confidence: p.confidence,
        method: p.method,
        sourceHash,
      })),
    }),
  ]);
}

interface DocOutcome {
  status: OcrOutcomeStatus;
  pages?: number;
  reason?: string;
}

async function extractOneDocument(
  doc: DocRow,
  actorId: string,
  force: boolean,
): Promise<DocOutcome> {
  const buffer = await readStored(doc.storageKey);
  const sourceHash = sha256(buffer);

  // Idempotency: skip when the stored text already matches the current bytes.
  const existing = await prisma.documentText.findFirst({
    where: { documentId: doc.id },
    select: { sourceHash: true },
  });
  if (!force && existing && existing.sourceHash === sourceHash) {
    return { status: "skipped", reason: "مستخرج مسبقًا (لم يتغيّر الملف)" };
  }

  const parser = parserFor(doc.extension);

  let pages: ExtractedPage[];
  let status: OcrOutcomeStatus;
  if (!parser) {
    pages = sentinelPages();
    status = "unsupported";
  } else {
    try {
      const result = await parser.parse({
        buffer,
        extension: (doc.extension ?? "").toLowerCase(),
        mimeType: doc.mimeType,
      });
      pages = result.pages.length > 0 ? result.pages : sentinelPages();
      status = "extracted";
    } catch (error) {
      if (error instanceof UnsupportedFormatError) {
        pages = sentinelPages();
        status = "unsupported";
      } else {
        throw error;
      }
    }
  }

  await persistPages(doc.id, sourceHash, pages);

  // Audit + future subscribers react to this fact (emitted after the write).
  await emitEvent({
    actorId,
    eventName: EVENT_NAMES.DocumentTextExtracted,
    entityType: ENTITY_TYPES.DOCUMENT,
    entityId: doc.id,
    metadata: {
      name: doc.name,
      pages: pages.length,
      method: summarizeMethod(pages),
      avgConfidence: averageConfidence(pages),
      chars: pages.reduce((acc, p) => acc + p.text.length, 0),
    },
  });

  return { status, pages: pages.length };
}

/**
 * Run text extraction over the document set. Safe to run repeatedly — unchanged
 * documents are skipped. Always shuts the OCR worker down when finished.
 */
export async function runOcr(opts: RunOcrOptions): Promise<OcrCounts> {
  const { actorId, force = false, documentId, limit, onEvent } = opts;
  const emit = (e: OcrEvent) => onEvent?.(e);

  emit({ type: "scanning" });
  const docs = (await prisma.document.findMany({
    where: { deletedAt: null, ...(documentId ? { id: documentId } : {}) },
    select: { id: true, name: true, extension: true, mimeType: true, storageKey: true },
    orderBy: { createdAt: "asc" },
    ...(limit ? { take: limit } : {}),
  })) satisfies DocRow[];
  emit({ type: "scanned", total: docs.length });

  const counts: OcrCounts = { extracted: 0, skipped: 0, unsupported: 0, failed: 0 };

  try {
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
        pages: outcome.pages,
        reason: outcome.reason,
      });
      emit({ type: "progress", done, total: docs.length, ...counts });
    }
  } finally {
    await shutdownOcr();
  }

  emit({ type: "done", total: docs.length, ...counts });
  return counts;
}

export { resolveImportActor };
