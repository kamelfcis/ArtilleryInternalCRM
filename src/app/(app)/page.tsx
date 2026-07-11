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
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { approvalCounts } from "@/lib/approvals/service";
import { openTaskCount } from "@/lib/tasks/service";
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
    <div className="animate-fade-in-up space-y-8">
      {/* Hero welcome banner */}
      <div className="dashboard-hero">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-brand-200">
              <Sparkles className="h-4 w-4 text-accent-cyan-light" aria-hidden />
              <span className="text-xs font-medium tracking-wide">
                لوحة المتابعة العامة
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white">
              أهلًا، {user.name}
            </h1>
            <p className="mt-1.5 text-sm text-brand-200">
              {ROLE_LABELS[user.role]} · نظرة شاملة على النظام
            </p>
          </div>
          <div className="flex gap-3">
            <HeroStat
              label="المجلدات"
              value={toArabicDigits(String(folderCount))}
            />
            <HeroStat
              label="الوثائق"
              value={toArabicDigits(String(documentCount))}
            />
            <HeroStat
              label="المستخدمون"
              value={toArabicDigits(String(activeUsers))}
            />
          </div>
        </div>
      </div>

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

      {/* CRM modules */}
      <section>
        <SectionHeader title="إدارة البيانات" />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {crmModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="crm-module-card"
                style={
                  {
                    "--module-color": mod.color,
                  } as React.CSSProperties
                }
              >
                <span
                  className="absolute inset-x-0 top-0 h-0.5 opacity-60 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: `linear-gradient(90deg, ${mod.color}, ${mod.color}88)` }}
                />
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-black/5"
                  style={{
                    backgroundColor: `${mod.color}18`,
                    color: mod.color,
                    boxShadow: `0 0 12px -2px ${mod.color}40`,
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
      <section>
        <SectionHeader
          title="الاعتمادات"
          href="/approvals"
          linkLabel="عرض الكل"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      <section>
        <SectionHeader title="مهامي" href="/tasks" linkLabel="عرض الكل" />
        <div className="mt-4">
          <ApprovalCard
            href="/tasks"
            label="مهام مفتوحة مُسنَدة إليك"
            value={toArabicDigits(String(myOpenTasks))}
            icon={<ListChecks className="h-5 w-5" />}
            tone="amber"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick access to core folders */}
        <section className="lg:col-span-2">
          <SectionHeader
            title="الوصول السريع"
            href="/folders"
            linkLabel="عرض الكل"
          />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {coreFolders.map((folder) => {
              const color = folder.color ?? "#2f66b5";
              return (
                <Link
                  key={folder.id}
                  href={`/folders/${folder.id}`}
                  className="group flex items-center gap-3 rounded-card border border-line/60 bg-white/75 p-4 shadow-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover"
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-black/5 transition-shadow duration-300 group-hover:shadow-glow"
                    style={{
                      backgroundColor: `${color}18`,
                      color,
                      boxShadow: `0 0 10px -2px ${color}35`,
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
              );
            })}
          </div>
        </section>

        {/* Recent activity */}
        <section>
          <SectionHeader title="آخر النشاطات" />
          <div className="mt-4 glass-surface overflow-hidden p-2">
            {recentActivity.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">
                لا توجد نشاطات بعد
              </p>
            ) : (
              <ul className="divide-y divide-line/60">
                {recentActivity.map((entry, idx) => (
                  <li
                    key={entry.id}
                    className="flex gap-3 px-3 py-3 transition-colors hover:bg-brand-50/50"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <span className="activity-dot" />
                    <div className="min-w-0">
                      <p className="text-sm text-brand-900">
                        {entry.summary ??
                          AUDIT_ACTION_LABELS[entry.action as AuditAction] ??
                          entry.action}
                      </p>
                      <p className="text-xs text-slate-400">
                        {entry.user?.name ?? "النظام"} ·{" "}
                        {timeAgo(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 px-4 py-2.5 text-center ring-1 ring-white/20 backdrop-blur-sm">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-brand-200">{label}</p>
    </div>
  );
}

function SectionHeader({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="section-heading pb-1">{title}</h2>
      {href && linkLabel && (
        <Link href={href} className="section-link">
          {linkLabel}
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

const STAT_TONES = {
  brand: {
    bar: "bg-gradient-to-l from-brand-500 to-brand-400",
    icon: "bg-brand-50 text-brand-600 shadow-glow",
  },
  green: {
    bar: "bg-gradient-to-l from-emerald-500 to-accent-emerald",
    icon: "bg-emerald-50 text-emerald-600 shadow-glow-green",
  },
  amber: {
    bar: "bg-gradient-to-l from-amber-500 to-accent-amber",
    icon: "bg-amber-50 text-amber-600 shadow-glow-amber",
  },
  violet: {
    bar: "bg-gradient-to-l from-violet-500 to-accent-violet",
    icon: "bg-violet-50 text-violet-600 shadow-glow-violet",
  },
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
  tone: keyof typeof STAT_TONES;
}) {
  const t = STAT_TONES[tone];
  return (
    <div className="stat-card">
      <span className={`absolute inset-x-0 top-0 h-1 rounded-t-card ${t.bar}`} />
      <div className="flex items-center justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${t.icon}`}
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
  amber: {
    icon: "bg-amber-50 text-amber-600 shadow-glow-amber",
    border: "hover:border-amber-200",
  },
  green: {
    icon: "bg-emerald-50 text-emerald-600 shadow-glow-green",
    border: "hover:border-emerald-200",
  },
  red: {
    icon: "bg-red-50 text-red-600 shadow-glow-red",
    border: "hover:border-red-200",
  },
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
  const t = APPROVAL_TONES[tone];
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-card border border-line/60 bg-white/75 p-4 shadow-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover ${t.border}`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-lg transition-shadow duration-300 group-hover:shadow-glow ${t.icon}`}
      >
        {icon}
      </span>
      <div>
        <p className="text-2xl font-bold text-brand-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </Link>
  );
}
