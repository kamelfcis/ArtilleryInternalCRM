"use client";

import { FileSignature } from "lucide-react";
import { CrmManager, type Column } from "@/components/crm/crm-manager";
import { StatusBadge } from "@/components/crm/status-badge";
import type { FormField } from "@/components/crm/entity-form-modal";
import {
  STATUS_OPTIONS,
  CURRENCY_OPTIONS,
  getStatusMeta,
  ENTITY_KINDS,
} from "@/lib/crm/constants";
import type { Option } from "@/lib/crm/options";
import { formatCurrency, toDateInputValue } from "@/lib/utils";
import {
  createContractAction,
  updateContractAction,
  deleteContractAction,
} from "./actions";

interface ContractRow {
  id: string;
  contractNumber: string;
  title: string;
  description: string | null;
  status: string;
  value: number | null;
  currency: string;
  signedDate: string | Date | null;
  startDate: string | Date | null;
  endDate: string | Date | null;
  companyId: string;
  projectId: string | null;
  practiceId: string | null;
  company: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
}

function buildFields(
  companies: Option[],
  projects: Option[],
  practices: Option[],
): FormField[] {
  return [
    { name: "contractNumber", label: "رقم العقد", required: true },
    { name: "title", label: "عنوان العقد", required: true, full: true },
    {
      name: "companyId",
      label: "الشركة (المورّد)",
      type: "select",
      required: true,
      options: companies,
    },
    {
      name: "status",
      label: "الحالة",
      type: "select",
      required: true,
      options: [...STATUS_OPTIONS.CONTRACT],
    },
    { name: "value", label: "قيمة العقد", type: "money" },
    {
      name: "currency",
      label: "العملة",
      type: "select",
      required: true,
      options: [...CURRENCY_OPTIONS],
    },
    { name: "projectId", label: "المشروع", type: "select", options: projects },
    { name: "practiceId", label: "الممارسة", type: "select", options: practices },
    { name: "signedDate", label: "تاريخ التوقيع", type: "date" },
    { name: "startDate", label: "تاريخ البدء", type: "date" },
    { name: "endDate", label: "تاريخ الانتهاء", type: "date" },
    { name: "description", label: "الوصف", type: "textarea", full: true },
  ];
}

const COLUMNS: Column<ContractRow>[] = [
  {
    header: "العقد",
    cell: (r) => (
      <div>
        <p className="font-medium text-brand-900">{r.title}</p>
        <p className="text-xs text-slate-400">{r.contractNumber}</p>
      </div>
    ),
  },
  { header: "الشركة", cell: (r) => r.company?.name ?? "—", hideBelow: "md" },
  {
    header: "القيمة",
    cell: (r) => (r.value != null ? formatCurrency(r.value, r.currency) : "—"),
    hideBelow: "lg",
  },
  {
    header: "الحالة",
    cell: (r) => <StatusBadge {...getStatusMeta(ENTITY_KINDS.CONTRACT, r.status)} />,
  },
];

export function ContractsView({
  rows,
  companyOptions,
  projectOptions,
  practiceOptions,
  canWrite,
  canDelete,
}: {
  rows: ContractRow[];
  companyOptions: Option[];
  projectOptions: Option[];
  practiceOptions: Option[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  return (
    <CrmManager<ContractRow>
      rows={rows}
      columns={COLUMNS}
      fields={buildFields(companyOptions, projectOptions, practiceOptions)}
      labelSingular="عقد"
      emptyIcon={FileSignature}
      getId={(r) => r.id}
      getName={(r) => r.title}
      scan={{ kind: "CONTRACT", endpoint: "/api/crm/scan", label: "مسح ضوئي للعقد" }}
      detailHref={(r) => `/crm/contracts/${r.id}`}
      getEditValues={(r) => ({
        contractNumber: r.contractNumber,
        title: r.title,
        companyId: r.companyId,
        status: r.status,
        value: r.value != null ? String(r.value) : "",
        currency: r.currency,
        projectId: r.projectId ?? "",
        practiceId: r.practiceId ?? "",
        signedDate: toDateInputValue(r.signedDate),
        startDate: toDateInputValue(r.startDate),
        endDate: toDateInputValue(r.endDate),
        description: r.description ?? "",
      })}
      createAction={createContractAction}
      updateAction={updateContractAction}
      deleteAction={deleteContractAction}
      deleteNote="سيتم حذف المشتريات المرتبطة بهذا العقد أيضاً."
      canWrite={canWrite}
      canDelete={canDelete}
    />
  );
}
