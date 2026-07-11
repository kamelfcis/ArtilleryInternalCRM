import "server-only";
import { prisma } from "@/lib/prisma";
import {
  PERMISSION_LEVELS,
  PERMISSION_LEVEL_ORDER,
  ROLES,
  type PermissionLevel,
  type Role,
} from "@/lib/constants";
import type { CurrentUser } from "@/lib/auth/current-user";

/**
 * Folder-level authorization.
 *
 * Effective access = the higher of:
 *   (1) the baseline granted by the user's global role, and
 *   (2) any explicit FolderPermission on the folder or one of its ancestors
 *       (permissions are inherited down the tree, mirroring shared-drive
 *       semantics that employees already understand).
 *
 * This models the department's real workflow: everyone can see the shared
 * business folders by default, while specific users can be elevated on
 * specific subtrees.
 */

const LEVEL_RANK: Record<PermissionLevel, number> = {
  [PERMISSION_LEVELS.VIEW]: 0,
  [PERMISSION_LEVELS.EDIT]: 1,
  [PERMISSION_LEVELS.MANAGE]: 2,
};

/** Baseline folder access implied by a user's global role. */
export function roleBaselineLevel(role: Role): PermissionLevel {
  switch (role) {
    case ROLES.ADMIN:
    case ROLES.MANAGER:
      return PERMISSION_LEVELS.MANAGE;
    case ROLES.EDITOR:
      return PERMISSION_LEVELS.EDIT;
    default:
      return PERMISSION_LEVELS.VIEW;
  }
}

function higher(a: PermissionLevel, b: PermissionLevel): PermissionLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

function meets(level: PermissionLevel, required: PermissionLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[required];
}

/**
 * Compute a user's effective permission level on a specific folder,
 * accounting for role baseline and inherited explicit grants.
 */
export async function getEffectiveLevel(
  user: Pick<CurrentUser, "id" | "role">,
  folder: { id: string; path: string },
): Promise<PermissionLevel> {
  let level = roleBaselineLevel(user.role);
  // Admin/Manager already have the maximum; skip the query.
  if (level === PERMISSION_LEVELS.MANAGE) return level;

  // Ancestor folder ids are encoded in the materialized path "/a/b/c/".
  const ancestorIds = folder.path.split("/").filter(Boolean);
  const scopeIds = Array.from(new Set([...ancestorIds, folder.id]));

  const grants = await prisma.folderPermission.findMany({
    where: { userId: user.id, folderId: { in: scopeIds } },
    select: { level: true },
  });

  for (const grant of grants) {
    if (isPermissionLevel(grant.level)) {
      level = higher(level, grant.level);
    }
  }
  return level;
}

export async function canView(
  user: Pick<CurrentUser, "id" | "role">,
  folder: { id: string; path: string },
): Promise<boolean> {
  const level = await getEffectiveLevel(user, folder);
  return meets(level, PERMISSION_LEVELS.VIEW);
}

export async function canEdit(
  user: Pick<CurrentUser, "id" | "role">,
  folder: { id: string; path: string },
): Promise<boolean> {
  const level = await getEffectiveLevel(user, folder);
  return meets(level, PERMISSION_LEVELS.EDIT);
}

export async function canManage(
  user: Pick<CurrentUser, "id" | "role">,
  folder: { id: string; path: string },
): Promise<boolean> {
  const level = await getEffectiveLevel(user, folder);
  return meets(level, PERMISSION_LEVELS.MANAGE);
}

/** Capabilities bundle for convenient use in UI/server logic. */
export interface FolderCapabilities {
  level: PermissionLevel;
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
}

export async function getFolderCapabilities(
  user: Pick<CurrentUser, "id" | "role">,
  folder: { id: string; path: string },
): Promise<FolderCapabilities> {
  const level = await getEffectiveLevel(user, folder);
  return {
    level,
    canView: meets(level, PERMISSION_LEVELS.VIEW),
    canEdit: meets(level, PERMISSION_LEVELS.EDIT),
    canManage: meets(level, PERMISSION_LEVELS.MANAGE),
  };
}

function isPermissionLevel(value: string): value is PermissionLevel {
  return (PERMISSION_LEVEL_ORDER as string[]).includes(value);
}
