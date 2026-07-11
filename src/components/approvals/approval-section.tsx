import { getCurrentUser } from "@/lib/auth/current-user";
import { getApprovalForSubject } from "@/lib/approvals/service";
import {
  APPROVAL_STATUS,
  APPROVAL_STATUS_META,
  availableActions,
  isApprovalStatus,
} from "@/lib/approvals/constants";
import { formatDateTime } from "@/lib/utils";
import { DetailSection } from "@/components/crm/detail";
import { ApprovalPanel } from "./approval-panel";

/**
 * Server wrapper that mounts the reusable approval workflow onto an entity
 * detail page. It loads the current approval (if any), computes the actions the
 * signed-in user may take from the state machine, and renders the client panel
 * plus the immutable transition timeline. Drop it on any subject detail page:
 *
 *   <ApprovalSection subjectType={ENTITY_TYPES.CONTRACT} subjectId={id} />
 *
 * No approval row exists until the first action, so an untouched subject shows
 * DRAFT with only the "submit" action (which auto-creates the record).
 */
export async function ApprovalSection({
  subjectType,
  subjectId,
}: {
  subjectType: string;
  subjectId: string;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const approval = await getApprovalForSubject(subjectType, subjectId);
  const status =
    approval && isApprovalStatus(approval.status)
      ? approval.status
      : APPROVAL_STATUS.DRAFT;

  const actions = availableActions(status, user.role).map((a) => ({
    action: a.action,
    label: a.label,
    style: a.style,
    requiresComment: a.requiresComment,
  }));

  const transitions = approval?.transitions ?? [];

  return (
    <DetailSection title="الاعتماد">
      <ApprovalPanel
        subjectType={subjectType}
        subjectId={subjectId}
        status={status}
        actions={actions}
      />

      {transitions.length > 0 && (
        <div className="mt-5 border-t border-line pt-5">
          <h3 className="mb-3 text-xs font-semibold text-slate-500">
            سجل الاعتماد
          </h3>
          <ol className="relative space-y-4 border-e border-line pe-5">
            {transitions.map((t) => {
              const meta = isApprovalStatus(t.toStatus)
                ? APPROVAL_STATUS_META[t.toStatus]
                : null;
              return (
                <li key={t.id} className="relative">
                  <span
                    className="absolute -end-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-brand-400 ring-4 ring-white"
                    aria-hidden
                  />
                  <p className="text-sm text-brand-900">
                    {meta ? meta.label : t.toStatus}
                  </p>
                  {t.comment && (
                    <p className="mt-0.5 text-xs text-slate-500">{t.comment}</p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {t.actor.name} · {formatDateTime(t.createdAt)}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </DetailSection>
  );
}
