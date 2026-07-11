import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getSite } from "@/lib/crm/services/site";
import { NotFoundError } from "@/lib/errors";
import { getStatusMeta, ENTITY_KINDS } from "@/lib/crm/constants";
import { ENTITY_TYPES } from "@/lib/constants";
import { StatusBadge } from "@/components/crm/status-badge";
import {
  DetailSection,
  InfoGrid,
  RelatedList,
  DocumentsFolderButton,
} from "@/components/crm/detail";
import { ApprovalSection } from "@/components/approvals/approval-section";
import { TaskSection } from "@/components/tasks/task-section";

export const dynamic = "force-dynamic";

export default async function SiteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();

  let site;
  try {
    site = await getSite(params.id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/crm/sites"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
          العودة إلى المواقع
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-brand-900">{site.name}</h1>
          <DocumentsFolderButton folderId={site.folder?.id ?? null} />
        </div>
      </div>

      <DetailSection title="بيانات الموقع">
        <InfoGrid
          items={[
            { label: "الرمز", value: site.code },
            { label: "العنوان", value: site.address },
            { label: "الوصف", value: site.description },
            { label: "أضيف بواسطة", value: site.createdBy.name },
          ]}
        />
      </DetailSection>

      <DetailSection title="المشروعات في هذا الموقع">
        <RelatedList
          emptyLabel="لا توجد مشروعات مرتبطة"
          items={site.projects.map((p) => ({
            id: p.id,
            href: `/crm/projects/${p.id}`,
            title: p.name,
            subtitle: p.code ?? undefined,
            trailing: (
              <StatusBadge {...getStatusMeta(ENTITY_KINDS.PROJECT, p.status)} />
            ),
          }))}
        />
      </DetailSection>

      <ApprovalSection subjectType={ENTITY_TYPES.SITE} subjectId={site.id} />

      <TaskSection
        entityType={ENTITY_TYPES.SITE}
        entityId={site.id}
        entityTitle={site.name}
      />
    </div>
  );
}
