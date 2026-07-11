"use client";

import { Briefcase } from "lucide-react";
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
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
} from "./actions";

interface ProjectRow {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  budget: number | null;
  siteId: string | null;
  startDate: string | Date | null;
  endDate: string | Date | null;
  site: { id: string; name: string } | null;
}

function buildFields(sites: Option[]): FormField[] {
  return [
    { name: "name", label: "اسم المشروع", required: true },
    { name: "code", label: "الرمز" },
    {
      name: "status",
      label: "الحالة",
      type: "select",
      required: true,
      options: [...STATUS_OPTIONS.PROJECT],
    },
    { name: "siteId", label: "الموقع", type: "select", options: sites },
    { name: "budget", label: "الميزانية", type: "money" },
    { name: "startDate", label: "تاريخ البدء", type: "date" },
    { name: "endDate", label: "تاريخ الانتهاء", type: "date" },
    { name: "description", label: "الوصف", type: "textarea", full: true },
  ];
}

const COLUMNS: Column<ProjectRow>[] = [
  {
    header: "المشروع",
    cell: (r) => (
      <div>
        <p className="font-medium text-brand-900">{r.name}</p>
        {r.code && <p className="text-xs text-slate-400">{r.code}</p>}
      </div>
    ),
  },
  { header: "الموقع", cell: (r) => r.site?.name ?? "—", hideBelow: "md" },
  {
    header: "الميزانية",
    cell: (r) => (r.budget != null ? formatCurrency(r.budget) : "—"),
    hideBelow: "lg",
  },
  {
    header: "الحالة",
    cell: (r) => <StatusBadge {...getStatusMeta(ENTITY_KINDS.PROJECT, r.status)} />,
  },
];

export function ProjectsView({
  rows,
  siteOptions,
  canWrite,
  canDelete,
}: {
  rows: ProjectRow[];
  siteOptions: Option[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  return (
    <CrmManager<ProjectRow>
      rows={rows}
      columns={COLUMNS}
      fields={buildFields(siteOptions)}
      labelSingular="مشروع"
      emptyIcon={Briefcase}
      getId={(r) => r.id}
      getName={(r) => r.name}
      detailHref={(r) => `/crm/projects/${r.id}`}
      getEditValues={(r) => ({
        name: r.name,
        code: r.code ?? "",
        status: r.status,
        siteId: r.siteId ?? "",
        budget: r.budget != null ? String(r.budget) : "",
        startDate: toDateInputValue(r.startDate),
        endDate: toDateInputValue(r.endDate),
        description: r.description ?? "",
      })}
      createAction={createProjectAction}
      updateAction={updateProjectAction}
      deleteAction={deleteProjectAction}
      deleteNote="سيتم حذف العقود والممارسات والمشتريات المرتبطة بهذا المشروع أيضاً."
      canWrite={canWrite}
      canDelete={canDelete}
    />
  );
}
