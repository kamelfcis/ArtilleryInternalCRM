import Link from "next/link";
import { Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { requireRole } from "@/lib/auth/current-user";
import { ROLES } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { TaskManager } from "@/components/tasks/task-manager";
import {
  listAllTasks,
  listAssignableUsers,
  listSubjectsByKind,
  taskCounts,
} from "@/lib/tasks/service";
import {
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  isTaskStatus,
} from "@/lib/tasks/constants";
import { cn, toArabicDigits } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * "إدارة المهام" — the manager control room. Managers create, assign, reassign
 * and monitor every task across the department, with status filtering and live
 * summary counts. Restricted to MANAGER+ (RBAC enforced again in the service).
 */
export default async function ManageTasksPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await requireRole(ROLES.MANAGER);

  const statusFilter =
    searchParams.status && isTaskStatus(searchParams.status)
      ? searchParams.status
      : undefined;

  const [tasks, users, subjectsByKind, counts] = await Promise.all([
    listAllTasks(statusFilter),
    listAssignableUsers(),
    listSubjectsByKind(),
    taskCounts(),
  ]);

  return (
    <>
      <PageHeader
        title="إدارة المهام"
        description="إنشاء المهام وإسنادها ومتابعة تنفيذها عبر الأقسام"
      />

      {/* Summary counts */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CountCard
          label="مهام مفتوحة"
          value={counts.open}
          icon={<Clock className="h-5 w-5" />}
          tone="amber"
        />
        <CountCard
          label="مكتملة"
          value={counts.completed}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="green"
        />
        <CountCard
          label="متأخرة"
          value={counts.overdue}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="red"
        />
      </div>

      {/* Status filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip href="/tasks/manage" label="الكل" active={!statusFilter} />
        {TASK_STATUS_ORDER.map((status) => (
          <FilterChip
            key={status}
            href={`/tasks/manage?status=${status}`}
            label={TASK_STATUS_META[status]?.label ?? status}
            active={statusFilter === status}
          />
        ))}
      </div>

      <TaskManager tasks={tasks} users={users} subjectsByKind={subjectsByKind} />
    </>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-brand-500 bg-brand-500 text-white"
          : "border-line bg-white text-slate-500 hover:bg-surface-muted",
      )}
    >
      {label}
    </Link>
  );
}

const TONES = {
  amber: "bg-amber-50 text-amber-600",
  green: "bg-green-50 text-green-600",
  red: "bg-red-50 text-red-600",
} as const;

function CountCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="rounded-card border border-line bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            TONES[tone],
          )}
        >
          {icon}
        </span>
        <div>
          <p className="text-2xl font-bold text-brand-900">
            {toArabicDigits(String(value))}
          </p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
