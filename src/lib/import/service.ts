import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ImportJob } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createFolder } from "@/lib/services/folders";
import { uploadDocument } from "@/lib/services/documents";
import { ALLOWED_EXTENSIONS } from "@/lib/constants";
import { MAX_UPLOAD_BYTES } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { sanitizeName } from "@/lib/utils";
import { fileChecksum } from "./checksum";
import { scanDirectory, type ScannedFile } from "./scanner";

/**
 * Document import engine (Phase 4.1). Recreates the source folder hierarchy in
 * the CRM and imports every supported file, reusing the existing folder +
 * document services (so materialized-path folders, on-disk storage, and the
 * folder.created / document.uploaded audit events all happen exactly as for a
 * manual upload). Idempotent + resumable: content is de-duplicated by SHA-256
 * and already-imported files are skipped on rerun.
 */

const ALLOWED = ALLOWED_EXTENSIONS as readonly string[];

export const IMPORT_STATUS = {
  IMPORTED: "IMPORTED",
  SKIPPED: "SKIPPED",
  FAILED: "FAILED",
} as const;

export const JOB_STATUS = {
  SCANNING: "SCANNING",
  IMPORTING: "IMPORTING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type ImportEvent =
  | { type: "scanning" }
  | { type: "scanned"; files: number; folders: number }
  | {
      type: "file";
      status: "imported" | "skipped" | "failed";
      relPath: string;
      reason?: string;
    }
  | {
      type: "progress";
      done: number;
      total: number;
      imported: number;
      skipped: number;
      failed: number;
    }
  | {
      type: "done";
      jobId: string;
      total: number;
      imported: number;
      skipped: number;
      failed: number;
    };

export interface RunImportOptions {
  sourceRoot: string;
  actorId: string;
  onEvent?: (event: ImportEvent) => void;
}

/** Error message safe to surface (Arabic for AppError, generic otherwise). */
function reasonOf(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  return "خطأ غير معروف";
}

/**
 * Resolve (creating if needed) the DB folder for a file's segments, caching each
 * path prefix so a folder is looked up/created only once per run. Reuses an
 * existing sibling by sanitized name (requirement 3) — never duplicates.
 */
async function ensureFolderPath(
  segments: string[],
  actorId: string,
  cache: Map<string, string>,
): Promise<string | null> {
  let parentId: string | null = null;
  let prefix = "";

  for (const raw of segments) {
    const name = sanitizeName(raw) || raw;
    prefix = prefix ? `${prefix}/${name}` : name;

    const cached = cache.get(prefix);
    if (cached) {
      parentId = cached;
      continue;
    }

    const existing: { id: string } | null = await prisma.folder.findFirst({
      where: { parentId, name, deletedAt: null },
      select: { id: true },
    });
    const id: string = existing
      ? existing.id
      : (await createFolder({ name, parentId, createdById: actorId })).id;

    cache.set(prefix, id);
    parentId = id;
  }

  return parentId;
}

interface FileOutcome {
  status: "imported" | "skipped" | "failed";
  reason?: string;
}

/** Filesystem metadata persisted on the ImportFile ledger (create + update). */
function ledgerData(jobId: string, file: ScannedFile, checksum: string) {
  return {
    jobId,
    relativePath: file.relPath,
    originalName: file.name,
    extension: file.extension,
    size: file.size,
    checksum,
    sourceCreatedAt: file.createdAt,
    sourceModifiedAt: file.modifiedAt,
  };
}

async function recordLedger(
  jobId: string,
  file: ScannedFile,
  checksum: string,
  status: string,
  reason: string | null,
  documentId: string | null,
): Promise<void> {
  const base = ledgerData(jobId, file, checksum);
  await prisma.importFile.upsert({
    where: { checksum },
    create: { ...base, status, reason, documentId },
    update: {
      jobId,
      relativePath: file.relPath,
      originalName: file.name,
      extension: file.extension,
      size: file.size,
      status,
      reason,
      documentId,
    },
  });
}

/**
 * Import a single scanned file. Returns its outcome. Already-imported content
 * (by checksum) is skipped; unsupported/empty/oversized files are recorded as
 * SKIPPED (so reruns don't retry them); upload failures are recorded as FAILED
 * (so reruns retry them).
 */
async function importOneFile(
  jobId: string,
  file: ScannedFile,
  actorId: string,
  rootFallbackName: string,
  folderCache: Map<string, string>,
): Promise<FileOutcome> {
  const checksum = await fileChecksum(file.absPath);

  const existing = await prisma.importFile.findUnique({
    where: { checksum },
    select: { status: true, documentId: true },
  });
  if (existing?.status === IMPORT_STATUS.IMPORTED && existing.documentId) {
    return { status: "skipped", reason: "مستورد مسبقًا (تطابق البصمة)" };
  }

  // Classify non-importable files → SKIPPED (durably, so reruns don't retry).
  const ext = file.extension;
  if (!ext || !ALLOWED.includes(ext)) {
    await recordLedger(jobId, file, checksum, IMPORT_STATUS.SKIPPED, "نوع ملف غير مدعوم", null);
    return { status: "skipped", reason: "نوع ملف غير مدعوم" };
  }
  if (file.size <= 0) {
    await recordLedger(jobId, file, checksum, IMPORT_STATUS.SKIPPED, "ملف فارغ", null);
    return { status: "skipped", reason: "ملف فارغ" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    await recordLedger(jobId, file, checksum, IMPORT_STATUS.SKIPPED, "حجم الملف يتجاوز الحد المسموح", null);
    return { status: "skipped", reason: "حجم الملف يتجاوز الحد المسموح" };
  }

  try {
    const segments = file.segments.length > 0 ? file.segments : [rootFallbackName];
    const folderId = await ensureFolderPath(segments, actorId, folderCache);
    if (!folderId) throw new AppError("تعذّر تحديد المجلد الوجهة");

    const buffer = await readFile(file.absPath);
    const document = await uploadDocument({
      folderId,
      originalName: file.name,
      buffer,
      uploadedById: actorId,
    });

    await recordLedger(jobId, file, checksum, IMPORT_STATUS.IMPORTED, null, document.id);
    return { status: "imported" };
  } catch (error) {
    const reason = reasonOf(error);
    await recordLedger(jobId, file, checksum, IMPORT_STATUS.FAILED, reason, null);
    return { status: "failed", reason };
  }
}

/** Persist the job's running counters (throttled by the caller). */
function persistCounts(
  jobId: string,
  counts: { imported: number; skipped: number; failed: number },
) {
  return prisma.importJob.update({
    where: { id: jobId },
    data: {
      importedCount: counts.imported,
      skippedCount: counts.skipped,
      failedCount: counts.failed,
    },
  });
}

/**
 * Run a full import over `sourceRoot`. Creates an ImportJob, scans, imports each
 * file, and finalizes the job. Safe to run repeatedly — a second run continues
 * where a stopped one left off and skips everything already imported.
 */
export async function runImport(opts: RunImportOptions): Promise<ImportJob> {
  const { sourceRoot, actorId, onEvent } = opts;
  const emit = (e: ImportEvent) => onEvent?.(e);

  emit({ type: "scanning" });
  const { files, folderCount } = await scanDirectory(sourceRoot);
  emit({ type: "scanned", files: files.length, folders: folderCount });

  const job = await prisma.importJob.create({
    data: {
      sourceRoot,
      status: JOB_STATUS.IMPORTING,
      totalFiles: files.length,
      scannedFolders: folderCount,
      startedById: actorId,
    },
  });

  const rootFallbackName = sanitizeName(path.basename(sourceRoot)) || "المستندات";
  const folderCache = new Map<string, string>();
  const counts = { imported: 0, skipped: 0, failed: 0 };

  try {
    let done = 0;
    for (const file of files) {
      const outcome = await importOneFile(
        job.id,
        file,
        actorId,
        rootFallbackName,
        folderCache,
      );
      counts[outcome.status] += 1;
      done += 1;

      emit({ type: "file", status: outcome.status, relPath: file.relPath, reason: outcome.reason });
      emit({ type: "progress", done, total: files.length, ...counts });

      // Throttle job-counter writes; always persist the final tally below.
      if (done % 25 === 0) await persistCounts(job.id, counts);
    }

    const finished = await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: JOB_STATUS.COMPLETED,
        importedCount: counts.imported,
        skippedCount: counts.skipped,
        failedCount: counts.failed,
        finishedAt: new Date(),
      },
    });

    emit({ type: "done", jobId: job.id, total: files.length, ...counts });
    return finished;
  } catch (error) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: JOB_STATUS.FAILED,
        importedCount: counts.imported,
        skippedCount: counts.skipped,
        failedCount: counts.failed,
        error: reasonOf(error),
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

/** Resolve the user to attribute the import to (default: earliest admin). */
export async function resolveImportActor(): Promise<{ id: string; name: string }> {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) {
    throw new Error(
      "لا يوجد مستخدم مدير لنسب عملية الاستيراد إليه. شغّل npm run db:seed أولًا.",
    );
  }
  return admin;
}
