import Link from "next/link";
import { ChevronRight, ChevronLeft, ScrollText } from "lucide-react";
import { requireRole } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import {
  ROLES,
  AUDIT_ACTION_LABELS,
  type AuditAction,
} from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, toArabicDigits } from "@/lib/utils";

export const metadata = { title: "سجل التدقيق" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  await requireRole(ROLES.ADMIN);

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const [total, entries] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        summary: true,
        entityType: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="سجل التدقيق"
        description={`سجل كامل لجميع الإجراءات (${toArabicDigits(String(total))} إجراء)`}
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="لا توجد سجلات"
          description="لم يتم تسجيل أي إجراءات بعد."
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-right text-xs font-medium text-slate-500">
                  <th className="px-4 py-3 font-medium">الإجراء</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">
                    المستخدم
                  </th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    التاريخ والوقت
                  </th>
                  <th className="hidden px-4 py-3 font-medium xl:table-cell">
                    العنوان
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-muted/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-brand-900">
                        {AUDIT_ACTION_LABELS[e.action as AuditAction] ??
                          e.action}
                      </p>
                      {e.summary && (
                        <p className="text-xs text-slate-500">{e.summary}</p>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                      {e.user?.name ?? "النظام"}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-slate-500 md:table-cell">
                      {formatDateTime(e.createdAt)}
                    </td>
                    <td
                      className="hidden px-4 py-3 text-xs text-slate-400 xl:table-cell"
                      dir="ltr"
                    >
                      {e.ipAddress ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav
              className="mt-4 flex items-center justify-between"
              aria-label="ترقيم الصفحات"
            >
              <PagerLink
                page={page - 1}
                disabled={page <= 1}
                icon={<ChevronRight className="h-4 w-4" aria-hidden />}
                label="السابق"
              />
              <span className="text-sm text-slate-500">
                صفحة {toArabicDigits(String(page))} من{" "}
                {toArabicDigits(String(totalPages))}
              </span>
              <PagerLink
                page={page + 1}
                disabled={page >= totalPages}
                icon={<ChevronLeft className="h-4 w-4" aria-hidden />}
                label="التالي"
                trailing
              />
            </nav>
          )}
        </>
      )}
    </>
  );
}

function PagerLink({
  page,
  disabled,
  icon,
  label,
  trailing,
}: {
  page: number;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  trailing?: boolean;
}) {
  if (disabled) {
    return (
      <span className="btn-secondary pointer-events-none opacity-50">
        {!trailing && icon}
        {label}
        {trailing && icon}
      </span>
    );
  }
  return (
    <Link href={`/admin/audit?page=${page}`} className="btn-secondary">
      {!trailing && icon}
      {label}
      {trailing && icon}
    </Link>
  );
}
