"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";

/**
 * Permanent-delete button guarded by a confirmation modal. The destructive
 * action is irreversible, so the user must explicitly confirm.
 */
export function PurgeButton({
  id,
  action,
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        حذف نهائي
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="حذف نهائي">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            سيتم حذف هذه الوثيقة وكل إصداراتها نهائيًا من النظام ووحدة التخزين.
            لا يمكن التراجع عن هذا الإجراء.
          </p>
          <div className="flex justify-start gap-2">
            <form action={action}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" className="btn-danger">
                تأكيد الحذف النهائي
              </button>
            </form>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
