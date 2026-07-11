import {
  BookOpen,
  FolderTree,
  Search,
  ListChecks,
  Bell,
  Database,
  ClipboardCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { RoleGuideTabs } from "@/components/help/role-guide-tabs";
import {
  EMPLOYEE_GUIDE_STEPS,
  SYSTEM_OVERVIEW,
} from "@/components/help/guide-content";

export const metadata = { title: "دليل الاستخدام" };

const STEP_ICONS = [
  BookOpen,
  FolderTree,
  Search,
  ListChecks,
  Bell,
  ClipboardCheck,
] as const;

export default function HelpPage() {
  return (
    <>
      <PageHeader
        title="دليل الاستخدام"
        description="مرجع سريع للموظفين: كيفية استخدام النظام وفهم الأدوار والصلاحيات"
      />

      {/* نظرة سريعة */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-brand-900">
          {SYSTEM_OVERVIEW.title}
        </h2>
        <div className="rounded-card border border-line bg-white p-5 shadow-card sm:p-6">
          <div className="space-y-3 text-sm leading-relaxed text-slate-600">
            {SYSTEM_OVERVIEW.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {SYSTEM_OVERVIEW.highlights.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-line bg-surface-muted/40 p-4"
              >
                <p className="font-medium text-brand-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* دليل الموظفين */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-brand-900">
          دليل الاستخدام للموظفين
        </h2>
        <div className="rounded-card border border-line bg-white shadow-card">
          <ol className="divide-y divide-line">
            {EMPLOYEE_GUIDE_STEPS.map((step, idx) => {
              const Icon = STEP_ICONS[idx] ?? Database;
              return (
                <li key={step.title} className="flex gap-4 p-4 sm:p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brand-900">
                      <span className="ms-1 text-brand-500">
                        {idx + 1}.
                      </span>{" "}
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">
                      {step.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* الأدوار */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-brand-900">
          الأدوار بالتفصيل
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          اختر دورك لمعرفة الصلاحيات والصفحات وسير العمل اليومي. دور المطالع
          موجّز؛ الأدوار الأخرى موضّحة بالتفصيل.
        </p>
        <RoleGuideTabs />
      </section>
    </>
  );
}
