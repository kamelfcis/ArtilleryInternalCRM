import { FileText, Link2 } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/ui/page-header";
import { ReviewLinkRow } from "@/components/linking/review-link-row";
import {
  listSuggestedLinks,
  canReviewLinks,
  type ReviewGroup,
} from "@/lib/linking/review-service";

export const dynamic = "force-dynamic";

/**
 * Link review queue (Phase 4.5). Surfaces the SUGGESTED document→CRM links the
 * linker proposed (Phase 4.4), grouped by document, and lets MANAGER+ reviewers
 * confirm or reject each one. Regular users see the queue read-only.
 */
export default async function LinkReviewPage() {
  const user = await requireUser();
  const canReview = canReviewLinks(user.role);
  const groups = await listSuggestedLinks();
  const totalLinks = groups.reduce((n, g) => n + g.links.length, 0);

  return (
    <>
      <PageHeader
        title="مراجعة الروابط"
        description="تأكيد أو رفض روابط الوثائق المقترحة مع سجلات النظام"
      />

      {!canReview && groups.length > 0 && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
          العرض فقط — تأكيد الروابط ورفضها متاح للمديرين فقط.
        </p>
      )}

      {groups.length === 0 ? (
        <div className="rounded-card border border-line bg-white p-10 text-center shadow-card">
          <Link2 className="mx-auto mb-3 h-8 w-8 text-slate-300" aria-hidden />
          <p className="text-sm text-slate-400">لا توجد روابط بانتظار المراجعة</p>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-xs text-slate-400">
            {totalLinks} رابط مقترح عبر {groups.length} وثيقة
          </p>
          {groups.map((group) => (
            <DocumentCard key={group.documentId} group={group} canReview={canReview} />
          ))}
        </div>
      )}
    </>
  );
}

function DocumentCard({
  group,
  canReview,
}: {
  group: ReviewGroup;
  canReview: boolean;
}) {
  return (
    <section className="rounded-card border border-line bg-white shadow-card">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <a
          href={group.documentHref}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-sm font-semibold text-brand-900 hover:underline"
        >
          {group.documentName}
        </a>
        <span className="mr-auto shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-slate-500">
          {group.links.length} رابط
        </span>
      </header>
      <div className="divide-y divide-line px-4">
        {group.links.map((item) => (
          <ReviewLinkRow key={item.id} item={item} canReview={canReview} />
        ))}
      </div>
    </section>
  );
}
