"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TaskFormModal } from "./task-form-modal";
import type { AssignableUser } from "@/lib/tasks/service";

/**
 * "New task" button scoped to a single CRM entity — used inside an entity's
 * detail-page task section. Opens the shared TaskFormModal with the subject
 * pre-bound (no entity picker), so managers assign work in one click.
 */
export function EntityTaskCreate({
  entityType,
  entityId,
  entityLabel,
  entityTitle,
  users,
}: {
  entityType: string;
  entityId: string;
  entityLabel: string;
  entityTitle: string;
  users: AssignableUser[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary !px-2.5 !py-1.5 text-xs"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        مهمة جديدة
      </button>

      {open && (
        <TaskFormModal
          open
          mode="create"
          users={users}
          fixedSubject={{
            entityType,
            entityId,
            label: `${entityLabel}: ${entityTitle}`,
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
