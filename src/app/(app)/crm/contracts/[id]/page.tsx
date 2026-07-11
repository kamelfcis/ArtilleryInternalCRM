import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getContract } from "@/lib/crm/services/contract";
import { prisma } from "@/lib/prisma";
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
import { EntityTimeline } from "@/components/crm/entity-timeline";
import { ApprovalSection } from "@/components/approvals/approval-section";
import { TaskSection } from "@/components/tasks/task-section";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();

  let contract;
  try {
    contract = await getContract(params.id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  // The contract's site is reached through its project (Contract has no direct
  // site relation). Resolved read-only here without altering the API/service.
  const site = contract.projectId
    ? (
        await prisma.project.findUnique({
          where: { id: contract.projectId },
          select: { site: { select: { id: true, name: true } } },
        })
      )?.site ?? null
    : null;

  const status = getStatusMeta(ENTITY_KINDS.CONTRACT, contract.status);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/crm/contracts"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
          العودة إلى التعاقدات
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-brand-900">
                {contract.title}
              </h1>
              <p className="text-sm text-slate-400">{contract.contractNumber}</p>
            </div>
            <StatusBadge label={status.label} tone={status.tone} />
          </div>
          <DocumentsFolderButton folderId={contract.folder?.id ?? null} />
        </div>
      </div>

      <DetailSection title="بيانات العقد">
        <InfoGrid
          items={[
            {
              label: "القيمة",
              value: formatCurrency(contract.value, contract.currency),
            },
            {
              label: "الشركة (المورّد)",
              value: contract.company ? (
                <Link
                  href={`/crm/companies/${contract.company.id}`}
                  className="text-brand-600 hover:underline"
                >
                  {contract.company.name}
                </Link>
              ) : null,
            },
            {
              label: "المشروع",
              value: contract.project ? (
                <Link
                  href={`/crm/projects/${contract.project.id}`}
                  className="text-brand-600 hover:underline"
                >
                  {contract.project.name}
                </Link>
              ) : null,
            },
            {
              label: "الموقع",
              value: site ? (
                <Link
                  href={`/crm/sites/${site.id}`}
                  className="text-brand-600 hover:underline"
                >
                  {site.name}
                </Link>
              ) : null,
            },
            {
              label: "الممارسة",
              value: contract.practice ? (
                <Link
                  href={`/crm/practices/${contract.practice.id}`}
                  className="text-brand-600 hover:underline"
                >
                  {`${contract.practice.referenceNumber} — ${contract.practice.title}`}
                </Link>
              ) : null,
            },
            {
              label: "تاريخ التوقيع",
              value: contract.signedDate ? formatDate(contract.signedDate) : null,
            },
            {
              label: "تاريخ البدء",
              value: contract.startDate ? formatDate(contract.startDate) : null,
            },
            {
              label: "تاريخ الانتهاء",
              value: contract.endDate ? formatDate(contract.endDate) : null,
            },
            { label: "أضيف بواسطة", value: contract.createdBy.name },
            { label: "الوصف", value: contract.description },
          ]}
        />
      </DetailSection>

      <DetailSection title="المشتريات المرتبطة">
        <RelatedList
          emptyLabel="لا توجد مشتريات مرتبطة"
          items={contract.purchases.map((p) => ({
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

      <ApprovalSection
        subjectType={ENTITY_TYPES.CONTRACT}
        subjectId={contract.id}
      />

      <TaskSection
        entityType={ENTITY_TYPES.CONTRACT}
        entityId={contract.id}
        entityTitle={contract.title}
      />

      <EntityTimeline
        entityType={ENTITY_TYPES.CONTRACT}
        entityId={contract.id}
      />
    </div>
  );
}
