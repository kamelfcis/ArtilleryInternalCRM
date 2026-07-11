import "server-only";
import type { Task } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emitEvent, EVENT_NAMES, type EventName } from "@/lib/events";
import {
  ENTITY_TYPES,
  hasRoleAtLeast,
  ROLES,
  type Role,
} from "@/lib/constants";
import { ENTITY_KINDS, type EntityKind } from "@/lib/crm/constants";
import { subjectMeta } from "@/lib/approvals/subjects";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import {
  ASSIGNEE_SETTABLE_STATUSES,
  OPEN_TASK_STATUSES,
  TASK_STATUS,
  TERMINAL_TASK_STATUSES,
  isTaskPriority,
  isTaskStatus,
  type TaskStatus,
} from "./constants";

/** The CRM entity kinds a task may be attached to (Document is not a task subject). */
const TASK_ENTITY_KINDS = Object.values(ENTITY_KINDS) as EntityKind[];

interface Actor {
  id: string;
  role: Role;
}

function requireManager(actor: Actor): void {
  if (!hasRoleAtLeast(actor.role, ROLES.MANAGER)) {
    throw new ForbiddenError("لا تملك صلاحية إدارة المهام");
  }
}

function assertTaskEntityKind(entityType: string): void {
  if (!TASK_ENTITY_KINDS.includes(entityType as EntityKind)) {
    throw new ValidationError("نوع العنصر غير مدعوم للمهام");
  }
}

/**
 * Emit a task domain event AFTER its write has committed. The envelope carries
 * the task id; the subject (CRM entity) and routing hints live in metadata so
 * the audit + notification subscribers stay producer-agnostic (mirrors the
 * approval service).
 */
async function emitTaskEvent(
  eventName: EventName,
  task: Task,
  actorId: string,
): Promise<void> {
  await emitEvent({
    eventName,
    actorId,
    entityType: ENTITY_TYPES.TASK,
    entityId: task.id,
    metadata: {
      name: task.title,
      entityTitle: task.entityTitle ?? undefined,
      subjectType: task.entityType,
      subjectId: task.entityId,
      assigneeId: task.assigneeId,
      assignedById: task.assignedById,
      priority: task.priority,
      status: task.status,
    },
  });
}

// --- Options for the management forms --------------------------------------

export interface AssignableUser {
  id: string;
  name: string;
  role: Role;
  jobTitle: string | null;
}

/** Active users who can receive a task (any role can be an assignee). */
export async function listAssignableUsers(): Promise<AssignableUser[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true, jobTitle: true },
  });
  return users.map((u) => ({ ...u, role: u.role as Role }));
}

export interface SubjectOption {
  id: string;
  label: string;
}

/**
 * All selectable CRM entities grouped by kind, for the "new task" entity
 * picker. Only non-deleted records are offered. One compact query per kind.
 */
export async function listSubjectsByKind(): Promise<
  Record<EntityKind, SubjectOption[]>
