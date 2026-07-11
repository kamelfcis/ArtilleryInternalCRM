import "server-only";
import { prisma } from "@/lib/prisma";
import { emitEvent, EVENT_NAMES } from "@/lib/events";
import { deleteStored } from "@/lib/storage";
import { ENTITY_TYPES } from "@/lib/constants";
import { NotFoundError, ConflictError } from "@/lib/errors";

export interface TrashItem {
  id: string;
  name: string;
  kind: "folder" | "document";
  deletedAt: Date;
  extension?: string | null;
  size?: number;
}

/**
 * List the recycle bin. Shows the *roots* of each deletion only — a folder is
 * shown when its parent is not itself deleted, and a document is shown when its
 * folder is not deleted — so cascaded children are not listed redundantly.
 */
export async function listTrash(): Promise<TrashItem[]> {
  const [folders, documents] = await Promise.all([
    prisma.folder.findMany({
      where: {
        deletedAt: { not: null },
        OR: [{ parent: null }, { parent: { deletedAt: null } }],
      },
      orderBy: { deletedAt: "desc" },
      select: { id: true, name: true, deletedAt: true },
    }),
    prisma.document.findMany({
      where: { deletedAt: { not: null }, folder: { deletedAt: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        name: true,
        deletedAt: true,
        extension: true,
        size: true,
      },
    }),
  ]);

  const items: TrashItem[] = [
    ...folders.map((f) => ({
      id: f.id,
      name: f.name,
      kind: "folder" as const,
      deletedAt: f.deletedAt as Date,
    })),
    ...documents.map((d) => ({
      id: d.id,
      name: d.name,
      kind: "document" as const,
      deletedAt: d.deletedAt as Date,
      extension: d.extension,
      size: d.size,
    })),
  ];

  return items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}

/**
 * Restore a soft-deleted folder and everything removed in the same delete
 * operation (matched by identical `deletedAt` timestamp), so an accidental
 * folder deletion can be fully undone.
 */
export async function restoreFolder(id: string, actorId: string) {
  const folder = await prisma.folder.findFirst({
    where: { id, deletedAt: { not: null } },
    select: { id: true, name: true, path: true, deletedAt: true, parentId: true },
  });
  if (!folder) throw new NotFoundError("المجلد غير موجود في المحذوفات");

  // Guard: cannot restore into a still-deleted parent.
  if (folder.parentId) {
    const parent = await prisma.folder.findUnique({
      where: { id: folder.parentId },
      select: { deletedAt: true },
    });
    if (parent?.deletedAt) {
      throw new ConflictError("يجب استعادة المجلد الأصل أولًا");
    }
  }

  const subtreePrefix = `${folder.path}${folder.id}/`;
  const deletedAt = folder.deletedAt as Date;

  await prisma.$transaction(async (tx) => {
    const folderIds = (
      await tx.folder.findMany({
        where: {
          deletedAt,
          OR: [{ id }, { path: { startsWith: subtreePrefix } }],
        },
        select: { id: true },
      })
    ).map((f) => f.id);

    await tx.folder.updateMany({
      where: { id: { in: folderIds } },
      data: { deletedAt: null },
    });
    await tx.document.updateMany({
      where: { folderId: { in: folderIds }, deletedAt },
      data: { deletedAt: null },
    });
  });

  await emitEvent({
    eventName: EVENT_NAMES.FolderRestored,
    actorId,
    entityType: ENTITY_TYPES.FOLDER,
    entityId: id,
    metadata: { name: folder.name },
  });
}

/** Restore a single soft-deleted document. */
export async function restoreDocument(id: string, actorId: string) {
  const document = await prisma.document.findFirst({
    where: { id, deletedAt: { not: null } },
    select: { id: true, name: true, folder: { select: { deletedAt: true } } },
  });
  if (!document) throw new NotFoundError("الوثيقة غير موجودة في المحذوفات");
  if (document.folder.deletedAt) {
    throw new ConflictError("يجب استعادة المجلد الحاوي أولًا");
  }

  await prisma.document.update({
    where: { id },
    data: { deletedAt: null },
  });

  await emitEvent({
    eventName: EVENT_NAMES.DocumentRestored,
    actorId,
    entityType: ENTITY_TYPES.DOCUMENT,
    entityId: id,
    metadata: { name: document.name },
  });
}

/** Permanently remove a document and all its stored version files. */
export async function purgeDocument(id: string, actorId: string) {
  const document = await prisma.document.findFirst({
    where: { id, deletedAt: { not: null } },
    select: {
      id: true,
      name: true,
      versions: { select: { storageKey: true } },
    },
  });
  if (!document) throw new NotFoundError("الوثيقة غير موجودة في المحذوفات");

  await prisma.document.delete({ where: { id } });
  for (const v of document.versions) {
    await deleteStored(v.storageKey);
  }

  await emitEvent({
    eventName: EVENT_NAMES.RecyclePurged,
    actorId,
    entityType: ENTITY_TYPES.DOCUMENT,
    entityId: id,
    metadata: { name: document.name, permanent: true },
  });
}
