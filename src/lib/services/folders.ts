import "server-only";
import { prisma } from "@/lib/prisma";
import { emitEvent, EVENT_NAMES } from "@/lib/events";
import { ENTITY_TYPES } from "@/lib/constants";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { sanitizeName } from "@/lib/utils";
import type { Folder } from "@prisma/client";

/**
 * Folder tree service. Encapsulates the materialized-path invariants so that
 * callers never manipulate `path`/`depth` directly.
 *
 * Path convention: a folder's `path` holds the slash-wrapped ids of its
 * ancestors from root to parent, excluding itself. Root folders have path "/".
 *   root:        path "/",           depth 0
 *   root/child:  path "/<rootId>/",  depth 1
 */

const ROOT_PATH = "/";

/** Compute the child path/depth for a given parent (or root when null). */
function childPlacement(parent: Folder | null): { path: string; depth: number } {
  if (!parent) return { path: ROOT_PATH, depth: 0 };
  return { path: `${parent.path}${parent.id}/`, depth: parent.depth + 1 };
}

async function assertUniqueName(
  parentId: string | null,
  name: string,
  excludeId?: string,
): Promise<void> {
  const existing = await prisma.folder.findFirst({
    where: {
      parentId,
      name,
      deletedAt: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("يوجد مجلد بنفس الاسم في هذا الموقع");
  }
}

interface CreateFolderArgs {
  name: string;
  parentId: string | null;
  description?: string | null;
  createdById: string;
  isSystem?: boolean;
}

/** Create a folder, enforcing sibling-name uniqueness and path invariants. */
export async function createFolder(args: CreateFolderArgs): Promise<Folder> {
  const name = sanitizeName(args.name);
  if (!name) throw new ConflictError("اسم المجلد غير صالح");

  let parent: Folder | null = null;
  if (args.parentId) {
    parent = await prisma.folder.findFirst({
      where: { id: args.parentId, deletedAt: null },
    });
    if (!parent) throw new NotFoundError("المجلد الأصل غير موجود");
  }

  await assertUniqueName(args.parentId, name);

  const { path, depth } = childPlacement(parent);

  const folder = await prisma.folder.create({
    data: {
      name,
      description: args.description?.trim() || null,
      parentId: args.parentId,
      path,
      depth,
      isSystem: args.isSystem ?? false,
      createdById: args.createdById,
    },
  });

  await emitEvent({
    eventName: EVENT_NAMES.FolderCreated,
    actorId: args.createdById,
    entityType: ENTITY_TYPES.FOLDER,
    entityId: folder.id,
    metadata: { name: folder.name, parentId: args.parentId },
  });

  return folder;
}

/** Rename a folder (uniqueness enforced among siblings). */
export async function renameFolder(
  id: string,
  newName: string,
  actorId: string,
): Promise<Folder> {
  const folder = await prisma.folder.findFirst({
    where: { id, deletedAt: null },
  });
  if (!folder) throw new NotFoundError("المجلد غير موجود");

  const name = sanitizeName(newName);
  if (!name) throw new ConflictError("اسم المجلد غير صالح");

  await assertUniqueName(folder.parentId, name, folder.id);

  const updated = await prisma.folder.update({
    where: { id },
    data: { name },
  });

  await emitEvent({
    eventName: EVENT_NAMES.FolderRenamed,
    actorId,
    entityType: ENTITY_TYPES.FOLDER,
    entityId: id,
    metadata: { name, previousName: folder.name },
  });

  return updated;
}

/**
 * Soft-delete a folder and its entire subtree (folders + documents). System
 * folders are protected. Uses the materialized path to select descendants.
 */
export async function softDeleteFolder(
  id: string,
  actorId: string,
): Promise<void> {
  const folder = await prisma.folder.findFirst({
    where: { id, deletedAt: null },
  });
  if (!folder) throw new NotFoundError("المجلد غير موجود");
  if (folder.isSystem) {
    throw new ConflictError("لا يمكن حذف المجلدات الأساسية للنظام");
  }

  const subtreePath = `${folder.path}${folder.id}/`;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Descendant folder ids (path starts with the subtree prefix) + self.
    const descendants = await tx.folder.findMany({
      where: {
        deletedAt: null,
        OR: [{ id }, { path: { startsWith: subtreePath } }],
      },
      select: { id: true },
    });
    const folderIds = descendants.map((d) => d.id);

    await tx.document.updateMany({
      where: { folderId: { in: folderIds }, deletedAt: null },
      data: { deletedAt: now },
    });
    await tx.folder.updateMany({
      where: { id: { in: folderIds } },
      data: { deletedAt: now },
    });
  });

  await emitEvent({
    eventName: EVENT_NAMES.FolderDeleted,
    actorId,
    entityType: ENTITY_TYPES.FOLDER,
    entityId: id,
    metadata: { name: folder.name },
  });
}

/** Ordered breadcrumb trail (root → … → folder) using the materialized path. */
export async function getBreadcrumbs(
  folder: Pick<Folder, "id" | "name" | "path">,
): Promise<{ id: string; name: string }[]> {
  const ancestorIds = folder.path.split("/").filter(Boolean);
  if (ancestorIds.length === 0) {
    return [{ id: folder.id, name: folder.name }];
  }
  const ancestors = await prisma.folder.findMany({
    where: { id: { in: ancestorIds } },
    select: { id: true, name: true },
  });
  const byId = new Map(ancestors.map((a) => [a.id, a]));
  const trail = ancestorIds
    .map((aid) => byId.get(aid))
    .filter((a): a is { id: string; name: string } => Boolean(a));
  trail.push({ id: folder.id, name: folder.name });
  return trail;
}