> {
  const [companies, projects, sites, practices, contracts, purchases] =
    await Promise.all([
      prisma.company.findMany({
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.project.findMany({
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.site.findMany({
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.practice.findMany({
        where: { deletedAt: null },
        orderBy: { title: "asc" },
        select: { id: true, title: true },
      }),
      prisma.contract.findMany({
        where: { deletedAt: null },
        orderBy: { title: "asc" },
        select: { id: true, title: true },
      }),
      prisma.purchase.findMany({
        where: { deletedAt: null },
        orderBy: { title: "asc" },
        select: { id: true, title: true },
      }),
    ]);

  return {
    COMPANY: companies.map((c) => ({ id: c.id, label: c.name })),
    PROJECT: projects.map((p) => ({ id: p.id, label: p.name })),
    SITE: sites.map((s) => ({ id: s.id, label: s.name })),
    PRACTICE: practices.map((p) => ({ id: p.id, label: p.title })),
    CONTRACT: contracts.map((c) => ({ id: c.id, label: c.title })),
    PURCHASE: purchases.map((p) => ({ id: p.id, label: p.title })),
  };
}

// --- Commands (write paths) ------------------------------------------------

export interface CreateTaskInput {
  entityType: string;
  entityId: string;
  title: string;
  notes?: string | null;
  priority: string;
  dueDate?: Date | null;
  assigneeId: string;
}

/**
 * Create and assign a task. Manager-only. Validates the subject exists (caching
 * its title), the assignee is active, and the priority is known. Emits
 * task.created (which notifies the assignee via the notification subscriber).
 */
export async function createTask(
  input: CreateTaskInput,
  actor: Actor,
): Promise<Task> {
  requireManager(actor);
  assertTaskEntityKind(input.entityType);

  const title = input.title.trim();
  if (!title) throw new ValidationError("يجب إدخال عنوان المهمة");

  const priority = input.priority;
  if (!isTaskPriority(priority)) throw new ValidationError("أولوية غير صالحة");

  const meta = subjectMeta(input.entityType);
  const entityTitle = meta ? await meta.fetchTitle(input.entityId) : null;
  if (!entityTitle) throw new NotFoundError("العنصر المرتبط غير موجود");

  const assignee = await prisma.user.findUnique({
    where: { id: input.assigneeId },
    select: { id: true, isActive: true },
  });
  if (!assignee || !assignee.isActive) {
    throw new ValidationError("المستخدم المسنَد إليه غير متاح");
  }

  const task = await prisma.task.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      entityTitle,
      title,
      notes: input.notes?.trim() || null,
      priority,
      status: TASK_STATUS.NEW,
      dueDate: input.dueDate ?? null,
      assigneeId: input.assigneeId,
      assignedById: actor.id,
    },
  });

  await emitTaskEvent(EVENT_NAMES.TaskCreated, task, actor.id);
  return task;
}

export interface UpdateTaskInput {
  title?: string;
  notes?: string | null;
  priority?: string;
  dueDate?: Date | null;
  assigneeId?: string;
  status?: string;
}

/**
 * Full task edit (reassign, re-prioritise, reschedule, change status).
 * Manager-only. Emits exactly ONE domain event, chosen by precedence so the
 * most meaningful notification fires:
 *   status→COMPLETED → task.completed · status→CANCELLED → task.cancelled ·
 *   assignee changed → task.assigned · otherwise → task.updated.
 */
export async function updateTask(
  taskId: string,
  patch: UpdateTaskInput,
  actor: Actor,
): Promise<Task> {
  requireManager(actor);

  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new NotFoundError("المهمة غير موجودة");

  const data: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw new ValidationError("يجب إدخال عنوان المهمة");
    data.title = title;
  }
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;
  if (patch.priority !== undefined) {
    if (!isTaskPriority(patch.priority)) {
      throw new ValidationError("أولوية غير صالحة");
    }
    data.priority = patch.priority;
  }
  if (patch.dueDate !== undefined) data.dueDate = patch.dueDate;

  let assigneeChanged = false;
  if (patch.assigneeId !== undefined && patch.assigneeId !== existing.assigneeId) {
    const assignee = await prisma.user.findUnique({
      where: { id: patch.assigneeId },
      select: { id: true, isActive: true },
    });
    if (!assignee || !assignee.isActive) {
      throw new ValidationError("المستخدم المسنَد إليه غير متاح");
    }
    data.assigneeId = patch.assigneeId;
    assigneeChanged = true;
  }

  let statusChangedTo: TaskStatus | null = null;
  if (patch.status !== undefined && patch.status !== existing.status) {
    if (!isTaskStatus(patch.status)) throw new ValidationError("حالة غير صالحة");
    data.status = patch.status;
    statusChangedTo = patch.status;
    data.completedAt =
      patch.status === TASK_STATUS.COMPLETED ? new Date() : null;
  }

  if (Object.keys(data).length === 0) return existing; // nothing changed

  const task = await prisma.task.update({ where: { id: taskId }, data });

  await emitTaskEvent(pickUpdateEvent(statusChangedTo, assigneeChanged), task, actor.id);
  return task;
}

function pickUpdateEvent(
  statusChangedTo: TaskStatus | null,
  assigneeChanged: boolean,
): EventName {
  if (statusChangedTo === TASK_STATUS.COMPLETED) return EVENT_NAMES.TaskCompleted;
  if (statusChangedTo === TASK_STATUS.CANCELLED) return EVENT_NAMES.TaskCancelled;
  if (assigneeChanged) return EVENT_NAMES.TaskAssigned;
  return EVENT_NAMES.TaskUpdated;
}

/**
 * Self-service status change by the task's own assignee (start / hold /
 * complete). Cannot reassign, cancel, or reopen a terminal task. Emits
 * task.completed on completion, otherwise task.updated.
 */
export async function changeMyTaskStatus(
  taskId: string,
  status: string,
  actor: Actor,
): Promise<Task> {
  if (!isTaskStatus(status) || !ASSIGNEE_SETTABLE_STATUSES.includes(status)) {
    throw new ValidationError("حالة غير صالحة");
  }

  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new NotFoundError("المهمة غير موجودة");
  if (existing.assigneeId !== actor.id) {
    throw new ForbiddenError("هذه المهمة ليست مسنَدة إليك");
  }
  if (TERMINAL_TASK_STATUSES.includes(existing.status as TaskStatus)) {
    throw new ConflictError("لا يمكن تعديل مهمة منتهية");
  }
  if (existing.status === status) return existing;

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      completedAt: status === TASK_STATUS.COMPLETED ? new Date() : null,
    },
  });

  const eventName =
    status === TASK_STATUS.COMPLETED
      ? EVENT_NAMES.TaskCompleted
      : EVENT_NAMES.TaskUpdated;
  await emitTaskEvent(eventName, task, actor.id);
  return task;
}

