import "server-only";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import {
  createNotifications,
  recipientsWithRoleAtLeast,
} from "@/lib/notifications/service";
import { subjectMeta } from "@/lib/approvals/subjects";
import { EVENT_NAMES } from "../catalog";
import type { EventBus } from "../bus";
import type { DomainEvent } from "../types";

/**
 * Notification subscriber — turns approval AND task domain events into in-app
 * notifications. Independent of the audit subscriber: both react to the same
 * emit without knowing about each other.
 *
 * Approval routing (role-routed):
 *   • submitted           → all reviewers (MANAGER+)
 *   • review_started      → the requester
 *   • approved / rejected / returned → the requester
 *   • cancelled / archived → nobody
 *
 * Task routing (owner-routed, ids carried in the event metadata):
 *   • created / assigned / updated / cancelled → the assignee
 *   • completed → the assigner (the manager who created it)
 *
 * The acting user is never notified about their own action.
 */

function metaString(meta: Record<string, unknown> | undefined, key: string): string {
  const value = meta?.[key];
  return typeof value === "string" ? value : "";
}

/** In-app link to the subject's detail page (where the panels live). */
function linkFor(event: DomainEvent): string | null {
  const subjectType = metaString(event.metadata, "subjectType");
  const subjectId = metaString(event.metadata, "subjectId");
  if (!subjectType || !subjectId) return null;
  return subjectMeta(subjectType)?.href(subjectId) ?? null;
}

/** Drop the actor from a recipient list — nobody is notified of their own act. */
function excludeActor(ids: string[], actorId: string | null): string[] {
  return ids.filter((id) => id && id !== actorId);
}

// --- Approvals -------------------------------------------------------------

/** Arabic headline per approval event, built from the subject title. */
function approvalTitle(event: DomainEvent): string {
  const name = metaString(event.metadata, "name") || "عنصر";
  switch (event.eventName) {
    case EVENT_NAMES.ApprovalSubmitted:
      return `طلب اعتماد جديد: «${name}»`;
    case EVENT_NAMES.ApprovalReviewStarted:
      return `بدأت مراجعة «${name}»`;
    case EVENT_NAMES.ApprovalApproved:
      return `تم اعتماد «${name}»`;
    case EVENT_NAMES.ApprovalRejected:
      return `تم رفض «${name}»`;
    case EVENT_NAMES.ApprovalReturned:
      return `أُعيد «${name}» للتعديل`;
    default:
      return name;
  }
}

async function approvalRecipients(event: DomainEvent): Promise<string[]> {
  switch (event.eventName) {
    case EVENT_NAMES.ApprovalSubmitted: {
      const reviewers = await recipientsWithRoleAtLeast(ROLES.MANAGER);
      return excludeActor(reviewers, event.actorId);
    }
    case EVENT_NAMES.ApprovalReviewStarted:
    case EVENT_NAMES.ApprovalApproved:
    case EVENT_NAMES.ApprovalRejected:
    case EVENT_NAMES.ApprovalReturned: {
      const approval = await prisma.approval.findUnique({
        where: { id: event.entityId },
        select: { requestedById: true },
      });
      return approval ? excludeActor([approval.requestedById], event.actorId) : [];
    }
    default:
      return [];
  }
}

async function onApprovalEvent(event: DomainEvent): Promise<void> {
  const recipients = await approvalRecipients(event);
  if (recipients.length === 0) return;

  const comment = metaString(event.metadata, "comment");
  await createNotifications(recipients, {
    type: event.eventName,
    title: approvalTitle(event),
    body: comment || null,
    link: linkFor(event),
    actorId: event.actorId,
    entityType: event.entityType,
    entityId: event.entityId,
  });
}

const APPROVAL_EVENTS = [
  EVENT_NAMES.ApprovalSubmitted,
  EVENT_NAMES.ApprovalReviewStarted,
  EVENT_NAMES.ApprovalApproved,
  EVENT_NAMES.ApprovalRejected,
  EVENT_NAMES.ApprovalReturned,
] as const;

// --- Tasks -----------------------------------------------------------------

/** Arabic headline per task event, built from the task title. */
function taskTitle(event: DomainEvent): string {
  const name = metaString(event.metadata, "name") || "مهمة";
  switch (event.eventName) {
    case EVENT_NAMES.TaskCreated:
      return `مهمة جديدة مُسنَدة إليك: «${name}»`;
    case EVENT_NAMES.TaskAssigned:
      return `تم إسناد مهمة إليك: «${name}»`;
    case EVENT_NAMES.TaskUpdated:
      return `تم تحديث مهمة مُسنَدة إليك: «${name}»`;
    case EVENT_NAMES.TaskCompleted:
      return `اكتملت مهمة: «${name}»`;
    case EVENT_NAMES.TaskCancelled:
      return `تم إلغاء مهمة مُسنَدة إليك: «${name}»`;
    default:
      return name;
  }
}

function taskRecipients(event: DomainEvent): string[] {
  // Completion notifies the assigner; every other task event notifies the
  // assignee. Both ids travel in the event metadata (no extra query needed).
  const target =
    event.eventName === EVENT_NAMES.TaskCompleted
      ? metaString(event.metadata, "assignedById")
      : metaString(event.metadata, "assigneeId");
  return target ? excludeActor([target], event.actorId) : [];
}

async function onTaskEvent(event: DomainEvent): Promise<void> {
  const recipients = taskRecipients(event);
  if (recipients.length === 0) return;

  await createNotifications(recipients, {
    type: event.eventName,
    title: taskTitle(event),
    body: metaString(event.metadata, "entityTitle") || null,
    link: linkFor(event),
    actorId: event.actorId,
    entityType: event.entityType,
    entityId: event.entityId,
  });
}

const TASK_EVENTS = [
  EVENT_NAMES.TaskCreated,
  EVENT_NAMES.TaskAssigned,
  EVENT_NAMES.TaskUpdated,
  EVENT_NAMES.TaskCompleted,
  EVENT_NAMES.TaskCancelled,
] as const;

export function registerNotificationSubscriber(bus: EventBus): void {
  for (const eventName of APPROVAL_EVENTS) bus.on(eventName, onApprovalEvent);
  for (const eventName of TASK_EVENTS) bus.on(eventName, onTaskEvent);
}
