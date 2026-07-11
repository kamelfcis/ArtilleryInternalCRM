"use client";

import { Gavel } from "lucide-react";
import { CrmManager, type Column } from "@/components/crm/crm-manager";
import { StatusBadge } from "@/components/crm/status-badge";
import type { FormField } from "@/components/crm/entity-form-modal";
import {
  STATUS_OPTIONS,
  getStatusMeta,
  ENTITY_KINDS,
} from "@/lib/crm/constants";
import type { Option } from "@/lib/crm/options";
import { formatCurrency, toDateInputValue } from "@/lib/utils";
import {
  createPracticeAction,
  updatePracticeAction,
  deletePracticeAction,
} from "./actions";

interface PracticeRow {
  id: string;
  referenceNumber: string;
  title: string;
  description: string | null;
  status: string;
  estimatedValue: number | null;
  openDate: string | Date | null;
  closeDate: string | Date | null;
  projectId: string | null;
  awardedCompanyId: string | null;
  project: { id: string; name: string } | null;
  awardedCompany: { id: string; name: string } | null;
}

function buildFields(projects: Option[], companies: Option[]): FormField[] {
  return [
    { name: "referenceNumber", label: "رقم الممارسة", required: true },
    { name: "title", label: "عنوان الممارسة", required: true, full: true },
    {
      name: "status",
      label: "الحالة",
      type: "select",
      required: true,
      options: [...STATUS_OPTIONS.PRACTICE],
    },
    { name: "estimatedValue", label: "القيمة التقديرية", type: "money" },
    { name: "projectId", label: "المشروع", type: "select", options: projects },
    {
      name: "awardedCompanyId",
      label: "الشركة الفائزة",
      type: "select",
      options: companies,
    },
    { name: "openDate", label: "تاريخ الطرح", type: "date" },
    { name: "closeDate", label: "تاريخ الإقفال", type: "date" },
    { name: "description", label: "الوصف", type: "textarea", full: true },
  ];
}

const COLUMNS: Column<PracticeRow>[] = [
  {
    header: "الممارسة",
    cell: (r) => (
      <div>
        <p className="font-medium text-brand-900">{r.title}</p>
        <p className="text-xs text-slate-400">{r.referenceNumber}</p>
      </div>
    ),
  },
  { header: "المشروع", cell: (r) => r.project?.name ?? "—", hideBelow: "lg" },
  {
    header: "القيمة التقديرية",
    cell: (r) => (r.estimatedValue != null ? formatCurrency(r.estimatedValue) : "—"),
    hideBelow: "xl",
  },
  {
    header: "الحالة",
    cell: (r) => <StatusBadge {...getStatusMeta(ENTITY_KINDS.PRACTICE, r.status)} />,
  },
];

export function PracticesView({
  rows,
  projectOptions,
  companyOptions,
  canWrite,
  canDelete,
}: {
  rows: PracticeRow[];
  projectOptions: Option[];
  companyOptions: Option[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  return (
    <CrmManager<PracticeRow>
      rows={rows}
      columns={COLUMNS}
      fields={buildFields(projectOptions, companyOptions)}
      labelSingular="ممارسة"
      emptyIcon={Gavel}
      getId={(r) => r.id}
      getName={(r) => r.title}
      detailHref={(r) => `/crm/practices/${r.id}`}
      getEditValues={(r) => ({
        referenceNumber: r.referenceNumber,
        title: r.title,
        status: r.status,
        estimatedValue: r.estimatedValue != null ? String(r.estimatedValue) : "",
        projectId: r.projectId ?? "",
        awardedCompanyId: r.awardedCompanyId ?? "",
        openDate: toDateInputValue(r.openDate),
        closeDate: toDateInputValue(r.closeDate),
        description: r.description ?? "",
      })}
      createAction={createPracticeAction}
      updateAction={updatePracticeAction}
      deleteAction={deletePracticeAction}
      deleteNote="سيتم حذف العقود والمشتريات المرتبطة بهذه الممارسة أيضاً."
      canWrite={canWrite}
      canDelete={canDelete}
    />
  );
}
