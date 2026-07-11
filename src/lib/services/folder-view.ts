import "server-only";
import { prisma } from "@/lib/prisma";
import { getBreadcrumbs } from "@/lib/services/folders";
import {
  getFolderCapabilities,
  roleBaselineLevel,
  type FolderCapabilities,
} from "@/lib/authz";
import { PERMISSION_LEVELS } from "@/lib/constants";
import { NotFoundError } from "@/lib/errors";
import type { CurrentUser } from "@/lib/auth/current-user";

export interface SubfolderView {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isSystem: boolean;
  childCount: number;
  documentCount: number;
  updatedAt: Date;
  canManage: boolean;
}

export interface DocumentView {
  id: string;
  name: string;
  extension: string | null;
  mimeType: string;
  size: number;
  currentVersion: number;
  updatedAt: Date;
  uploadedByName: string;
}

export interface FolderView {
  folder: {
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
  } | null; // null → root
  breadcrumbs: { id: string; name: string }[];
  subfolders: SubfolderView[];
  documents: DocumentView[];
  capabilities: FolderCapabilities;
}

/** Aggregate child-folder and document counts for a set of parent folders. */
async function countChildren(
  parentIds: string[],
): Promise<{ children: Map<string, number>; documents: Map<string, number> }> {
  const children = new Map<string, number>();
  const documents = new Map<string, number>();
  if (parentIds.length === 0) return { children, documents };

  const [childGroups, docGroups] = await Promise.all([
    prisma.folder.groupBy({
      by: ["parentId"],
      where: { parentId: { in: parentIds }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.document.groupBy({
      by: ["folderId"],
      where: { folderId: { in: parentIds }, deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  for (const g of childGroups) {
    if (g.parentId) children.set(g.parentId, g._count._all);
  }
  for (const g of docGroups) {
    documents.set(g.folderId, g._count._all);
  }
  return { children, documents };
}

/**
 * Build the complete view for a folder (or the root when `folderId` is null):
 * breadcrumbs, immediate subfolders with counts, contained documents, and the
 * current user's capabilities in this location.
 */
export async function getFolderView(
  folderId: string | null,
  user: CurrentUser,
): Promise<FolderView> {
  // --- Resolve current folder + capabilities ------------------------------
  let current: FolderView["folder"] = null;
  let capabilities: FolderCapabilities;

  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        path: true,
      },
    });
    if (!folder) throw new NotFoundError("المجلد غير موجود");
    current = {
      id: folder.id,
      name: folder.name,
      description: folder.description,
      isSystem: folder.isSystem,
    };
    capabilities = await getFolderCapabilities(user, {
      id: folder.id,
      path: folder.path,
    });
  } else {
    // Root: capabilities derive purely from the role baseline. Creating
    // top-level business folders is reserved for managers/admins (MANAGE).
    const level = roleBaselineLevel(user.role);
    const rank = { VIEW: 0, EDIT: 1, MANAGE: 2 } as const;
    capabilities = {
      level,
      canView: true,
      canEdit: rank[level] >= rank[PERMISSION_LEVELS.EDIT],
      canManage: rank[level] >= rank[PERMISSION_LEVELS.MANAGE],
    };
  }

  const breadcrumbs = current
    ? await getBreadcrumbs({
        id: current.id,
        name: current.name,
        path: (
          await prisma.folder.findUniqueOrThrow({
            where: { id: current.id },
            select: { path: true },
          })
        ).path,
      })
    : [];

  // --- Subfolders + documents ---------------------------------------------
  const [rawSubfolders, rawDocuments] = await Promise.all([
    prisma.folder.findMany({
      where: { parentId: folderId, deletedAt: null },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        isSystem: true,
        updatedAt: true,
        path: true,
      },
    }),
    // Documents always live inside a folder; the root itself holds none.
    folderId
      ? prisma.document.findMany({
          where: { folderId, deletedAt: null },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            name: true,
            extension: true,
            mimeType: true,
            size: true,
            currentVersion: true,
            updatedAt: true,
            uploadedBy: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const { children, documents } = await countChildren(
    rawSubfolders.map((f) => f.id),
  );

  const subfolders = await Promise.all(
    rawSubfolders.map(async (f) => {
      const caps = await getFolderCapabilities(user, { id: f.id, path: f.path });
      return {
        id: f.id,
        name: f.name,
        description: f.description,
        color: f.color,
        isSystem: f.isSystem,
        childCount: children.get(f.id) ?? 0,
        documentCount: documents.get(f.id) ?? 0,
        updatedAt: f.updatedAt,
        canManage: caps.canManage,
      };
    }),
  );

  return {
    folder: current,
    breadcrumbs,
    subfolders,
    documents: rawDocuments.map((d) => ({
      id: d.id,
      name: d.name,
      extension: d.extension,
      mimeType: d.mimeType,
      size: d.size,
      currentVersion: d.currentVersion,
      updatedAt: d.updatedAt,
      uploadedByName: d.uploadedBy.name,
    })),
    capabilities,
  };
}
