"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-result";
import { createTaskAction, updateTaskAction } from "@/app/(app)/tasks/actions";
import { ENTITY_KIND_META, ENTITY_KIND_ORDER } from "@/lib/crm/constants";
import {
  TASK_PRIORITY,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from "@/lib/tasks/constants";
import { cn, toDateInputValue } from "@/lib/utils";
import type { AssignableUser, SubjectOption, TaskListItem } from "@/lib/tasks/service";

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  users: AssignableUser[];
  /** Create-with-picker: entities grouped by kind. */
  subjectsByKind?: Record<string, SubjectOption[]>;
  /** Create scoped to a fixed CRM entity (from its detail page). */
  fixedSubject?: { entityType: string; entityId: string; label: string };
  /** Edit target. */
  task?: TaskListItem;
}

/**
 * Reusable task create/edit dialog. One component powers the management screen
 * (create with an entity picker, or edit any task) and the per-entity task
 * section (create scoped to a fixed subject). All rules live in the service;
 * this only gathers input and posts to the shared server actions.
 */
export function TaskFormModal({
  open,
  onClose,
  mode,
  users,
  subjectsByKind,
  fixedSubject,
  task,
}: TaskFormModalProps) {
  const action = mode === "edit" ? updateTaskAction : createTaskAction;
  const [state, formAction] = useFormState(action, initialActionState);
  const router = useRouter();

  const kinds = ENTITY_KIND_ORDER.filter(
    (k) => (subjectsByKind?.[k]?.length ?? 0) > 0,
  );
  const [kind, setKind] = useState<string>(task?.entityType ?? kinds[0] ?? "");
  const entityOptions = subjectsByKind?.[kind] ?? [];

  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(() => {
        onClose();
        router.refresh();
      }, 500);
      return () => clearTimeout(t);
    }
  }, [state.ok, onClose, router]);

  const title = mode === "edit" ? "تعديل المهمة" : "مهمة جديدة";

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form action={formAction} className="space-y-4">
        {mode === "edit" && (
          <input type="hidden" name="taskId" value={task?.id ?? ""} />
        )}

        {/* Subject binding */}
        {fixedSubject ? (
          <>
            <input type="hidden" name="entityType" value={fixedSubject.entityType} />
            <input type="hidden" name="entityId" value={fixedSubject.entityId} />
          </>
        ) : mode === "edit" ? (
          <>
            <input type="hidden" name="entityType" value={task?.entityType ?? ""} />
            <input type="hidden" name="entityId" value={task?.entityId ?? ""} />
          </>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="task-kind" className="field-label">
                نوع العنصر <span className="text-red-500">*</span>
              </label>
              <select
                id="task-kind"
                className="field-input"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {ENTITY_KIND_META[k].labelSingular}
                  </option>
                ))}
              </select>
              <input type="hidden" name="entityType" value={kind} />
            </div>
            <div>
              <label htmlFor="task-entity" className="field-label">
                العنصر <span className="text-red-500">*</span>
              </label>
              <select
                id="task-entity"
                name="entityId"
                className="field-input"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  اختر العنصر…
                </option>
                {entityOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {fixedSubject && (
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-slate-500">
            {fixedSubject.label}
          </p>
        )}

        <div>
          <label htmlFor="task-title" className="field-label">
            عنوان المهمة <span className="text-red-500">*</span>
          </label>
          <input
            id="task-title"
            name="title"
            type="text"
            required
            defaultValue={task?.title ?? ""}
            className="field-input"
            placeholder="مثال: تجهيز مستندات التعاقد"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="task-assignee" className="field-label">
              المسنَد إليه <span className="text-red-500">*</span>
            </label>
            <select
              id="task-assignee"
              name="assigneeId"
              required
              defaultValue={task?.assigneeId ?? ""}
              className="field-input"
            >
              <option value="" disabled>
                اختر المستخدم…
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.jobTitle ? ` — ${u.jobTitle}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="task-priority" className="field-label">
              الأولوية
            </label>
            <select
              id="task-priority"
              name="priority"
              defaultValue={task?.priority ?? TASK_PRIORITY.MEDIUM}
              className="field-input"
            >
              {TASK_PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="task-due" className="field-label">
              تاريخ الاستحقاق
            </label>
            <input
              id="task-due"
              name="dueDate"
              type="date"
              defaultValue={toDateInputValue(task?.dueDate)}
              className="field-input"
            />
          </div>
          {mode === "edit" && (
            <div>
              <label htmlFor="task-status" className="field-label">
                الحالة
              </label>
              <select
                id="task-status"
                name="status"
                defaultValue={task?.status ?? ""}
                className="field-input"
              >
                {TASK_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="task-notes" className="field-label">
            ملاحظات
          </label>
          <textarea
            id="task-notes"
            name="notes"
            rows={3}
            defaultValue={task?.notes ?? ""}
            className="field-input resize-none"
            placeholder="تفاصيل إضافية للمهمة…"
          />
        </div>

        {state.message && (
          <div
            role={state.ok ? "status" : "alert"}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm",
              state.ok
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {state.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{state.message}</span>
          </div>
        )}

        <div className="flex justify-start gap-2 pt-1">
          <SubmitButton pendingLabel="جارٍ الحفظ…">
            {mode === "edit" ? "حفظ التغييرات" : "إنشاء وإسناد"}
          </SubmitButton>
          <button type="button" onClick={onClose} className="btn-secondary">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
