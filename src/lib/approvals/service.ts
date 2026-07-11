import "server-only";
import { prisma } from "@/lib/prisma";
import { emitEvent, EVENT_NAMES, type EventName } from "@/lib/events";
import { ENTITY_TYPES, hasRoleAtLeast, type Role } from "@/lib/constants";
import {
  ConflictError,
  ForbiddenError,
  ValidationError,
} from "@/lib/errors";
import {
  APPROVAL_STATUS,
  APPROVAL_ACTION,
  getTransition,
  PENDING_STATUSES,
  type ApprovalAction,
  type ApprovalStatus,
} from "./constants";
import { subjectMeta } from "./subjects";

/** Maps a workflow action to the domain event emitted after it commits. */
const ACTION_EVENT: Record<ApprovalAction, EventName> = {
  [APPROVAL_ACTION.SUBMIT]: EVENT_NAMES.ApprovalSubmitted,
  [APPROVAL_ACTION.START_REVIEW]: EVENT_NAMES.ApprovalReviewStarted,
  [APPROVAL_ACTION.APPROVE]: EVENT_NAMES.ApprovalApproved,
  [APPROVAL_ACTION.REJECT]: EVENT_NAMES.ApprovalRejected,
  [APPROVAL_ACTION.RETURN]: EVENT_NAMES.ApprovalReturned,
  [APPROVAL_ACTION.CANCEL]: EVENT_NAMES.ApprovalCancelled,
  [APPROVAL_ACTION.ARCHIVE]: EVENT_NAMES.ApprovalArchived,
};

interface Actor {
  id: string;
  role: Role;
}

/** Ensure an Approval exists for a subject; create it in DRAFT if missing. */
export async function getOrCreateApproval(
  subjectType: string,
  subjectId: string,
  actorId: string,
) {
  const meta = subjectMeta(subjectType);
  if (!meta) throw new ValidationError("نوع العنصر غير مدعوم لسير الاعتماد");

  const existing = await prisma.approval.findUnique({
    where: { subjectType_subjectId: { subjectType, subjectId } },
  });
  if (existing) return existing;

  const title = await meta.fetchTitle(subjectId);
  return prisma.approval.create({
    data: {
      subjectType,
      subjectId,
      title,
      status: APPROVAL_STATUS.DRAFT,
      requestedById: actorId,
      transitions: {
        create: {
          action: "CREATE",
          fromStatus: "",
          toStatus: APPROVAL_STATUS.DRAFT,
          actorId,
        },
      },
    },
  });
}

/** Approval + full transition history (timeline) for a subject, or null. */
export async function getApprovalForSubject(
  subjectType: string,
  subjectId: string,
) {
  return prisma.approval.findUnique({
    where: { subjectType_subjectId: { subjectType, subjectId } },
    include: {
      requestedBy: { select: { name: true } },
      transitions: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true } } },
      },
    },
  });
}

/**
 * The single approval transition — the ONLY place a state change happens.
 *
 * Validates the transition against the state machine and RBAC, writes the new
 * status + an immutable history row atomically, then (after commit) emits the
 * domain event. The audit entry is written by the audit subscriber; the
 * history row is the timeline. No business logic is duplicated elsewhere.
 */
export async function performTransition(input: {
  subjectType: string;
  subjectId: string;
  action: ApprovalAction;
  comment?: string;
  actor: Actor;
}): Promise<{ id: string; from: ApprovalStatus; to: ApprovalStatus }> {
  const rule = getTransition(input.action);
  if (!rule) throw new ValidationError("إجراء غير معروف");

  // First submit auto-creates the DRAFT approval so no separate step is needed.
  const approval = await getOrCreateApproval(
    input.subjectType,
    input.subjectId,
    input.actor.id,
  );
  const from = approval.status as ApprovalStatus;

  if (!rule.from.includes(from)) {
    throw new ConflictError("لا يمكن تنفيذ هذا الإجراء في الحالة الحالية");
  }
  if (!hasRoleAtLeast(input.actor.role, rule.minRole)) {
    throw new ForbiddenError("لا تملك صلاحية تنفيذ هذا الإجراء");
  }

  const comment = input.comment?.trim() || null;
  if (rule.requiresComment && !comment) {
    throw new ValidationError("يجب إدخال سبب أو ملاحظة لهذا الإجراء");
  }

  await prisma.$transaction([
    prisma.approval.update({
      where: { id: approval.id },
      data: { status: rule.to },
    }),
    prisma.approvalTransition.create({
      data: {
        approvalId: approval.id,
        action: input.action,
        fromStatus: from,
        toStatus: rule.to,
        comment,
        actorId: input.actor.id,
      },
    }),
  ]);

  // Emit AFTER the transaction commits (fact = it already happened).
  await emitEvent({
    eventName: ACTION_EVENT[input.action],
    actorId: input.actor.id,
    entityType: ENTITY_TYPES.APPROVAL,
    entityId: approval.id,
    metadata: {
      name: approval.title ?? "",
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      fromStatus: from,
      toStatus: rule.to,
      comment: comment ?? undefined,
    },
  });

  return { id: approval.id, from, to: rule.to };
}

export interface ApprovalListItem {
  id: string;
  subjectType: string;
  subjectId: string;
  subjectLabel: string;
  title: string;
  href: string;
  status: string;
  requestedBy: string;
  updatedAt: Date;
}

function toListItem(row: {
  id: string;
  subjectType: string;
  subjectId: string;
  title: string | null;
  status: string;
  updatedAt: Date;
  requestedBy: { name: string };
}): ApprovalListItem {
  const meta = subjectMeta(row.subjectType);
  return {
    id: row.id,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    subjectLabel: meta?.label ?? row.subjectType,
    title: row.title ?? "—",
    href: meta ? meta.href(row.subjectId) : "#",
    status: row.status,
    requestedBy: row.requestedBy.name,
    updatedAt: row.updatedAt,
  };
}

/** List approvals in the given statuses (most-recently-updated first). */
export async function listApprovalsByStatus(
  statuses: string[],
  take = 10,
): Promise<ApprovalListItem[]> {
  const rows = await prisma.approval.findMany({
    where: { status: { in: statuses } },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      subjectType: true,
      subjectId: true,
      title: true,
      status: true,
      updatedAt: true,
      requestedBy: { select: { name: true } },
    },
  });
  return rows.map(toListItem);
}

/** Dashboard counts: pending / approved / rejected. */
export async function approvalCounts(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
}> {
  const [pending, approved, rejected] = await Promise.all([
    prisma.approval.count({ where: { status: { in: PENDING_STATUSES } } }),
    prisma.approval.count({ where: { status: APPROVAL_STATUS.APPROVED } }),
    prisma.approval.count({ where: { status: APPROVAL_STATUS.REJECTED } }),
  ]);
  return { pending, approved, rejected };
}
