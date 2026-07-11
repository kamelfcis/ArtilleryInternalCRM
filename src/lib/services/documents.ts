import "server-only";
import { prisma } from "@/lib/prisma";
import { emitEvent, EVENT_NAMES } from "@/lib/events";
import { saveBuffer, deleteStored } from "@/lib/storage";
import {
  ENTITY_TYPES,
  ALLOWED_EXTENSIONS,
  MIME_BY_EXTENSION,
} from "@/lib/constants";
import { MAX_UPLOAD_BYTES } from "@/lib/env";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  getExtension,
  sanitizeName,
  stemFromFilename,
  stripTrailingExtension,
} from "@/lib/utils";

interface UploadInput {
  folderId: string;
  originalName: string;
  buffer: Buffer;
  declaredMime?: string;
  uploadedById: string;
  displayName?: string;
}

function validateFile(originalName: string, size: number): string {
  if (size <= 0) throw new ValidationError("الملف فارغ");
  if (size > MAX_UPLOAD_BYTES) {
    throw new ValidationError("حجم الملف يتجاوز الحد المسموح به");
  }
  const ext = getExtension(originalName);
  if (!ext || !(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new ValidationError("نوع الملف غير مسموح به");
  }
  return ext;
}

/** Upload a new document (version 1) into a folder. */
export async function uploadDocument(input: UploadInput) {
  const folder = await prisma.folder.findFirst({
    where: { id: input.folderId, deletedAt: null },
    select: { id: true },
  });
  if (!folder) throw new NotFoundError("المجلد غير موجود");

  const ext = validateFile(input.originalName, input.buffer.length);
  const mimeType =
    MIME_BY_EXTENSION[ext] ?? input.declaredMime ?? "application/octet-stream";

  const rawDisplay =
    input.displayName?.trim() || stemFromFilename(input.originalName);
  const displayName =
    sanitizeName(stripTrailingExtension(rawDisplay, ext)) || rawDisplay;

  const storageKey = await saveBuffer(input.buffer, ext);

  try {
    const document = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          name: displayName,
          originalName: input.originalName,
          extension: ext,
          mimeType,
          size: input.buffer.length,
          storageKey,
          currentVersion: 1,
          folderId: input.folderId,
          uploadedById: input.uploadedById,
        },
      });
      await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          version: 1,
          storageKey,
          size: input.buffer.length,
          mimeType,
          uploadedById: input.uploadedById,
        },
      });
      return doc;
    });

    await emitEvent({
      eventName: EVENT_NAMES.DocumentUploaded,
      actorId: input.uploadedById,
      entityType: ENTITY_TYPES.DOCUMENT,
      entityId: document.id,
      metadata: {
        name: document.name,
        folderId: input.folderId,
        size: input.buffer.length,
      },
    });

    return document;
  } catch (error) {
    // Roll back the orphaned file if the DB write failed.
    await deleteStored(storageKey);
    throw error;
  }
}

/** Add a new version to an existing document, making it current. */
export async function addDocumentVersion(input: {
  documentId: string;
  originalName: string;
  buffer: Buffer;
  note?: string;
  uploadedById: string;
}) {
  const document = await prisma.document.findFirst({
    where: { id: input.documentId, deletedAt: null },
  });
  if (!document) throw new NotFoundError("الوثيقة غير موجودة");

  const ext = validateFile(input.originalName, input.buffer.length);
  if (ext !== document.extension) {
    throw new ConflictError("يجب أن يكون نوع الإصدار الجديد مطابقًا للأصلي");
  }
  const mimeType = MIME_BY_EXTENSION[ext] ?? document.mimeType;
  const storageKey = await saveBuffer(input.buffer, ext);
  const nextVersion = document.currentVersion + 1;

  try {
    await prisma.$transaction([
      prisma.documentVersion.create({
        data: {
          documentId: document.id,
          version: nextVersion,
          storageKey,
          size: input.buffer.length,
          mimeType,
          note: input.note?.trim() || null,
          uploadedById: input.uploadedById,
        },
      }),
      prisma.document.update({
        where: { id: document.id },
        data: {
          currentVersion: nextVersion,
          storageKey,
          size: input.buffer.length,
          mimeType,
        },
      }),
    ]);
  } catch (error) {
    await deleteStored(storageKey);
    throw error;
  }

  await emitEvent({
    eventName: EVENT_NAMES.DocumentVersionCreated,
    actorId: input.uploadedById,
    entityType: ENTITY_TYPES.DOCUMENT,
    entityId: document.id,
    metadata: { name: document.name, version: nextVersion },
  });
}

/** Rename a document's display name. */
export async function renameDocument(
  id: string,
  newName: string,
  actorId: string,
) {
  const document = await prisma.document.findFirst({
    where: { id, deletedAt: null },
  });
  if (!document) throw new NotFoundError("الوثيقة غير موجودة");

  const raw = stripTrailingExtension(newName, document.extension);
  const name = sanitizeName(raw);
  if (!name) throw new ConflictError("اسم الوثيقة غير صالح");

  await prisma.document.update({ where: { id }, data: { name } });

  await emitEvent({
    eventName: EVENT_NAMES.DocumentUpdated,
    actorId,
    entityType: ENTITY_TYPES.DOCUMENT,
    entityId: id,
    metadata: { name, previousName: document.name },
  });
}

/** Soft-delete a document (recoverable from the recycle bin). */
export async function softDeleteDocument(id: string, actorId: string) {
  const document = await prisma.document.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!document) throw new NotFoundError("الوثيقة غير موجودة");

  await prisma.document.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await emitEvent({
    eventName: EVENT_NAMES.DocumentDeleted,
    actorId,
    entityType: ENTITY_TYPES.DOCUMENT,
    entityId: id,
    metadata: { name: document.name },
  });
}
