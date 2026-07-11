"use client";

import { Building2 } from "lucide-react";
import { CrmManager, type Column } from "@/components/crm/crm-manager";
import { StatusBadge } from "@/components/crm/status-badge";
import type { FormField } from "@/components/crm/entity-form-modal";
import {
  STATUS_OPTIONS,
  getStatusMeta,
  ENTITY_KINDS,
} from "@/lib/crm/constants";
import { toArabicDigits } from "@/lib/utils";
import {
  createCompanyAction,
  updateCompanyAction,
  deleteCompanyAction,
} from "./actions";

interface CompanyRow {
  id: string;
  name: string;
  code: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  _count: { contracts: number; purchases: number };
}

const FIELDS: FormField[] = [
  { name: "name", label: "اسم الشركة", required: true },
  { name: "code", label: "السجل التجاري / الرمز" },
  {
    name: "status",
    label: "الحالة",
    type: "select",
    required: true,
    options: [...STATUS_OPTIONS.COMPANY],
  },
  { name: "contactPerson", label: "مسؤول التواصل" },
  { name: "phone", label: "الهاتف", type: "tel", dir: "ltr" },
  { name: "email", label: "البريد الإلكتروني", type: "email", dir: "ltr" },
  { name: "address", label: "العنوان", full: true },
  { name: "notes", label: "ملاحظات", type: "textarea", full: true },
];

const COLUMNS: Column<CompanyRow>[] = [
  {
    header: "الشركة",
    cell: (r) => (
      <div>
        <p className="font-medium text-brand-900">{r.name}</p>
        {r.code && <p className="text-xs text-slate-400">{r.code}</p>}
      </div>
    ),
  },
  { header: "مسؤول التواصل", cell: (r) => r.contactPerson ?? "—", hideBelow: "md" },
  {
    header: "الهاتف",
    cell: (r) => (r.phone ? <span dir="ltr">{r.phone}</span> : "—"),
    hideBelow: "lg",
  },
  {
    header: "الارتباطات",
    cell: (r) => (
      <span className="text-xs text-slate-500">
        {toArabicDigits(String(r._count.contracts))} عقد ·{" "}
        {toArabicDigits(String(r._count.purchases))} شراء
      </span>
    ),
    hideBelow: "xl",
  },
  {
    header: "الحالة",
    cell: (r) => {
      const meta = getStatusMeta(ENTITY_KINDS.COMPANY, r.status);
      return <StatusBadge label={meta.label} tone={meta.tone} />;
    },
  },
];

export function CompaniesView({
  rows,
  canWrite,
  canDelete,
}: {
  rows: CompanyRow[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  return (
    <CrmManager<CompanyRow>
      rows={rows}
      columns={COLUMNS}
      fields={FIELDS}
      labelSingular="شركة"
      emptyIcon={Building2}
      getId={(r) => r.id}
      getName={(r) => r.name}
      detailHref={(r) => `/crm/companies/${r.id}`}
      getEditValues={(r) => ({
        name: r.name,
        code: r.code ?? "",
        status: r.status,
        contactPerson: r.contactPerson ?? "",
        phone: r.phone ?? "",
        email: r.email ?? "",
        address: r.address ?? "",
        notes: r.notes ?? "",
      })}
      createAction={createCompanyAction}
      updateAction={updateCompanyAction}
      deleteAction={deleteCompanyAction}
      deleteNote="سيتم حذف العقود والممارسات والمشتريات المرتبطة بهذه الشركة أيضاً."
      canWrite={canWrite}
      canDelete={canDelete}
    />
  );
}
