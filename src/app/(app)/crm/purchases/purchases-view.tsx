"use client";

import { ShoppingCart } from "lucide-react";
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
  createPurchaseAction,
  updatePurchaseAction,
  deletePurchaseAction,
} from "./actions";

interface PurchaseRow {
  id: string;
  purchaseNumber: string;
  title: string;
  description: string | null;
  status: string;
  amount: number | null;
  currency: string;
  requestDate: string | Date | null;
  deliveryDate: string | Date | null;
  companyId: string | null;
  projectId: string | null;
  contractId: string | null;
  company: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
}

function buildFields(
  companies: Option[],
  projects: Option[],
  contracts: Option[],
): FormField[] {
  return [
    { name: "purchaseNumber", label: "رقم أمر الشراء", required: true },
    { name: "title", label: "عنوان أمر الشراء", required: true, full: true },
    {
      name: "companyId",
      label: "الشركة (المورّد)",
      type: "select",
      options: companies,
    },
    {
      name: "status",
      label: "الحالة",
      type: "select",
      required: true,
      options: [...STATUS_OPTIONS.PURCHASE],
    },
    { name: "amount", label: "القيمة", type: "money" },
    {
      name: "currency",
      label: "العملة",
      type: "select",
      required: true,
      options: [...CURRENCY_OPTIONS],
    },
    { name: "projectId", label: "المشروع", type: "select", options: projects },
    { name: "contractId", label: "العقد", type: "select", options: contracts },
    { name: "requestDate", label: "تاريخ الطلب", type: "date" },
    { name: "deliveryDate", label: "تاريخ التسليم", type: "date" },
    { name: "description", label: "الوصف", type: "textarea", full: true },
  ];
}

const COLUMNS: Column<PurchaseRow>[] = [
  {
    header: "أمر الشراء",
    cell: (r) => (
      <div>
        <p className="font-medium text-brand-900">{r.title}</p>
        <p className="text-xs text-slate-400">{r.purchaseNumber}</p>
      </div>
    ),
  },
  { header: "الشركة", cell: (r) => r.company?.name ?? "—", hideBelow: "md" },
  {
    header: "القيمة",
    cell: (r) => (r.amount != null ? formatCurrency(r.amount, r.currency) : "—"),
    hideBelow: "lg",
  },
  {
    header: "الحالة",
    cell: (r) => <StatusBadge {...getStatusMeta(ENTITY_KINDS.PURCHASE, r.status)} />,
  },
];

export function PurchasesView({
  rows,
  companyOptions,
  projectOptions,
  contractOptions,
  canWrite,
  canDelete,
}: {
  rows: PurchaseRow[];
  companyOptions: Option[];
  projectOptions: Option[];
  contractOptions: Option[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  return (
    <CrmManager<PurchaseRow>
      rows={rows}
      columns={COLUMNS}
      fields={buildFields(companyOptions, projectOptions, contractOptions)}
      labelSingular="أمر شراء"
      emptyIcon={ShoppingCart}
      getId={(r) => r.id}
      getName={(r) => r.title}
      scan={{ kind: "PURCHASE", endpoint: "/api/crm/scan", label: "مسح ضوئي للفاتورة" }}
      detailHref={(r) => `/crm/purchases/${r.id}`}
      getEditValues={(r) => ({
        purchaseNumber: r.purchaseNumber,
        title: r.title,
        companyId: r.companyId ?? "",
        status: r.status,
        amount: r.amount != null ? String(r.amount) : "",
        currency: r.currency,
        projectId: r.projectId ?? "",
        contractId: r.contractId ?? "",
        requestDate: toDateInputValue(r.requestDate),
        deliveryDate: toDateInputValue(r.deliveryDate),
        description: r.description ?? "",
      })}
      createAction={createPurchaseAction}
      updateAction={updatePurchaseAction}
      deleteAction={deletePurchaseAction}
      canWrite={canWrite}
      canDelete={canDelete}
    />
  );
}
