import type { StatusTone } from "@/lib/crm/constants";

/**
 * Task/assignment domain metadata — priorities and lifecycle statuses with
 * their Arabic labels and badge tones. Client-safe (no server-only imports) so
 * the forms, badges and list filters share one source of truth with the
 * service. Values are validated at the application layer (schema stays enum-free
 * for portability), exactly like the CRM status catalogues.
 */

// --- Priority --------------------------------------------------------------

export const TASK_PRIORITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type TaskPriority = (typeof TASK_PRIORITY)[keyof typeof TASK_PRIORITY];

export const TASK_PRIORITY_META: Record<
  string,
  { label: string; tone: StatusTone }
> = {
  LOW: { label: "منخفضة", tone: "neutral" },
  MEDIUM: { label: "متوسطة", tone: "info" },
  HIGH: { label: "عالية", tone: "warning" },
  CRITICAL: { label: "حرجة", tone: "danger" },
};

export const TASK_PRIORITY_ORDER: TaskPriority[] = [
  TASK_PRIORITY.LOW,
  TASK_PRIORITY.MEDIUM,
  TASK_PRIORITY.HIGH,
  TASK_PRIORITY.CRITICAL,
];

/** Priority rank for sorting (higher = more urgent). */
export const TASK_PRIORITY_RANK: Record<string, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

// --- Status ----------------------------------------------------------------

export const TASK_STATUS = {
  NEW: "NEW",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING: "WAITING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export const TASK_STATUS_META: Record<
  string,
  { label: string; tone: StatusTone }
> = {
  NEW: { label: "جديدة", tone: "neutral" },
  IN_PROGRESS: { label: "قيد التنفيذ", tone: "info" },
  WAITING: { label: "معلّقة", tone: "warning" },
  COMPLETED: { label: "مكتملة", tone: "success" },
  CANCELLED: { label: "ملغاة", tone: "danger" },
};

export const TASK_STATUS_ORDER: TaskStatus[] = [
  TASK_STATUS.NEW,
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.WAITING,
  TASK_STATUS.COMPLETED,
  TASK_STATUS.CANCELLED,
];

/** Statuses that still require the assignee's action (the "open" queue). */
export const OPEN_TASK_STATUSES: TaskStatus[] = [
  TASK_STATUS.NEW,
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.WAITING,
];

/** Terminal statuses — no further transitions once here. */
export const TERMINAL_TASK_STATUSES: TaskStatus[] = [
  TASK_STATUS.COMPLETED,
  TASK_STATUS.CANCELLED,
];

/**
 * Statuses an assignee may set on their OWN task (self-service progress). They
 * cannot cancel or reopen — only a manager can (via the management screen).
 */
export const ASSIGNEE_SETTABLE_STATUSES: TaskStatus[] = [
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.WAITING,
  TASK_STATUS.COMPLETED,
];

// --- Select option helpers (label/value) -----------------------------------

export const TASK_PRIORITY_OPTIONS = TASK_PRIORITY_ORDER.map((value) => ({
  value,
  label: TASK_PRIORITY_META[value]?.label ?? value,
}));

export const TASK_STATUS_OPTIONS = TASK_STATUS_ORDER.map((value) => ({
  value,
  label: TASK_STATUS_META[value]?.label ?? value,
}));

export function isTaskStatus(value: string): value is TaskStatus {
  return value in TASK_STATUS_META;
}

export function isTaskPriority(value: string): value is TaskPriority {
  return value in TASK_PRIORITY_META;
}
