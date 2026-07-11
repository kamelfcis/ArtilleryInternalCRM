"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { Plus, Pencil, Trash2, Eye, AlertCircle, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  EntityFormModal,
  type FormField,
  type ScanConfig,
} from "./entity-form-modal";
import { initialActionState, type ActionState } from "@/lib/action-result";
import { cn } from "@/lib/utils";

type ActionFn = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export interface Column<Row> {
  header: string;
  cell: (row: Row) => ReactNode;
  hideBelow?: "sm" | "md" | "lg" | "xl";
  align?: "start" | "end";
}

interface CrmManagerProps<Row> {
  rows: Row[];
  columns: Column<Row>[];
  getId: (row: Row) => string;
  getName: (row: Row) => string;
  getEditValues: (row: Row) => Record<string, string>;
  detailHref: (row: Row) => string;
  fields: FormField[];
  labelSingular: string;
  createAction: ActionFn;
  updateAction: ActionFn;
  deleteAction: ActionFn;
  canWrite: boolean;
  canDelete: boolean;
  emptyIcon: LucideIcon;
  /** Enables scan-to-fill on the create dialog (contracts / purchases). */
  scan?: ScanConfig;
  /** Extra note shown in the delete confirmation dialog. */
  deleteNote?: string;
}

const HIDE_CLASS: Record<string, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

export function CrmManager<Row>({
  rows,
  columns,
  getId,
  getName,
  getEditValues,
  detailHref,
  fields,
  labelSingular,
  createAction,
  updateAction,
  deleteAction,
  canWrite,
  canDelete,
  emptyIcon,
  scan,
  deleteNote,
}: CrmManagerProps<Row>) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {`إضافة ${labelSingular}`}
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={`لا توجد سجلات`}
          description={
            canWrite
              ? `ابدأ بإضافة أول ${labelSingular}.`
              : "لا توجد بيانات لعرضها."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-right text-xs font-medium text-slate-500">
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      className={cn(
                        "px-4 py-3 font-medium",
                        col.align === "end" && "text-left",
                        col.hideBelow && HIDE_CLASS[col.hideBelow],
                      )}
                    >
                      {col.header}
                    </th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={getId(row)} className="hover:bg-surface-muted/60">
                    {columns.map((col, i) => (
                      <td
                        key={i}
                        className={cn(
                          "px-4 py-3 text-brand-900",
                          col.align === "end" && "text-left",
                          col.hideBelow && HIDE_CLASS[col.hideBelow],
                        )}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={detailHref(row)}
                          className="btn-ghost p-2 text-slate-500 hover:text-brand-700"
                          title="تفاصيل"
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                        </Link>
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => setEditing(row)}
                            className="btn-ghost p-2 text-slate-500 hover:text-brand-700"
                            title="تعديل"
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleting(row)}
                            className="btn-ghost p-2 text-red-500 hover:bg-red-50"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && (
        <EntityFormModal
          open
          onClose={() => setCreating(false)}
          title={`إضافة ${labelSingular}`}
          action={createAction}
          fields={fields}
          scan={scan}
        />
      )}

      {editing && (
        <EntityFormModal
          open
          onClose={() => setEditing(null)}
          title={`تعديل ${labelSingular}`}
          action={updateAction}
          fields={fields}
          recordId={getId(editing)}
          initialValues={getEditValues(editing)}
        />
      )}

      {deleting && (
        <DeleteModal
          onClose={() => setDeleting(null)}
          action={deleteAction}
          id={getId(deleting)}
          name={getName(deleting)}
          labelSingular={labelSingular}
          note={deleteNote}
        />
      )}
    </div>
  );
}

function DeleteModal({
  onClose,
  action,
  id,
  name,
  labelSingular,
  note,
}: {
  onClose: () => void;
  action: ActionFn;
  id: string;
  name: string;
  labelSingular: string;
  note?: string;
}) {
  const [state, formAction] = useFormState(action, initialActionState);

  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(onClose, 500);
      return () => clearTimeout(t);
    }
  }, [state.ok, onClose]);

  return (
    <Modal open onClose={onClose} title={`حذف ${labelSingular}`}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={id} />
        <p className="text-sm text-slate-600">
          هل أنت متأكد من حذف{" "}
          <span className="font-semibold text-brand-900">«{name}»</span>؟
        </p>
        {note && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            {note}
          </p>
        )}
        {!state.ok && state.message && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span>{state.message}</span>
          </div>
        )}
        <div className="flex justify-start gap-2">
          <SubmitButton className="btn-danger" pendingLabel="جارٍ الحذف…">
            حذف
          </SubmitButton>
          <button type="button" onClick={onClose} className="btn-secondary">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
