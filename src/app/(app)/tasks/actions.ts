"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import {
  changeMyTaskStatus,
  createTask,
  deleteTask,
  updateTask,
} from "@/lib/tasks/service";
import { subjectMeta } from "@/lib/approvals/subjects";
import { AppError } from "@/lib/errors";
import { errorState, type ActionState } from "@/lib/action-result";

/**
 * Server actions behind the task screens. Each authenticates, delegates ALL
 * rules to the task service (RBAC + event emission), then revalidates the
 * affected paths. Audit + notifications happen via the event subscribers.
 */

function parseDueDate(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Revalidate every surface a task change can appear on. */
function revalidateTaskSurfaces(entityType?: string, entityId?: string) {
  revalidatePath("/tasks");
  revalidatePath("/tasks/manage");
  revalidatePath("/", "layout"); // notification bell badge
  if (entityType && entityId) {
    const meta = subjectMeta(entityType);
    if (meta) revalidatePath(meta.href(entityId));
  }
}

export async function createTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const entityType = String(formData.get("entityType") ?? "");
  const entityId = String(formData.get("entityId") ?? "");
  const title = String(formData.get("title") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const priority = String(formData.get("priority") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "");
  const dueDate = parseDueDate(String(formData.get("dueDate") ?? ""));

  if (!entityType || !entityId || !assigneeId || !title.trim()) {
    return errorState("يرجى تعبئة الحقول المطلوبة");
  }

  try {
    await createTask(
      { entityType, entityId, title, notes, priority, dueDate, assigneeId },
      { id: user.id, role: user.role },
    );
    revalidateTaskSurfaces(entityType, entityId);
    return { ok: true, message: "تم إنشاء المهمة وإسنادها بنجاح" };
  } catch (error) {
    if (error instanceof AppError) return errorState(error.message);
    console.error("[tasks.create] unexpected error", error);
    return errorState("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى");
  }
}

export async function updateTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return errorState("طلب غير صالح");

  const entityType = String(formData.get("entityType") ?? "");
  const entityId = String(formData.get("entityId") ?? "");

  try {
    await updateTask(
      taskId,
      {
        title: String(formData.get("title") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        priority: String(formData.get("priority") ?? ""),
        assigneeId: String(formData.get("assigneeId") ?? ""),
        status: String(formData.get("status") ?? ""),
        dueDate: parseDueDate(String(formData.get("dueDate") ?? "")),
      },
      { id: user.id, role: user.role },
    );
    revalidateTaskSurfaces(entityType, entityId);
    return { ok: true, message: "تم تحديث المهمة بنجاح" };
  } catch (error) {
    if (error instanceof AppError) return errorState(error.message);
    console.error("[tasks.update] unexpected error", error);
    return errorState("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى");
  }
}

/**
 * Assignee self-service status change (start / hold / complete). Plain action
 * used by single-button forms in "مهامي"; failures revalidate silently.
 */
export async function deleteTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return errorState("طلب غير صالح");

  const entityType = String(formData.get("entityType") ?? "");
  const entityId = String(formData.get("entityId") ?? "");

  try {
    await deleteTask(taskId, { id: user.id, role: user.role });
    revalidateTaskSurfaces(entityType, entityId);
    return { ok: true, message: "تم حذف المهمة بنجاح" };
  } catch (error) {
    if (error instanceof AppError) return errorState(error.message);
    console.error("[tasks.delete] unexpected error", error);
    return errorState("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى");
  }
}

export async function setMyTaskStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!taskId || !status) return;

  try {
    await changeMyTaskStatus(taskId, status, { id: user.id, role: user.role });
  } catch (error) {
    console.error("[tasks.setMyStatus] error", error);
  }
  revalidatePath("/tasks");
  revalidatePath("/", "layout");
}
