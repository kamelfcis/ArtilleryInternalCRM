import { ROLES, hasRoleAtLeast, type Role } from "@/lib/constants";
import type { StatusTone } from "@/lib/crm/constants";

/**
 * Approval workflow domain metadata — the state machine.
 *
 * Client-safe (no server-only imports) so both the reusable UI panel and the
 * server service share exactly one definition of statuses, actions and legal
 * transitions. There is no duplicated business logic: the service validates
 * against `TRANSITIONS`, and the UI renders buttons from `availableActions`.
 */

export const APPROVAL_STATUS = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  ARCHIVED: "ARCHIVED",
} as const;

export type ApprovalStatus =
  (typeof APPROVAL_STATUS)[keyof typeof APPROVAL_STATUS];

export const APPROVAL_STATUS_META: Record<
  ApprovalStatus,
  { label: string; tone: StatusTone }
> = {
  DRAFT: { label: "مسودة", tone: "neutral" },
  SUBMITTED: { label: "مُقدَّم", tone: "info" },
  UNDER_REVIEW: { label: "قيد المراجعة", tone: "warning" },
  APPROVED: { label: "معتمد", tone: "success" },
  REJECTED: { label: "مرفوض", tone: "danger" },
  ARCHIVED: { label: "مؤرشف", tone: "neutral" },
};

export const APPROVAL_ACTION = {
  SUBMIT: "SUBMIT",
  START_REVIEW: "START_REVIEW",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  RETURN: "RETURN",
  CANCEL: "CANCEL",
  ARCHIVE: "ARCHIVE",
} as const;

export type ApprovalAction =
  (typeof APPROVAL_ACTION)[keyof typeof APPROVAL_ACTION];

export interface TransitionRule {
  action: ApprovalAction;
  /** Statuses from which this action is legal. */
  from: ApprovalStatus[];
  /** Resulting status. */
  to: ApprovalStatus;
  /** Minimum role allowed to perform the action. */
  minRole: Role;
  /** Button label (Arabic). */
  label: string;
  /** Button style hint for the UI. */
  style: "primary" | "secondary" | "danger";
  /** Reject / return require a reason. */
  requiresComment?: boolean;
}

/** The complete, ordered transition table — the single source of truth. */
export const TRANSITIONS: TransitionRule[] = [
  {
    action: APPROVAL_ACTION.SUBMIT,
    from: [APPROVAL_STATUS.DRAFT],
    to: APPROVAL_STATUS.SUBMITTED,
    minRole: ROLES.EDITOR,
    label: "تقديم للاعتماد",
    style: "primary",
  },
  {
    action: APPROVAL_ACTION.START_REVIEW,
    from: [APPROVAL_STATUS.SUBMITTED],
    to: APPROVAL_STATUS.UNDER_REVIEW,
    minRole: ROLES.MANAGER,
    label: "بدء المراجعة",
    style: "secondary",
  },
  {
    action: APPROVAL_ACTION.APPROVE,
    from: [APPROVAL_STATUS.SUBMITTED, APPROVAL_STATUS.UNDER_REVIEW],
    to: APPROVAL_STATUS.APPROVED,
    minRole: ROLES.MANAGER,
    label: "اعتماد",
    style: "primary",
  },
  {
    action: APPROVAL_ACTION.REJECT,
    from: [APPROVAL_STATUS.SUBMITTED, APPROVAL_STATUS.UNDER_REVIEW],
    to: APPROVAL_STATUS.REJECTED,
    minRole: ROLES.MANAGER,
    label: "رفض",
    style: "danger",
    requiresComment: true,
  },
  {
    action: APPROVAL_ACTION.RETURN,
    from: [APPROVAL_STATUS.SUBMITTED, APPROVAL_STATUS.UNDER_REVIEW],
    to: APPROVAL_STATUS.DRAFT,
    minRole: ROLES.MANAGER,
    label: "إعادة للتعديل",
    style: "secondary",
    requiresComment: true,
  },
  {
    action: APPROVAL_ACTION.CANCEL,
    from: [APPROVAL_STATUS.SUBMITTED, APPROVAL_STATUS.UNDER_REVIEW],
    to: APPROVAL_STATUS.DRAFT,
    minRole: ROLES.EDITOR,
    label: "إلغاء التقديم",
    style: "secondary",
  },
  {
    action: APPROVAL_ACTION.ARCHIVE,
    from: [APPROVAL_STATUS.APPROVED, APPROVAL_STATUS.REJECTED],
    to: APPROVAL_STATUS.ARCHIVED,
    minRole: ROLES.MANAGER,
    label: "أرشفة",
    style: "secondary",
  },
];

export function getTransition(action: string): TransitionRule | undefined {
  return TRANSITIONS.find((t) => t.action === action);
}

/** Transitions legal from `status` and permitted for `role`. */
export function availableActions(
  status: ApprovalStatus,
  role: Role,
): TransitionRule[] {
  return TRANSITIONS.filter(
    (t) => t.from.includes(status) && hasRoleAtLeast(role, t.minRole),
  );
}

export function isApprovalStatus(value: string): value is ApprovalStatus {
  return value in APPROVAL_STATUS_META;
}

/** Statuses that count as "pending" reviewer action. */
export const PENDING_STATUSES: ApprovalStatus[] = [
  APPROVAL_STATUS.SUBMITTED,
  APPROVAL_STATUS.UNDER_REVIEW,
];
