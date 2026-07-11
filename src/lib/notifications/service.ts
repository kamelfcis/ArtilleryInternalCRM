import "server-only";
import { prisma } from "@/lib/prisma";
import { ROLES, type Role } from "@/lib/constants";

/**
 * Notification service — the single place notifications are written and read.
 *
 * Notifications are produced by the notification subscriber (a reaction to
 * domain events, mirroring the audit subscriber) and consumed by the top-bar
 * bell + the /notifications page. Delivery is in-app only.
 */

export interface NewNotification {
  recipientId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

/**
 * Create notifications for many recipients at once. De-duplicates recipient ids
 * and skips an empty batch. Best-effort: notification failures must never break
 * the primary operation (the caller is an error-isolated event subscriber).
 */
export async function createNotifications(
  recipientIds: string[],
  payload: Omit<NewNotification, "recipientId">,
): Promise<void> {
  const unique = [...new Set(recipientIds.filter(Boolean))];
  if (unique.length === 0) return;

  await prisma.notification.createMany({
    data: unique.map((recipientId) => ({
      recipientId,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      link: payload.link ?? null,
      actorId: payload.actorId ?? null,
      entityType: payload.entityType ?? null,
      entityId: payload.entityId ?? null,
    })),
  });
}

/** Ids of all active users whose role is at least `minRole`. */
export async function recipientsWithRoleAtLeast(minRole: Role): Promise<string[]> {
  // Role set is expanded at the app layer since the DB stores roles as strings.
  const roles: Role[] =
    minRole === ROLES.MANAGER
      ? [ROLES.MANAGER, ROLES.ADMIN]
      : minRole === ROLES.ADMIN
        ? [ROLES.ADMIN]
        : minRole === ROLES.EDITOR
          ? [ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN]
          : [ROLES.VIEWER, ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN];

  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: roles } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  actorName: string | null;
  read: boolean;
  createdAt: Date;
}

function toItem(row: {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
  actor: { name: string } | null;
}): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    actorName: row.actor?.name ?? null,
    read: row.readAt !== null,
    createdAt: row.createdAt,
  };
}

/** Most-recent notifications for a recipient. */
export async function listNotifications(
  recipientId: string,
  take = 20,
): Promise<NotificationItem[]> {
  const rows = await prisma.notification.findMany({
    where: { recipientId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      link: true,
      readAt: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });
  return rows.map(toItem);
}

/** Count of unread notifications for a recipient. */
export function unreadCount(recipientId: string): Promise<number> {
  return prisma.notification.count({
    where: { recipientId, readAt: null },
  });
}

/** Mark one notification read (scoped to its recipient). Returns true if changed. */
export async function markRead(
  recipientId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id, recipientId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count > 0;
}

/** Mark every unread notification of a recipient read. Returns how many changed. */
export async function markAllRead(recipientId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { recipientId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
