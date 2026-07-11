import { StatusBadge } from "@/components/crm/status-badge";
import { APPROVAL_STATUS_META, isApprovalStatus } from "@/lib/approvals/constants";

/** Approval status pill — reuses the shared StatusBadge with approval tones. */
export function ApprovalStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const meta = isApprovalStatus(status)
    ? APPROVAL_STATUS_META[status]
    : { label: status, tone: "neutral" as const };
  return <StatusBadge label={meta.label} tone={meta.tone} className={className} />;
}
