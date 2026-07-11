import Link from "next/link";
import { ChevronLeft, Clock, Play, Pause, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/ui/page-header";
import {
  TaskPriorityBadge,
  TaskStatusBadge,
} from "@/components/tasks/task-badges";
import { listTasksForAssignee, type TaskListItem } from "@/lib/tasks/service";
import {
  OPEN_TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  TASK_STATUS,
  type TaskStatus,
} from "@/lib/tasks/constants";
import { formatDate } from "@/lib/utils";
import { setMyTaskStatusAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * "مهامي" — every user's personal task inbox. Shows only tasks assigned to the
 * signed-in user, split into open work and closed items. The assignee can move
 * their own tasks through the lifecycle (start / hold / complete) inline.
 */
export default async function MyTasksPage() {
  const user = await requireUser();
  const tasks = await listTasksForAssignee(user.id);

  const open = tasks.filter((t) =>
    OPEN_TASK_STATUSES.includes(t.status as TaskStatus),
  );
  const closed = tasks.filter((t) =>
    TERMINAL_TASK_STATUSES.includes(t.status as TaskStatus),
  );

  return (
    <>
      <PageHeader
        title="مهامي"
        description="المهام المُسنَدة إليك ومتابعة تنفيذها"
      />

      <div className="space-y-8">
        <TaskGroup
          title="مهام مفتوحة"
          emptyLabel="لا توجد مهام مفتوحة"
          tasks={open}
          showActions
        />
        <TaskGroup
          title="مهام مغلقة"
          emptyLabel="لا توجد مهام مغلقة"
          tasks={closed}
        />
      </div>
    </>
  );
}

/** Self-service transitions available to the assignee for a given status. */
function assigneeActions(status: string): {
  status: TaskStatus;
  label: string;
  icon: typeof Play;
  style: string;
}[] {
  switch (status) {
    case TASK_STATUS.NEW:
      return [
        { status: TASK_STATUS.IN_PROGRESS, label: "بدء", icon: Play, style: "btn-secondary" },
        { status: TASK_STATUS.COMPLETED, label: "إكمال", icon: CheckCircle2, style: "btn-primary" },
      ];
    case TASK_STATUS.IN_PROGRESS:
      return [
        { status: TASK_STATUS.WAITING, label: "تعليق", icon: Pause, style: "btn-secondary" },
        { status: TASK_STATUS.COMPLETED, label: "إكمال", icon: CheckCircle2, style: "btn-primary" },
      ];
    case TASK_STATUS.WAITING:
      return [
        { status: TASK_STATUS.IN_PROGRESS, label: "استئناف", icon: Play, style: "btn-secondary" },
        { status: TASK_STATUS.COMPLETED, label: "إكمال", icon: CheckCircle2, style: "btn-primary" },
      ];
    default:
      return [];
  }
}

function TaskGroup({
  title,
  emptyLabel,
  tasks,
  showActions,
}: {
  title: string;
  emptyLabel: string;
  tasks: TaskListItem[];
  showActions?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-brand-900">{title}</h2>
      <div className="rounded-card border border-line bg-white p-2 shadow-card">
        {tasks.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-slate-400">
            {emptyLabel}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {tasks.map((task) => (
              <li key={task.id} className="px-3 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-slate-500">
                        {task.entityLabel}
                      </span>
                      <p className="text-sm font-medium text-brand-900">
                        {task.title}
                      </p>
                      <TaskPriorityBadge priority={task.priority} />
                      <TaskStatusBadge status={task.status} />
                    </div>
                    {task.notes && (
                      <p className="mt-1 text-xs text-slate-500">{task.notes}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      {task.entityHref && (
                        <Link
                          href={task.entityHref}
                          className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                        >
                          {task.entityTitle}
                          <ChevronLeft className="h-3 w-3" aria-hidden />
                        </Link>
                      )}
                      {task.dueDate && (
                        <span
                          className={
                            task.overdue
                              ? "inline-flex items-center gap-1 font-medium text-red-600"
                              : "inline-flex items-center gap-1"
                          }
                        >
                          <Clock className="h-3 w-3" aria-hidden />
                          {formatDate(task.dueDate)}
                          {task.overdue && " (متأخرة)"}
                        </span>
                      )}
                      <span>أسندها: {task.assignedByName}</span>
                    </div>
                  </div>

                  {showActions && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {assigneeActions(task.status).map((a) => {
                        const Icon = a.icon;
                        return (
                          <form key={a.status} action={setMyTaskStatusAction}>
                            <input type="hidden" name="taskId" value={task.id} />
                            <input type="hidden" name="status" value={a.status} />
                            <button type="submit" className={`${a.style} !px-2.5 !py-1.5 text-xs`}>
                              <Icon className="h-3.5 w-3.5" aria-hidden />
                              {a.label}
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
