import { StatusBadge } from "@/components/crm/status-badge";
import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
} from "@/lib/tasks/constants";

/** Task priority pill — reuses the shared StatusBadge with priority tones. */
export function TaskPriorityBadge({
  priority,
  className,
}: {
  priority: string;
  className?: string;
}) {
  const meta = TASK_PRIORITY_META[priority] ?? {
    label: priority,
    tone: "neutral" as const,
  };
  return <StatusBadge label={meta.label} tone={meta.tone} className={className} />;
}

/** Task status pill — reuses the shared StatusBadge with status tones. */
export function TaskStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const meta = TASK_STATUS_META[status] ?? {
    label: status,
    tone: "neutral" as const,
  };
  return <StatusBadge label={meta.label} tone={meta.tone} className={className} />;
}
