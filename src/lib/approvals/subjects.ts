import "server-only";
import { prisma } from "@/lib/prisma";
import { ENTITY_TYPES } from "@/lib/constants";

/**
 * Approval subject registry — the one place that maps a polymorphic
 * `subjectType` to how its record is labelled, linked and titled. Adding
 * approvals to a new entity type = adding one entry here; nothing else changes.
 */
export interface SubjectMeta {
  /** Singular Arabic label, e.g. "عقد". */
  label: string;
  /** Detail-page link for a subject id. */
  href: (id: string) => string;
  /** Resolve the subject's current display title (for lists/timelines). */
  fetchTitle: (id: string) => Promise<string | null>;
}

export const APPROVAL_SUBJECTS: Record<string, SubjectMeta> = {
  [ENTITY_TYPES.COMPANY]: {
    label: "شركة",
    href: (id) => `/crm/companies/${id}`,
    fetchTitle: async (id) =>
      (await prisma.company.findUnique({ where: { id }, select: { name: true } }))
        ?.name ?? null,
  },
  [ENTITY_TYPES.CONTRACT]: {
    label: "عقد",
    href: (id) => `/crm/contracts/${id}`,
    fetchTitle: async (id) =>
      (await prisma.contract.findUnique({ where: { id }, select: { title: true } }))
        ?.title ?? null,
  },
  [ENTITY_TYPES.PURCHASE]: {
    label: "أمر شراء",
    href: (id) => `/crm/purchases/${id}`,
    fetchTitle: async (id) =>
      (await prisma.purchase.findUnique({ where: { id }, select: { title: true } }))
        ?.title ?? null,
  },
  [ENTITY_TYPES.PROJECT]: {
    label: "مشروع",
    href: (id) => `/crm/projects/${id}`,
    fetchTitle: async (id) =>
      (await prisma.project.findUnique({ where: { id }, select: { name: true } }))
        ?.name ?? null,
  },
  [ENTITY_TYPES.PRACTICE]: {
    label: "ممارسة",
    href: (id) => `/crm/practices/${id}`,
    fetchTitle: async (id) =>
      (await prisma.practice.findUnique({ where: { id }, select: { title: true } }))
        ?.title ?? null,
  },
  [ENTITY_TYPES.SITE]: {
    label: "موقع",
    href: (id) => `/crm/sites/${id}`,
    fetchTitle: async (id) =>
      (await prisma.site.findUnique({ where: { id }, select: { name: true } }))
        ?.name ?? null,
  },
  [ENTITY_TYPES.DOCUMENT]: {
    label: "وثيقة",
    href: (id) => `/api/documents/${id}/content`,
    fetchTitle: async (id) =>
      (await prisma.document.findUnique({ where: { id }, select: { name: true } }))
        ?.name ?? null,
  },
};

export function subjectMeta(subjectType: string): SubjectMeta | undefined {
  return APPROVAL_SUBJECTS[subjectType];
}
