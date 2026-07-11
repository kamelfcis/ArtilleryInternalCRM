import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/ui/page-header";
import { ApprovalStatusBadge } from "@/components/approvals/status-badge";
import {
  listApprovalsByStatus,
  type ApprovalListItem,
} from "@/lib/approvals/service";
import { APPROVAL_STATUS, PENDING_STATUSES } from "@/lib/approvals/constants";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Approvals inbox. Surfaces the workflow queue: items awaiting a reviewer
 * decision (submitted / under review) and the most recently decided items.
 * Every row links to the subject's detail page, where the approval panel lives.
 */
export default async function ApprovalsPage() {
  await requireUser();

  const [pending, decided] = await Promise.all([
    listApprovalsByStatus(PENDING_STATUSES, 50),
    listApprovalsByStatus(
      [APPROVAL_STATUS.APPROVED, APPROVAL_STATUS.REJECTED],
      20,
    ),
  ]);

  return (
    <>
      <PageHeader
        title="الاعتمادات"
        description="متابعة طلبات الاعتماد وسير المراجعة"
      />

      <div className="space-y-8">
        <ApprovalGroup
          title="بانتظار المراجعة"
          emptyLabel="لا توجد طلبات بانتظار المراجعة"
          items={pending}
        />
        <ApprovalGroup
          title="قرارات حديثة"
          emptyLabel="لا توجد قرارات بعد"
          items={decided}
        />
      </div>
    </>
  );
}

function ApprovalGroup({
  title,
  emptyLabel,
  items,
}: {
  title: string;
  emptyLabel: string;
  items: ApprovalListItem[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-brand-900">{title}</h2>
      <div className="rounded-card border border-line bg-white p-2 shadow-card">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-slate-400">
            {emptyLabel}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="-mx-1 flex items-center justify-between gap-3 rounded-lg px-3 py-3 hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-slate-500">
                        {item.subjectLabel}
                      </span>
                      <p className="truncate text-sm font-medium text-brand-900">
                        {item.title}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      مُقدِّم الطلب: {item.requestedBy} · {timeAgo(item.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ApprovalStatusBadge status={item.status} />
                    <ChevronLeft className="h-4 w-4 text-slate-300" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
