import { prisma } from "@/lib/prisma";
import {
  AUDIT_ACTION_LABELS,
  type AuditAction,
  type EntityType,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { DetailSection } from "./detail";

/**
 * Read-only audit timeline for a single CRM record. Reads the append-only audit
 * trail (entityType + entityId) that every create/update/delete already writes,
 * surfacing that existing capability on the entity's detail page.
 */
export async function EntityTimeline({
  entityType,
  entityId,
  title = "سجل النشاط",
  take = 20,
}: {
  entityType: EntityType;
  entityId: string;
  title?: string;
  take?: number;
}) {
  const entries = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      action: true,
      summary: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });

  return (
    <DetailSection title={title}>
      {entries.length === 0 ? (
        <p className="py-2 text-sm text-slate-400">لا توجد أنشطة مسجلة</p>
      ) : (
        <ol className="relative space-y-5 border-e border-line pe-5">
          {entries.map((entry) => (
            <li key={entry.id} className="relative">
              <span
                className="absolute -end-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-brand-400 ring-4 ring-white"
                aria-hidden
              />
              <p className="text-sm text-brand-900">
                {entry.summary ??
                  AUDIT_ACTION_LABELS[entry.action as AuditAction] ??
                  entry.action}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {entry.user?.name ?? "النظام"} · {formatDateTime(entry.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </DetailSection>
  );
}
