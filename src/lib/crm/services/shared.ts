import "server-only";
import type { Prisma } from "@prisma/client";
import { emitEvent, EVENT_NAMES } from "@/lib/events";
import type { EntityKind } from "@/lib/crm/constants";

/** Convert a Prisma Decimal (or null) to a plain number for serialization. */
export function decimalToNumber(
  value: Prisma.Decimal | null | undefined,
): number | null {
  if (value == null) return null;
  return Number(value);
}

/** Standard list query parameters shared by every entity list endpoint. */
export interface ListParams {
  search?: string;
  status?: string;
  skip?: number;
  take?: number;
}

export const DEFAULT_PAGE_SIZE = 20;

/** Normalize/clamp pagination parameters. */
export function paginate(params: ListParams) {
  const take = Math.min(Math.max(params.take ?? DEFAULT_PAGE_SIZE, 1), 100);
  const skip = Math.max(params.skip ?? 0, 0);
  return { take, skip };
}

const CRM_EVENT_NAME = {
  create: EVENT_NAMES.CrmRecordCreated,
  update: EVENT_NAMES.CrmRecordUpdated,
  delete: EVENT_NAMES.CrmRecordDeleted,
} as const;

/**
 * Emit the CRM domain event for a create/update/delete operation. The audit
 * trail is written by the audit subscriber (see src/lib/events); notifications
 * and workflow triggers can subscribe to the same events without touching the
 * services here. The record's display name travels in `metadata.name`.
 */
export function emitCrmEvent(
  op: "create" | "update" | "delete",
  kind: EntityKind,
  entityId: string,
  name: string,
  actorId: string,
  metadata?: Record<string, unknown>,
) {
  return emitEvent({
    eventName: CRM_EVENT_NAME[op],
    actorId,
    entityType: kind,
    entityId,
    metadata: { name, ...metadata },
  });
}

/**
 * @deprecated Historical name kept for existing call sites. Emits a CRM domain
 * event that the audit subscriber persists to the audit trail. Prefer
 * {@link emitCrmEvent}.
 */
export const auditRecord = emitCrmEvent;
