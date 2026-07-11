import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getPurchase } from "@/lib/crm/services/purchase";
import { NotFoundError } from "@/lib/errors";
import { getStatusMeta, ENTITY_KINDS } from "@/lib/crm/constants";
import { ENTITY_TYPES } from "@/lib/constants";
import { StatusBadge } from "@/components/crm/status-badge";
import {
  DetailSection,
  InfoGrid,
  DocumentsFolderButton,
} from "@/components/crm/detail";
import { EntityTimeline } from "@/components/crm/entity-timeline";
import { ApprovalSection } from "@/components/approvals/approval-section";
import { TaskSection } from "@/components/tasks/task-section";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PurchaseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();

  let purchase;
  try {
    purchase = await getPurchase(params.id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const status = getStatusMeta(ENTITY_KINDS.PURCHASE, purchase.status);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/crm/purchases"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
          العودة إلى المشتريات
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-brand-900">
                {purchase.title}
              </h1>
              <p className="text-sm text-slate-400">{purchase.purchaseNumber}</p>
            </div>
            <StatusBadge label={status.label} tone={status.tone} />
          </div>
          <DocumentsFolderButton folderId={purchase.folder?.id ?? null} />
        </div>
      </div>

      <DetailSection title="بيانات أمر الشراء">
        <InfoGrid
          items={[
            {
              label: "القيمة",
              value: formatCurrency(purchase.amount, purchase.currency),
            },
            {
              label: "الشركة (المورّد)",
              value: purchase.company ? (
                <Link
                  href={`/crm/companies/${purchase.company.id}`}
                  className="text-brand-600 hover:underline"
                >
                  {purchase.company.name}
                </Link>
              ) : null,
            },
            {
              label: "المشروع",
              value: purchase.project ? (
                <Link
                  href={`/crm/projects/${purchase.project.id}`}
                  className="text-brand-600 hover:underline"
                >
                  {purchase.project.name}
                </Link>
              ) : null,
            },
            {
              label: "العقد",
              value: purchase.contract ? (
                <Link
                  href={`/crm/contracts/${purchase.contract.id}`}
                  className="text-brand-600 hover:underline"
                >
                  {`${purchase.contract.contractNumber} — ${purchase.contract.title}`}
                </Link>
              ) : null,
            },
            {
              label: "تاريخ الطلب",
              value: purchase.requestDate ? formatDate(purchase.requestDate) : null,
            },
            {
              label: "تاريخ التسليم",
              value: purchase.deliveryDate
                ? formatDate(purchase.deliveryDate)
                : null,
            },
            { label: "أضيف بواسطة", value: purchase.createdBy.name },
            { label: "الوصف", value: purchase.description },
          ]}
        />
      </DetailSection>

      <ApprovalSection
        subjectType={ENTITY_TYPES.PURCHASE}
        subjectId={purchase.id}
      />

      <TaskSection
        entityType={ENTITY_TYPES.PURCHASE}
        entityId={purchase.id}
        entityTitle={purchase.title}
      />

      <EntityTimeline
        entityType={ENTITY_TYPES.PURCHASE}
        entityId={purchase.id}
      />
    </div>
  );
}
