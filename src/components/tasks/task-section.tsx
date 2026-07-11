import Link from "next/link";
import { Clock } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasRoleAtLeast, ROLES } from "@/lib/constants";
import { DetailSection } from "@/components/crm/detail";
import { subjectMeta } from "@/lib/approvals/subjects";
import {
  listAssignableUsers,
  listTasksForEntity,
} from "@/lib/tasks/service";
import { formatDate } from "@/lib/utils";
import { TaskPriorityBadge, TaskStatusBadge } from "./task-badges";
import { EntityTaskCreate } from "./entity-task-create";

/**
 * Server wrapper that mounts the task list + assignment onto any CRM entity
 * detail page. Everyone sees the entity's tasks; managers also get a scoped
 * "new task" button. Drop it on a subject detail page:
 *
 *   <TaskSection entityType={ENTITY_TYPES.CONTRACT} entityId={id} entityTitle={c.title} />
 */
export async function TaskSection({
  entityType,
  entityId,
  entityTitle,
}: {
  entityType: string;
  entityId: string;
  entityTitle: string;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const isManager = hasRoleAtLeast(user.role, ROLES.MANAGER);
  const [tasks, users] = await Promise.all([
    listTasksForEntity(entityType, entityId),
    isManager ? listAssignableUsers() : Promise.resolve([]),
  ]);

  const entityLabel = subjectMeta(entityType)?.label ?? entityType;

  return (
    <DetailSection
      title="المهام"
      action={
        isManager ? (
          <EntityTaskCreate
            entityType={entityType}
            entityId={entityId}
            entityLabel={entityLabel}
            entityTitle={entityTitle}
            users={users}
          />
        ) : undefined
      }
    >
      {tasks.length === 0 ? (
        <p className="py-2 text-sm text-slate-400">لا توجد مهام على هذا العنصر</p>
      ) : (
        <ul className="divide-y divide-line">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-brand-900">{task.title}</p>
                  <TaskPriorityBadge priority={task.priority} />
                  <TaskStatusBadge status={task.status} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span>المسنَد إليه: {task.assigneeName}</span>
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
                    </span>
                  )}
                </div>
                {task.notes && (
                  <p className="mt-1 text-xs text-slate-500">{task.notes}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <Link
          href="/tasks"
          className="text-xs text-brand-600 hover:text-brand-700"
        >
          عرض مهامي ←
        </Link>
      </div>
    </DetailSection>
  );
}
