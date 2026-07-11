import "server-only";
import { prisma } from "@/lib/prisma";
import { createFolder } from "@/lib/services/folders";
import { ConflictError } from "@/lib/errors";
import { ENTITY_KIND_META, type EntityKind } from "@/lib/crm/constants";

/**
 * Find the top-level system folder that hosts a given entity kind's documents,
 * creating it if it does not yet exist (idempotent). This keeps every CRM
 * record's files under a familiar, browsable root (الشركات، التعاقدات، ...).
 */
async function ensureRootFolder(
  kind: EntityKind,
  actorId: string,
): Promise<{ id: string; path: string }> {
  const meta = ENTITY_KIND_META[kind];
  const existing = await prisma.folder.findFirst({
    where: { name: meta.rootFolderName, parentId: null, deletedAt: null },
    select: { id: true, path: true },
  });
  if (existing) return existing;

  const created = await createFolder({
    name: meta.rootFolderName,
    parentId: null,
    createdById: actorId,
    isSystem: true,
  });
  await prisma.folder.update({
    where: { id: created.id },
    data: { color: meta.color },
  });
  return { id: created.id, path: created.path };
}

/**
 * Provision a dedicated document folder for a CRM record under its kind's root
 * folder. Folder names must be unique among siblings, so on collision a numeric
 * suffix is appended. Returns the new folder id.
 */
export async function provisionEntityFolder(
  kind: EntityKind,
  entityName: string,
  actorId: string,
): Promise<string> {
  const root = await ensureRootFolder(kind, actorId);

  const baseName = entityName.trim() || ENTITY_KIND_META[kind].labelSingular;
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = attempt === 0 ? baseName : `${baseName} (${attempt + 1})`;
    try {
      const folder = await createFolder({
        name: candidate,
        parentId: root.id,
        createdById: actorId,
      });
      return folder.id;
    } catch (error) {
      if (error instanceof ConflictError) continue; // name taken → try next
      throw error;
    }
  }
  throw new ConflictError("تعذّر إنشاء مجلد المستندات لهذا السجل");
}

/** Rename a record's document folder to follow the record's new name. */
export async function syncEntityFolderName(
  folderId: string | null,
  newName: string,
  actorId: string,
): Promise<void> {
  if (!folderId) return;
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, deletedAt: null },
    select: { id: true, name: true, parentId: true },
  });
  if (!folder || folder.name === newName.trim()) return;

  // Best-effort rename; a name collision simply leaves the folder name as-is.
  const clash = await prisma.folder.findFirst({
    where: {
      parentId: folder.parentId,
      name: newName.trim(),
      deletedAt: null,
      NOT: { id: folder.id },
    },
    select: { id: true },
  });
  if (clash) return;

  await prisma.folder.update({
    where: { id: folder.id },
    data: { name: newName.trim() },
  });
}
