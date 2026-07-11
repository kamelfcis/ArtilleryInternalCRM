import Link from "next/link";
import {
  FolderTree,
  FileText,
  Database,
  Users,
  ArrowLeft,
  Folder as FolderIcon,
  Building2,
  FolderKanban,
  FileSignature,
  ShoppingCart,
  Gavel,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { approvalCounts } from "@/lib/approvals/service";
import { openTaskCount } from "@/lib/tasks/service";
import { PageHeader } from "@/components/ui/page-header";
import {
  formatFileSize,
  toArabicDigits,
  timeAgo,
} from "@/lib/utils";
import {
  AUDIT_ACTION_LABELS,
  ROLE_LABELS,
  type AuditAction,
} from "@/lib/constants";
import { ENTITY_KIND_META } from "@/lib/crm/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  const [
    folderCount,
    documentCount,
    sizeAgg,
    activeUsers,
    coreFolders,
    recentActivity,
    companyCount,
    projectCount,
    contractCount,
    purchaseCount,
    practiceCount,
    siteCount,
    approvals,
    myOpenTasks,
  ] = await Promise.all([
    prisma.folder.count({ where: { deletedAt: null } }),
    prisma.document.count({ where: { deletedAt: null } }),
    prisma.document.aggregate({
      where: { deletedAt: null },
      _sum: { size: true },
    }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.folder.findMany({
      where: { parentId: null, deletedAt: null },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      select: { id: true, name: true, color: true, description: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        summary: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    prisma.company.count({ where: { deletedAt: null } }),
    prisma.project.count({ where: { deletedAt: null } }),
    prisma.contract.count({ where: { deletedAt: null } }),
    prisma.purchase.count({ where: { deletedAt: null } }),
    prisma.practice.count({ where: { deletedAt: null } }),
    prisma.site.count({ where: { deletedAt: null } }),
    approvalCounts(),
    openTaskCount(user.id),
  ]);

  const totalSize = sizeAgg._sum.size ?? 0;

  const crmModules: {
    label: string;
    count: number;
    href: string;
    icon: LucideIcon;
    color: string;
  }[] = [
    {
      label: ENTITY_KIND_META.COMPANY.labelPlural,
      count: companyCount,
      href: "/crm/companies",
      icon: Building2,
      color: ENTITY_KIND_META.COMPANY.color,
    },
    {
      label: ENTITY_KIND_META.PROJECT.labelPlural,
      count: projectCount,
      href: "/crm/projects",
      icon: FolderKanban,
      color: ENTITY_KIND_META.PROJECT.color,
    },
    {
      label: ENTITY_KIND_META.CONTRACT.labelPlural,
      count: contractCount,
      href: "/crm/contracts",
      icon: FileSignature,
      color: ENTITY_KIND_META.CONTRACT.color,
    },
    {
      label: ENTITY_KIND_META.PURCHASE.labelPlural,
      count: purchaseCount,
      href: "/crm/purchases",
      icon: ShoppingCart,
      color: ENTITY_KIND_META.PURCHASE.color,
    },
    {
      label: ENTITY_KIND_META.PRACTICE.labelPlural,
      count: practiceCount,
      href: "/crm/practices",
      icon: Gavel,
      color: ENTITY_KIND_META.PRACTICE.color,
    },
    {
      label: ENTITY_KIND_META.SITE.labelPlural,
      count: siteCount,
      href: "/crm/sites",
      icon: MapPin,
      color: ENTITY_KIND_META.SITE.color,
    },
  ];

  return (
    <>
      <PageHeader
        title={`أهلًا، ${user.name}`}
        description={`${ROLE_LABELS[user.role]} · لوحة المتابعة العامة للنظام`}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<FolderTree className="h-5 w-5" />}
          label="المجلدات"
          value={toArabicDigits(String(folderCount))}
          tone="brand"
        />
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label="الوثائق"
          value={toArabicDigits(String(documentCount))}
          tone="green"
        />
        <StatCard
          icon={<Database className="h-5 w-5" />}
          label="المساحة المستخدمة"
          value={formatFileSize(totalSize)}
          tone="amber"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="المستخدمون النشطون"
          value={toArabicDigits(String(activeUsers))}
          tone="violet"
        />
      </div>

      {/* CRM modules — statistics + quick shortcuts to every data module */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-brand-900">
          إدارة البيانات
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {crmModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="rounded-card border border-line bg-white p-4 shadow-card transition-shadow hover:shadow-panel"
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `${mod.color}18`,
                    color: mod.color,
                  }}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <p className="mt-3 text-2xl font-bold text-brand-900">
                  {toArabicDigits(String(mod.count))}
                </p>
                <p className="text-sm text-slate-500">{mod.label}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Approval workflow summary */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-900">الاعتمادات</h2>
          <Link
            href="/approvals"
            className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
          >
            عرض الكل
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ApprovalCard
            href="/approvals"
            label="بانتظار المراجعة"
            value={toArabicDigits(String(approvals.pending))}
            icon={<Clock className="h-5 w-5" />}
            tone="amber"
          />
          <ApprovalCard
            href="/approvals"
            label="معتمدة"
            value={toArabicDigits(String(approvals.approved))}
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="green"
          />
          <ApprovalCard
            href="/approvals"
            label="مرفوضة"
            value={toArabicDigits(String(approvals.rejected))}
            icon={<XCircle className="h-5 w-5" />}
            tone="red"
          />
        </div>
      </section>

      {/* My open tasks */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-900">مهامي</h2>
          <Link
            href="/tasks"
            className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
          >
            عرض الكل
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <ApprovalCard
          href="/tasks"
          label="مهام مفتوحة مُسنَدة إليك"
          value={toArabicDigits(String(myOpenTasks))}
          icon={<ListChecks className="h-5 w-5" />}
          tone="amber"
        />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Quick access to core folders */}
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-900">
              الوصول السريع
            </h2>
            <Link
              href="/folders"
              className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
            >
              عرض الكل
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {coreFolders.map((folder) => (
              <Link
                key={folder.id}
                href={`/folders/${folder.id}`}
                className="flex items-center gap-3 rounded-card border border-line bg-white p-4 shadow-card transition-shadow hover:shadow-panel"
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `${folder.color ?? "#2f66b5"}18`,
                    color: folder.color ?? "#2f66b5",
                  }}
                >
                  <FolderIcon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-brand-900">
                    {folder.name}
                  </p>
                  {folder.description && (
                    <p className="truncate text-xs text-slate-500">
                      {folder.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent activity */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-brand-900">
            آخر النشاطات
          </h2>
          <div className="rounded-card border border-line bg-white p-2 shadow-card">
            {recentActivity.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">
                لا توجد نشاطات بعد
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {recentActivity.map((entry) => (
                  <li key={entry.id} className="flex gap-3 px-3 py-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                    <div className="min-w-0">
                      <p className="text-sm text-brand-900">
                        {entry.summary ??
                          AUDIT_ACTION_LABELS[entry.action as AuditAction] ??
                          entry.action}
                      </p>
                      <p className="text-xs text-slate-400">
                        {entry.user?.name ?? "النظام"} · {timeAgo(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

const TONES = {
  brand: "bg-brand-50 text-brand-600",
  green: "bg-green-50 text-green-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
} as const;

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="rounded-card border border-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${TONES[tone]}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-brand-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

const APPROVAL_TONES = {
  amber: "bg-amber-50 text-amber-600",
  green: "bg-green-50 text-green-600",
  red: "bg-red-50 text-red-600",
} as const;

function ApprovalCard({
  href,
  icon,
  label,
  value,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: keyof typeof APPROVAL_TONES;
}) {
  return (
    <Link
      href={href}
      className="rounded-card border border-line bg-white p-4 shadow-card transition-shadow hover:shadow-panel"
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${APPROVAL_TONES[tone]}`}
        >
          {icon}
        </span>
        <div>
          <p className="text-2xl font-bold text-brand-900">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </Link>
  );
}
