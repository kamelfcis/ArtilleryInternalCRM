"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X, AlertCircle, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/crm/status-badge";
import { initialActionState } from "@/lib/action-result";
import { decideLinkAction } from "@/app/(app)/links/review/actions";
import type { SuggestedLinkItem } from "@/lib/linking/review-service";
import { cn } from "@/lib/utils";

const METHOD_META: Record<string, { label: string; tone: "success" | "warning" }> = {
  exact: { label: "مطابقة تامة", tone: "success" },
  fuzzy: { label: "مطابقة تقريبية", tone: "warning" },
};

/**
 * One suggested document→CRM link in the review queue: the resolved target,
 * how it was matched, and — for reviewers — confirm/reject controls. Both
 * decisions run through the single `decideLinkAction`; on success the row is
 * revalidated away by a router refresh.
 */
export function ReviewLinkRow({
  item,
  canReview,
}: {
  item: SuggestedLinkItem;
  canReview: boolean;
}) {
  const [state, formAction] = useFormState(decideLinkAction, initialActionState);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const method = METHOD_META[item.method] ?? {
    label: item.method,
    tone: "warning" as const,
  };
  const confidencePct = Math.round(item.confidence * 100);

  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-slate-500">
            {item.entityLabel}
          </span>
          <Link
            href={item.targetHref}
            className="inline-flex items-center gap-1 truncate text-sm font-medium text-brand-900 hover:underline"
          >
            {item.targetTitle ?? "سجل غير معروف"}
            <ExternalLink className="h-3 w-3 shrink-0 text-slate-300" aria-hidden />
          </Link>
        </div>
        <p className="text-xs text-slate-400">
          طابق «{item.matchedValue}» في حقل {item.matchedKey}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge label={method.label} tone={method.tone} />
        <span className="text-xs tabular-nums text-slate-400">{confidencePct}%</span>

        {canReview && (
          <form action={formAction} className="flex items-center gap-1.5">
            <input type="hidden" name="linkId" value={item.id} />
            <DecisionButton
              decision="CONFIRM"
              className="btn-primary h-8 gap-1 px-2.5 text-xs"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              تأكيد
            </DecisionButton>
            <DecisionButton
              decision="REJECT"
              className="btn-secondary h-8 gap-1 px-2.5 text-xs"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              رفض
            </DecisionButton>
          </form>
        )}
      </div>

      {state.message && !state.ok && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:basis-full"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{state.message}</span>
        </div>
      )}
    </div>
  );
}

/** Submit button carrying its own `decision` value, disabled while the form runs. */
function DecisionButton({
  decision,
  className,
  children,
}: {
  decision: "CONFIRM" | "REJECT";
  className?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="decision"
      value={decision}
      disabled={pending}
      aria-busy={pending}
      className={cn("inline-flex items-center", className)}
    >
      {children}
    </button>
  );
}
