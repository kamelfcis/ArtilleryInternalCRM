import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getCompany } from "@/lib/crm/services/company";
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
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();

  let company;
  try {
    company = await getCompany(params.id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const status = getStatusMeta(ENTITY_KINDS.COMPANY, company.status);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/crm/companies"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
          العودة إلى الشركات
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-brand-900">{company.name}</h1>
            <StatusBadge label={status.label} tone={status.tone} />
          </div>
          <DocumentsFolderButton folderId={company.folder?.id ?? null} />
        </div>
      </div>

      <DetailSection title="بيانات الشركة">
        <InfoGrid
          items={[
            { label: "السجل التجاري / الرمز", value: company.code },
            { label: "مسؤول التواصل", value: company.contactPerson },
            {
              label: "الهاتف",
              value: company.phone ? <span dir="ltr">{company.phone}</span> : null,
            },
            {
              label: "البريد الإلكتروني",
              value: company.email ? <span dir="ltr">{company.email}</span> : null,
            },
            { label: "العنوان", value: company.address },
            { label: "أضيفت بواسطة", value: company.createdBy.name },
            { label: "ملاحظات", value: company.notes },
          ]}
        />
      </DetailSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <DetailSection title="العقود">
          <RelatedList
            emptyLabel="لا توجد عقود مرتبطة"
            items={company.contracts.map((c) => ({
              id: c.id,
              href: `/crm/contracts/${c.id}`,
              title: c.title,
              subtitle: `${c.contractNumber}${
                c.value != null ? ` · ${formatCurrency(c.value, c.currency)}` : ""
              }`,
              trailing: (
                <StatusBadge
                  {...getStatusMeta(ENTITY_KINDS.CONTRACT, c.status)}
                />
              ),
            }))}
          />
        </DetailSection>

        <DetailSection title="المشتريات">
          <RelatedList
            emptyLabel="لا توجد مشتريات مرتبطة"
            items={company.purchases.map((p) => ({
              id: p.id,
              href: `/crm/purchases/${p.id}`,
              title: p.title,
              subtitle: `${p.purchaseNumber}${
                p.amount != null ? ` · ${formatCurrency(p.amount, p.currency)}` : ""
              }`,
              trailing: (
                <StatusBadge
                  {...getStatusMeta(ENTITY_KINDS.PURCHASE, p.status)}
                />
              ),
            }))}
          />
        </DetailSection>
      </div>

      {company.awardedPractices.length > 0 && (
        <DetailSection title="ممارسات تمت ترسيتها على الشركة">
          <RelatedList
            emptyLabel="لا يوجد"
            items={company.awardedPractices.map((pr) => ({
              id: pr.id,
              href: `/crm/practices/${pr.id}`,
              title: pr.title,
              subtitle: pr.referenceNumber,
              trailing: (
                <StatusBadge
                  {...getStatusMeta(ENTITY_KINDS.PRACTICE, pr.status)}
                />
              ),
            }))}
          />
        </DetailSection>
      )}

      <ApprovalSection
        subjectType={ENTITY_TYPES.COMPANY}
        subjectId={company.id}
      />

      <TaskSection
        entityType={ENTITY_TYPES.COMPANY}
        entityId={company.id}
        entityTitle={company.name}
      />
    </div>
  );
}
