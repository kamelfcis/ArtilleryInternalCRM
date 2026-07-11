import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getPractice } from "@/lib/crm/services/practice";
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

export default async function PracticeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();

  let practice;
  try {
    practice = await getPractice(params.id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const status = getStatusMeta(ENTITY_KINDS.PRACTICE, practice.status);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/crm/practices"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
          العودة إلى الممارسات
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-brand-900">
                {practice.title}
              </h1>
              <p className="text-sm text-slate-400">{practice.referenceNumber}</p>
            </div>
            <StatusBadge label={status.label} tone={status.tone} />
          </div>
          <DocumentsFolderButton folderId={practice.folder?.id ?? null} />
        </div>
      </div>

      <DetailSection title="بيانات الممارسة">
        <InfoGrid
          items={[
            { label: "القيمة التقديرية", value: formatCurrency(practice.estimatedValue) },
            {
              label: "المشروع",
              value: practice.project ? (
                <Link
                  href={`/crm/projects/${practice.project.id}`}
                  className="text-brand-600 hover:underline"
                >
                  {practice.project.name}
                </Link>
              ) : null,
            },
            {
              label: "الشركة الفائزة",
              value: practice.awardedCompany ? (
                <Link
                  href={`/crm/companies/${practice.awardedCompany.id}`}
                  className="text-brand-600 hover:underline"
                >
                  {practice.awardedCompany.name}
                </Link>
              ) : null,
            },
            {
              label: "تاريخ الطرح",
              value: practice.openDate ? formatDate(practice.openDate) : null,
            },
            {
              label: "تاريخ الإقفال",
              value: practice.closeDate ? formatDate(practice.closeDate) : null,
            },
            { label: "أضيفت بواسطة", value: practice.createdBy.name },
            { label: "الوصف", value: practice.description },
          ]}
        />
      </DetailSection>

      <DetailSection title="العقود الناتجة">
        <RelatedList
          emptyLabel="لا توجد عقود مرتبطة"
          items={practice.contracts.map((c) => ({
            id: c.id,
            href: `/crm/contracts/${c.id}`,
            title: c.title,
            subtitle: `${c.contractNumber}${c.company ? ` · ${c.company.name}` : ""}`,
            trailing: (
              <StatusBadge {...getStatusMeta(ENTITY_KINDS.CONTRACT, c.status)} />
            ),
          }))}
        />
      </DetailSection>

      <ApprovalSection
        subjectType={ENTITY_TYPES.PRACTICE}
        subjectId={practice.id}
      />

      <TaskSection
        entityType={ENTITY_TYPES.PRACTICE}
        entityId={practice.id}
        entityTitle={practice.title}
      />
    </div>
  );
}