// --- Queries (read paths) --------------------------------------------------

export interface TaskListItem {
  id: string;
  title: string;
  notes: string | null;
  priority: string;
  status: string;
  dueDate: Date | null;
  overdue: boolean;
  entityType: string;
  entityId: string;
  entityLabel: string;
  entityTitle: string;
  entityHref: string | null;
  assigneeId: string;
  assigneeName: string;
  assignedByName: string;
  createdAt: Date;
  updatedAt: Date;
}

type TaskRow = Task & {
  assignee: { name: string };
  assignedBy: { name: string };
};

function toListItem(row: TaskRow): TaskListItem {
  const meta = subjectMeta(row.entityType);
  const isOpen = OPEN_TASK_STATUSES.includes(row.status as TaskStatus);
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    priority: row.priority,
    status: row.status,
    dueDate: row.dueDate,
    overdue: isOpen && row.dueDate != null && row.dueDate.getTime() < Date.now(),
    entityType: row.entityType,
    entityId: row.entityId,
    entityLabel: meta?.label ?? row.entityType,
    entityTitle: row.entityTitle ?? "—",
    entityHref: meta ? meta.href(row.entityId) : null,
    assigneeId: row.assigneeId,
    assigneeName: row.assignee.name,
    assignedByName: row.assignedBy.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const LIST_INCLUDE = {
  assignee: { select: { name: true } },
  assignedBy: { select: { name: true } },
} as const;

/** Open-first, then priority, then due date. Shared list ordering. */
const LIST_ORDER = [
  { status: "asc" as const },
  { dueDate: "asc" as const },
  { createdAt: "desc" as const },
];

/** Tasks assigned to a user, optionally filtered by status set. */
export async function listTasksForAssignee(
  userId: string,
  statuses?: TaskStatus[],
): Promise<TaskListItem[]> {
  const rows = await prisma.task.findMany({
    where: { assigneeId: userId, ...(statuses ? { status: { in: statuses } } : {}) },
    orderBy: LIST_ORDER,
    include: LIST_INCLUDE,
  });
  return rows.map(toListItem);
}

/** Every task (management view), optionally filtered by a single status. */
export async function listAllTasks(status?: string): Promise<TaskListItem[]> {
  const rows = await prisma.task.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ updatedAt: "desc" }],
    include: LIST_INCLUDE,
  });
  return rows.map(toListItem);
}

/** Tasks attached to a specific CRM entity (for its detail page). */
export async function listTasksForEntity(
  entityType: string,
  entityId: string,
): Promise<TaskListItem[]> {
  const rows = await prisma.task.findMany({
    where: { entityType, entityId },
    orderBy: LIST_ORDER,
    include: LIST_INCLUDE,
  });
  return rows.map(toListItem);
}

/** Count of a user's still-open tasks (dashboard badge / My Tasks). */
export function openTaskCount(userId: string): Promise<number> {
  return prisma.task.count({
    where: { assigneeId: userId, status: { in: OPEN_TASK_STATUSES } },
  });
}

/** Management summary counts. */
export async function taskCounts(): Promise<{
  open: number;
  completed: number;
  overdue: number;
}> {
  const [open, completed, overdue] = await Promise.all([
    prisma.task.count({ where: { status: { in: OPEN_TASK_STATUSES } } }),
    prisma.task.count({ where: { status: TASK_STATUS.COMPLETED } }),
    prisma.task.count({
      where: { status: { in: OPEN_TASK_STATUSES }, dueDate: { lt: new Date() } },
    }),
  ]);
  return { open, completed, overdue };
}
