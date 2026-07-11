"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Clock, Trash2, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { TaskFormModal } from "./task-form-modal";
import { TaskPriorityBadge, TaskStatusBadge } from "./task-badges";
import { formatDate } from "@/lib/utils";
import { initialActionState } from "@/lib/action-result";
import { deleteTaskAction } from "@/app/(app)/tasks/actions";
import type {
  AssignableUser,
  SubjectOption,
  TaskListItem,
} from "@/lib/tasks/service";

/**
 * Management table for "إدارة المهام". Managers create, reassign, re-prioritise
 * and monitor every task. Row edits and the "new task" dialog both reuse the
 * shared TaskFormModal; all rules live in the task service.
 */
export function TaskManager({
  tasks,
  users,
  subjectsByKind,
}: {
  tasks: TaskListItem[];
  users: AssignableUser[];
  subjectsByKind: Record<string, SubjectOption[]>;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TaskListItem | null>(null);
  const [deleting, setDeleting] = useState<TaskListItem | null>(null);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" aria-hidden />
          مهمة جديدة
        </button>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-white shadow-card">
        {tasks.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            لا توجد مهام
          </p>
        ) : (
          <table className="w-full min-w-[720px] text-start text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-slate-400">
                <th className="px-4 py-3 text-start font-medium">المهمة</th>
                <th className="px-4 py-3 text-start font-medium">العنصر</th>
                <th className="px-4 py-3 text-start font-medium">المسنَد إليه</th>
                <th className="px-4 py-3 text-start font-medium">الأولوية</th>
                <th className="px-4 py-3 text-start font-medium">الحالة</th>
                <th className="px-4 py-3 text-start font-medium">الاستحقاق</th>
                <th className="px-4 py-3 text-start font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-surface-muted/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-brand-900">{task.title}</p>
                    {task.notes && (
                      <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                        {task.notes}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-slate-500">
                      {task.entityLabel}
                    </span>
                    {task.entityHref ? (
                      <Link
                        href={task.entityHref}
                        className="ms-1.5 text-brand-600 hover:underline"
                      >
                        {task.entityTitle}
                      </Link>
                    ) : (
                      <span className="ms-1.5 text-slate-500">
                        {task.entityTitle}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-brand-900">{task.assigneeName}</td>
                  <td className="px-4 py-3">
                    <TaskPriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <TaskStatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3">
                    {task.dueDate ? (
                      <span
                        className={
                          task.overdue
                            ? "inline-flex items-center gap-1 font-medium text-red-600"
                            : "inline-flex items-center gap-1 text-slate-500"
                        }
                      >
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {formatDate(task.dueDate)}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(task)}
                        className="btn-ghost p-2 text-slate-500 hover:text-brand-700"
                        title="تعديل"
                        aria-label="تعديل المهمة"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(task)}
                        className="btn-ghost p-2 text-red-500 hover:bg-red-50"
                        title="حذف"
                        aria-label="حذف المهمة"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <TaskFormModal
          open
          mode="create"
          users={users}
          subjectsByKind={subjectsByKind}
          onClose={() => setCreating(false)}
        />
      )}

      {editing && (
        <TaskFormModal
          open
          mode="edit"
          users={users}
          task={editing}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <TaskDeleteModal task={deleting} onClose={() => setDeleting(null)} />
      )}
    </>
  );
}

function TaskDeleteModal({
  task,
  onClose,
}: {
  task: TaskListItem;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(deleteTaskAction, initialActionState);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(() => {
        onClose();
        router.refresh();
      }, 500);
      return () => clearTimeout(t);
    }
  }, [state.ok, onClose, router]);

  return (
    <Modal open onClose={onClose} title="حذف المهمة">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="entityType" value={task.entityType} />
        <input type="hidden" name="entityId" value={task.entityId} />
        <p className="text-sm text-slate-600">
          هل أنت متأكد من حذف{" "}
          <span className="font-semibold text-brand-900">«{task.title}»</span>؟
          لا يمكن التراجع عن هذا الإجراء.
        </p>
        {!state.ok && state.message && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span>{state.message}</span>
          </div>
        )}
        <div className="flex justify-start gap-2">
          <SubmitButton className="btn-danger" pendingLabel="جارٍ الحذف…">
            حذف
          </SubmitButton>
          <button type="button" onClick={onClose} className="btn-secondary">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
