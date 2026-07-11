"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { ApprovalStatusBadge } from "./status-badge";
import { initialActionState } from "@/lib/action-result";
import { runApprovalAction } from "@/app/(app)/approvals/actions";
import { cn } from "@/lib/utils";

interface ActionOption {
  action: string;
  label: string;
  style: "primary" | "secondary" | "danger";
  requiresComment?: boolean;
}

const BTN_CLASS: Record<ActionOption["style"], string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
};

/**
 * Reusable approval action panel. Renders the current status and the actions
 * available to the current user (computed server-side from the state machine),
 * then drives every transition through the single `runApprovalAction` server
 * action. Drop `<ApprovalSection>` onto any entity detail page — this panel has
 * no per-entity logic.
 */
export function ApprovalPanel({
  subjectType,
  subjectId,
  status,
  actions,
}: {
  subjectType: string;
  subjectId: string;
  status: string;
  actions: ActionOption[];
}) {
  const [active, setActive] = useState<ActionOption | null>(null);

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">حالة الاعتماد</span>
        <ApprovalStatusBadge status={status} />
      </div>

      {actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.action}
              type="button"
              onClick={() => setActive(a)}
              className={BTN_CLASS[a.style]}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">
          لا توجد إجراءات متاحة لك في هذه الحالة.
        </p>
      )}

      {active && (
        <ActionModal
          option={active}
          subjectType={subjectType}
          subjectId={subjectId}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

function ActionModal({
  option,
  subjectType,
  subjectId,
  onClose,
}: {
  option: ActionOption;
  subjectType: string;
  subjectId: string;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(runApprovalAction, initialActionState);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(() => {
        onClose();
        router.refresh();
      }, 500);
      return () => clearTimeout(t);
    }
  }, [state.ok, onClose, router]);

  return (
    <Modal open onClose={onClose} title={option.label}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="subjectType" value={subjectType} />
        <input type="hidden" name="subjectId" value={subjectId} />
        <input type="hidden" name="action" value={option.action} />

        <div>
          <label htmlFor="approval-comment" className="field-label">
            {option.requiresComment ? "السبب / الملاحظة" : "ملاحظة (اختياري)"}
            {option.requiresComment && <span className="text-red-500"> *</span>}
          </label>
          <textarea
            id="approval-comment"
            name="comment"
            rows={3}
            required={option.requiresComment}
            className="field-input resize-none"
            placeholder="أضف ملاحظة توضيحية…"
          />
        </div>

        {state.message && (
          <div
            role={state.ok ? "status" : "alert"}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm",
              state.ok
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {state.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{state.message}</span>
          </div>
        )}

        <div className="flex justify-start gap-2 pt-1">
          <SubmitButton className={BTN_CLASS[option.style]} pendingLabel="جارٍ التنفيذ…">
            {option.label}
          </SubmitButton>
          <button type="button" onClick={onClose} className="btn-secondary">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
