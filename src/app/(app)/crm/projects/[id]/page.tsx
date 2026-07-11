import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getProject } from "@/lib/crm/services/project";
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
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();

  let project;
  try {
    project = await getProject(params.id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const status = getStatusMeta(ENTITY_KINDS.PROJECT, project.status);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/crm/projects"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
          العودة إلى المشروعات
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-brand-900">{project.name}</h1>
            <StatusBadge label={status.label} tone={status.tone} />
          </div>
          <DocumentsFolderButton folderId={project.folder?.id ?? null} />
        </div>
      </div>

      <DetailSection title="بيانات المشروع">
        <InfoGrid
          items={[
            { label: "الرمز", value: project.code },
            {
              label: "الموقع",
              value: project.site ? (
                <Link
                  href={`/crm/sites/${project.site.id}`}
                  className="text-brand-600 hover:underline"
                >
                  {project.site.name}
                </Link>
              ) : null,
            },
            { label: "الميزانية", value: formatCurrency(project.budget) },
            {
              label: "تاريخ البدء",
              value: project.startDate ? formatDate(project.startDate) : null,
            },
            {
              label: "تاريخ الانتهاء",
              value: project.endDate ? formatDate(project.endDate) : null,
            },
            { label: "أضيف بواسطة", value: project.createdBy.name },
            { label: "الوصف", value: project.description },
          ]}
        />
      </DetailSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <DetailSection title="العقود">
          <RelatedList
            emptyLabel="لا توجد عقود"
            items={project.contracts.map((c) => ({
              id: c.id,
              href: `/crm/contracts/${c.id}`,
              title: c.title,
              subtitle: `${c.contractNumber}${
                c.company ? ` · ${c.company.name}` : ""
              }`,
              trailing: (
                <StatusBadge {...getStatusMeta(ENTITY_KINDS.CONTRACT, c.status)} />
              ),
            }))}
          />
        </DetailSection>

        <DetailSection title="المشتريات">
          <RelatedList
            emptyLabel="لا توجد مشتريات"
            items={project.purchases.map((p) => ({
              id: p.id,
              href: `/crm/purchases/${p.id}`,
              title: p.title,
              subtitle: `${p.purchaseNumber}${
                p.amount != null ? ` · ${formatCurrency(p.amount, p.currency)}` : ""
              }`,
              trailing: (
                <StatusBadge {...getStatusMeta(ENTITY_KINDS.PURCHASE, p.status)} />
              ),
            }))}
          />
        </DetailSection>
      </div>

      <DetailSection title="الممارسات">
        <RelatedList
          emptyLabel="لا توجد ممارسات مرتبطة"
          items={project.practices.map((pr) => ({
            id: pr.id,
            href: `/crm/practices/${pr.id}`,
            title: pr.title,
            subtitle: pr.referenceNumber,
            trailing: (
              <StatusBadge {...getStatusMeta(ENTITY_KINDS.PRACTICE, pr.status)} />
            ),
          }))}
        />
      </DetailSection>

      <ApprovalSection
        subjectType={ENTITY_TYPES.PROJECT}
        subjectId={project.id}
      />

      <TaskSection
        entityType={ENTITY_TYPES.PROJECT}
        entityId={project.id}
        entityTitle={project.name}
      />
    </div>
  );
}
