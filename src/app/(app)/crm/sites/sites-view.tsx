"use client";

import { MapPin } from "lucide-react";
import { CrmManager, type Column } from "@/components/crm/crm-manager";
import type { FormField } from "@/components/crm/entity-form-modal";
import { toArabicDigits } from "@/lib/utils";
import { createSiteAction, updateSiteAction, deleteSiteAction } from "./actions";

interface SiteRow {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  address: string | null;
  _count: { projects: number };
}

const FIELDS: FormField[] = [
  { name: "name", label: "اسم الموقع", required: true },
  { name: "code", label: "رمز الموقع" },
  { name: "address", label: "العنوان", full: true },
  { name: "description", label: "الوصف", type: "textarea", full: true },
];

const COLUMNS: Column<SiteRow>[] = [
  {
    header: "الموقع",
    cell: (r) => (
      <div>
        <p className="font-medium text-brand-900">{r.name}</p>
        {r.code && <p className="text-xs text-slate-400">{r.code}</p>}
      </div>
    ),
  },
  { header: "العنوان", cell: (r) => r.address ?? "—", hideBelow: "md" },
  {
    header: "المشروعات",
    cell: (r) => (
      <span className="text-xs text-slate-500">
        {toArabicDigits(String(r._count.projects))} مشروع
      </span>
    ),
    hideBelow: "lg",
  },
];

export function SitesView({
  rows,
  canWrite,
  canDelete,
}: {
  rows: SiteRow[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  return (
    <CrmManager<SiteRow>
      rows={rows}
      columns={COLUMNS}
      fields={FIELDS}
      labelSingular="موقع"
      emptyIcon={MapPin}
      getId={(r) => r.id}
      getName={(r) => r.name}
      detailHref={(r) => `/crm/sites/${r.id}`}
      getEditValues={(r) => ({
        name: r.name,
        code: r.code ?? "",
        address: r.address ?? "",
        description: r.description ?? "",
      })}
      createAction={createSiteAction}
      updateAction={updateSiteAction}
      deleteAction={deleteSiteAction}
      deleteNote="سيتم حذف المشروعات والعقود والممارسات والمشتريات المرتبطة بهذا الموقع أيضاً."
      canWrite={canWrite}
      canDelete={canDelete}
    />
  );
}
