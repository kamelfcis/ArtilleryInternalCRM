import "server-only";
import { prisma } from "@/lib/prisma";
import { emitEvent, EVENT_NAMES } from "@/lib/events";
import {
  ENTITY_TYPES,
  ROLES,
  hasRoleAtLeast,
  type Role,
} from "@/lib/constants";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";
import { subjectMeta } from "@/lib/approvals/subjects";

/**
 * Link review queue (Phase 4.5). The linker (Phase 4.4) only ever proposes
 * SUGGESTED / AUTO `DocumentLink`s; this service is the human side of that
 * contract. It reads the pending suggestions grouped by document (resolving
 * each polymorphic target to a label + title + detail href) and records a
 * reviewer's decision — CONFIRMED or REJECTED — while emitting the matching
 * domain event so the decision lands in the audit trail.
 *
 * Deciding a link never mutates the CRM record and is guarded by RBAC: only
 * MANAGER+ may confirm or reject. Regular users can view the queue.
 */

/** Minimum role allowed to confirm or reject a suggested link. */
export const LINK_REVIEW_MIN_ROLE: Role = ROLES.MANAGER;

export type LinkDecision = "CONFIRM" | "REJECT";

/** One suggested link, resolved for display in the review queue. */
export interface SuggestedLinkItem {
  id: string;
  entityType: string;
  /** Singular Arabic label of the target kind, e.g. "عقد". */
  entityLabel: string;
  /** Current display title of the target record (null if it vanished). */
  targetTitle: string | null;
  /** Detail-page href for the target record. */
  targetHref: string;
  matchedKey: string;
  matchedValue: string;
  method: string;
  confidence: number;
}

/** A document with its outstanding suggested links. */
export interface ReviewGroup {
  documentId: string;
  documentName: string;
  /** In-app viewer/content href for the document. */
  documentHref: string;
  links: SuggestedLinkItem[];
}

/** True when `role` may confirm/reject links. Client-safe. */
export function canReviewLinks(role: Role): boolean {
  return hasRoleAtLeast(role, LINK_REVIEW_MIN_ROLE);
}

/** Build the "label: title" summary used in events/audit for a link's target. */
function targetSummary(entityType: string, title: string | null): string {
  const label = subjectMeta(entityType)?.label ?? entityType;
  return title ? `${label}: ${title}` : label;
}

/**
 * List documents that still have SUGGESTED links awaiting review, newest links
 * first, with every target resolved to its label, current title and href.
 */
export async function listSuggestedLinks(limit = 100): Promise<ReviewGroup[]> {
  const links = await prisma.documentLink.findMany({
    where: { status: "SUGGESTED", document: { deletedAt: null } },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      matchedKey: true,
      matchedValue: true,
      method: true,
      confidence: true,
      documentId: true,
      document: { select: { name: true } },
    },
    orderBy: [{ documentId: "asc" }, { confidence: "desc" }],
    take: limit,
  });

  // Resolve every target title once, in parallel, deduped by (type, id).
  const uniqueTargets = new Map<string, { entityType: string; entityId: string }>();
  for (const l of links) {
    uniqueTargets.set(`${l.entityType} ${l.entityId}`, {
      entityType: l.entityType,
      entityId: l.entityId,
    });
  }
  const titleEntries = await Promise.all(
    [...uniqueTargets.entries()].map(async ([key, t]) => {
      const title = (await subjectMeta(t.entityType)?.fetchTitle(t.entityId)) ?? null;
      return [key, title] as const;
    }),
  );
  const titleByTarget = new Map(titleEntries);

  const groups = new Map<string, ReviewGroup>();
  for (const l of links) {
    let group = groups.get(l.documentId);
    if (!group) {
      group = {
        documentId: l.documentId,
        documentName: l.document.name,
        documentHref: `/api/documents/${l.documentId}/content`,
        links: [],
      };
      groups.set(l.documentId, group);
    }
    const meta = subjectMeta(l.entityType);
    group.links.push({
      id: l.id,
      entityType: l.entityType,
      entityLabel: meta?.label ?? l.entityType,
      targetTitle: titleByTarget.get(`${l.entityType} ${l.entityId}`) ?? null,
      targetHref: meta?.href(l.entityId) ?? "#",
      matchedKey: l.matchedKey,
      matchedValue: l.matchedValue,
      method: l.method,
      confidence: l.confidence,
    });
  }

  return [...groups.values()];
}

/** Count of links still awaiting review (for badges / dashboards). */
export function countSuggestedLinks(): Promise<number> {
  return prisma.documentLink.count({
    where: { status: "SUGGESTED", document: { deletedAt: null } },
  });
}

export interface DecideLinkInput {
  linkId: string;
  decision: LinkDecision;
  actor: { id: string; role: Role };
}

/**
 * Record a reviewer's decision on a suggested link. MANAGER+ only. Idempotent:
 * a link already in the requested terminal state is a no-op; a link already
 * decided the *other* way is a conflict (surfaced to the reviewer, never
 * silently overwritten). Emits the matching domain event on a real transition.
 */
export async function decideLink(input: DecideLinkInput): Promise<void> {
  const { linkId, decision, actor } = input;

  if (!canReviewLinks(actor.role)) {
    throw new ForbiddenError("لا تملك صلاحية مراجعة روابط الوثائق");
  }

  const link = await prisma.documentLink.findUnique({
    where: { id: linkId },
    select: {
      id: true,
      status: true,
      entityType: true,
      entityId: true,
      documentId: true,
      document: { select: { name: true } },
    },
  });
  if (!link) throw new NotFoundError("الرابط غير موجود");

  const targetStatus = decision === "CONFIRM" ? "CONFIRMED" : "REJECTED";

  // Idempotent: already in the requested state → nothing to do.
  if (link.status === targetStatus) return;
  // Already decided the other way → refuse rather than overwrite a human call.
  if (link.status !== "SUGGESTED") {
    throw new ConflictError("تمت مراجعة هذا الرابط بالفعل");
  }

  await prisma.documentLink.update({
    where: { id: linkId },
    data: { status: targetStatus },
  });

  const title = (await subjectMeta(link.entityType)?.fetchTitle(link.entityId)) ?? null;
  await emitEvent({
    actorId: actor.id,
    eventName:
      decision === "CONFIRM"
        ? EVENT_NAMES.DocumentLinkConfirmed
        : EVENT_NAMES.DocumentLinkRejected,
    entityType: ENTITY_TYPES.DOCUMENT,
    entityId: link.documentId,
    metadata: {
      name: link.document.name,
      target: targetSummary(link.entityType, title),
      entityType: link.entityType,
      entityId: link.entityId,
    },
  });
}
