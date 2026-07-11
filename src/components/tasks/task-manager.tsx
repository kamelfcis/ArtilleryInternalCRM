"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Clock } from "lucide-react";
import { TaskFormModal } from "./task-form-modal";
import { TaskPriorityBadge, TaskStatusBadge } from "./task-badges";
import { formatDate } from "@/lib/utils";
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
                    <button
                      type="button"
                      onClick={() => setEditing(task)}
                      className="btn-ghost p-2"
                      aria-label="تعديل المهمة"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
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
    </>
  );
}
