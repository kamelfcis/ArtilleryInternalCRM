import "server-only";
import { prisma } from "@/lib/prisma";
import {
  ROLE_LABELS,
  ROLES,
  type Role,
} from "@/lib/constants";
import {
  COMPANY_STATUS_META,
  CONTRACT_STATUS_META,
  PRACTICE_STATUS_META,
  PROJECT_STATUS_META,
  PURCHASE_STATUS_META,
  type StatusMeta,
} from "@/lib/crm/constants";
import { TASK_STATUS_META } from "@/lib/tasks/constants";
import { APPROVAL_STATUS_META } from "@/lib/approvals/constants";
import { subjectMeta } from "@/lib/approvals/subjects";
import {
  SEARCH_ENTITY_TYPES,
  type SearchEntityType,
  type SearchStatus,
} from "./types";

/**
 * Search provider registry — the single place a searchable module is declared.
 * Each provider only knows how to LOAD its candidate rows and shape them into a
 * generic `Candidate` (title / subtitle / breadcrumb / status / href / haystack).
 * ALL matching, ranking, Arabic folding, typo tolerance, limiting and grouping
 * live once in the engine (src/lib/search/engine.ts) — no query logic is
 * duplicated. Adding a future module = appending one provider here.
 */

/** A pre-match candidate: display fields + the strings to match against. */
export interface Candidate {
  id: string;
  title: string;
  subtitle: string | null;
  breadcrumb: string[];
  status: SearchStatus | null;
  href: string;
  updatedAt: Date | null;
  /** Every string this row can be matched on (title, codes, notes, …). */
  haystack: string[];
}

export interface SearchProvider {
  entityType: SearchEntityType;
  /** Minimum role to include this provider (RBAC). Default: any signed-in user. */
  minRole?: Role;
  /** Load up to `scanCap` most-recent candidates (bounded scan). */
  load: (scanCap: number) => Promise<Candidate[]>;
}

function toStatus(meta: Record<string, StatusMeta>, key: string): SearchStatus | null {
  const m = meta[key];
  return m ? { label: m.label, tone: m.tone } : null;
}

/** Drop null/empty entries so the haystack is dense. */
function haystack(...values: (string | null | undefined)[]): string[] {
  return values.filter((v): v is string => !!v && v.trim().length > 0);
}

const NOT_DELETED = { deletedAt: null } as const;
const BY_RECENT = { updatedAt: "desc" as const };

// --- CRM providers ---------------------------------------------------------

const companyProvider: SearchProvider = {
  entityType: SEARCH_ENTITY_TYPES.COMPANY,
  async load(scanCap) {
    const rows = await prisma.company.findMany({
      where: NOT_DELETED,
      orderBy: BY_RECENT,
      take: scanCap,
      select: {
        id: true, name: true, code: true, contactPerson: true,
        email: true, phone: true, status: true, updatedAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.name,
      subtitle: r.code,
      breadcrumb: ["الشركات"],
      status: toStatus(COMPANY_STATUS_META, r.status),
      href: `/crm/companies/${r.id}`,
      updatedAt: r.updatedAt,
      haystack: haystack(r.name, r.code, r.contactPerson, r.email, r.phone),
    }));
  },
};

const projectProvider: SearchProvider = {
  entityType: SEARCH_ENTITY_TYPES.PROJECT,
  async load(scanCap) {
    const rows = await prisma.project.findMany({
      where: NOT_DELETED,
      orderBy: BY_RECENT,
      take: scanCap,
      select: {
        id: true, name: true, code: true, description: true, status: true,
        updatedAt: true, site: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.name,
      subtitle: r.code,
      breadcrumb: r.site ? ["المشروعات", r.site.name] : ["المشروعات"],
      status: toStatus(PROJECT_STATUS_META, r.status),
      href: `/crm/projects/${r.id}`,
      updatedAt: r.updatedAt,
      haystack: haystack(r.name, r.code, r.description),
    }));
  },
};

const siteProvider: SearchProvider = {
  entityType: SEARCH_ENTITY_TYPES.SITE,
  async load(scanCap) {
    const rows = await prisma.site.findMany({
      where: NOT_DELETED,
      orderBy: BY_RECENT,
      take: scanCap,
      select: {
        id: true, name: true, code: true, address: true,
        description: true, updatedAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.name,
      subtitle: r.code,
      breadcrumb: ["المواقع"],
      status: null,
      href: `/crm/sites/${r.id}`,
      updatedAt: r.updatedAt,
      haystack: haystack(r.name, r.code, r.address, r.description),
    }));
  },
};

const practiceProvider: SearchProvider = {
  entityType: SEARCH_ENTITY_TYPES.PRACTICE,
  async load(scanCap) {
    const rows = await prisma.practice.findMany({
      where: NOT_DELETED,
      orderBy: BY_RECENT,
      take: scanCap,
      select: {
        id: true, title: true, referenceNumber: true, description: true,
        status: true, updatedAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: r.referenceNumber,
      breadcrumb: ["الممارسات"],
      status: toStatus(PRACTICE_STATUS_META, r.status),
      href: `/crm/practices/${r.id}`,
      updatedAt: r.updatedAt,
      haystack: haystack(r.title, r.referenceNumber, r.description),
    }));
  },
};

const contractProvider: SearchProvider = {
  entityType: SEARCH_ENTITY_TYPES.CONTRACT,
  async load(scanCap) {
    const rows = await prisma.contract.findMany({
      where: NOT_DELETED,
      orderBy: BY_RECENT,
      take: scanCap,
      select: {
        id: true, title: true, contractNumber: true, description: true,
        status: true, updatedAt: true, company: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: r.contractNumber,
      breadcrumb: r.company ? ["التعاقدات", r.company.name] : ["التعاقدات"],
      status: toStatus(CONTRACT_STATUS_META, r.status),
      href: `/crm/contracts/${r.id}`,
      updatedAt: r.updatedAt,
      haystack: haystack(r.title, r.contractNumber, r.description, r.company?.name),
    }));
  },
};

const purchaseProvider: SearchProvider = {
  entityType: SEARCH_ENTITY_TYPES.PURCHASE,
  async load(scanCap) {
    const rows = await prisma.purchase.findMany({
      where: NOT_DELETED,
      orderBy: BY_RECENT,
      take: scanCap,
      select: {
        id: true, title: true, purchaseNumber: true, description: true,
        status: true, updatedAt: true, company: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: r.purchaseNumber,
      breadcrumb: r.company ? ["المشتريات", r.company.name] : ["المشتريات"],
      status: toStatus(PURCHASE_STATUS_META, r.status),
      href: `/crm/purchases/${r.id}`,
      updatedAt: r.updatedAt,
      haystack: haystack(r.title, r.purchaseNumber, r.description, r.company?.name),
    }));
  },
};

// --- Documents -------------------------------------------------------------

const documentProvider: SearchProvider = {
  entityType: SEARCH_ENTITY_TYPES.DOCUMENT,
  async load(scanCap) {
    const rows = await prisma.document.findMany({
      where: NOT_DELETED,
      orderBy: BY_RECENT,
      take: scanCap,
      select: {
        id: true, name: true, originalName: true, extension: true,
        folderId: true, updatedAt: true, folder: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.name,
      subtitle: r.extension ? r.extension.toUpperCase() : null,
      breadcrumb: r.folder ? ["المستندات", r.folder.name] : ["المستندات"],
      status: null,
      href: `/folders/${r.folderId}`,
      updatedAt: r.updatedAt,
      haystack: haystack(r.name, r.originalName),
    }));
  },
};

// --- Tasks -----------------------------------------------------------------

const taskProvider: SearchProvider = {
  entityType: SEARCH_ENTITY_TYPES.TASK,
  async load(scanCap) {
    const rows = await prisma.task.findMany({
      orderBy: BY_RECENT,
      take: scanCap,
      select: {
        id: true, title: true, notes: true, status: true, entityType: true,
        entityId: true, entityTitle: true, updatedAt: true,
      },
    });
    return rows.map((r) => {
      const meta = subjectMeta(r.entityType);
      const label = meta?.label ?? r.entityType;
      return {
        id: r.id,
        title: r.title,
        subtitle: null,
        breadcrumb: r.entityTitle ? ["المهام", `${label}: ${r.entityTitle}`] : ["المهام"],
        status: toStatus(TASK_STATUS_META, r.status),
        href: meta ? meta.href(r.entityId) : "/tasks",
        updatedAt: r.updatedAt,
        haystack: haystack(r.title, r.notes, r.entityTitle),
      };
    });
  },
};

// --- Approvals -------------------------------------------------------------

const approvalProvider: SearchProvider = {
  entityType: SEARCH_ENTITY_TYPES.APPROVAL,
  async load(scanCap) {
    const rows = await prisma.approval.findMany({
      orderBy: BY_RECENT,
      take: scanCap,
      select: {
        id: true, title: true, status: true, subjectType: true,
        subjectId: true, updatedAt: true,
      },
    });
    return rows.map((r) => {
      const meta = subjectMeta(r.subjectType);
      const label = meta?.label ?? r.subjectType;
      const title = r.title ?? label;
      return {
        id: r.id,
        title,
        subtitle: null,
        breadcrumb: ["الاعتمادات", label],
        status: toStatus(APPROVAL_STATUS_META, r.status),
        href: meta ? meta.href(r.subjectId) : "/approvals",
        updatedAt: r.updatedAt,
        haystack: haystack(title, label),
      };
    });
  },
};

// --- Users (admin-only) ----------------------------------------------------

const userProvider: SearchProvider = {
  entityType: SEARCH_ENTITY_TYPES.USER,
  minRole: ROLES.ADMIN,
  async load(scanCap) {
    const rows = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: BY_RECENT,
      take: scanCap,
      select: {
        id: true, name: true, email: true, jobTitle: true,
        role: true, updatedAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.name,
      subtitle: r.jobTitle,
      breadcrumb: ["المستخدمون"],
      status: { label: ROLE_LABELS[r.role as Role] ?? r.role, tone: "neutral" as const },
      href: "/admin/users",
      updatedAt: r.updatedAt,
      haystack: haystack(r.name, r.email, r.jobTitle),
    }));
  },
};

/** The registry, in a stable order (engine re-groups by SEARCH_ENTITY_META). */
export const SEARCH_PROVIDERS: SearchProvider[] = [
  companyProvider,
  projectProvider,
  siteProvider,
  practiceProvider,
  contractProvider,
  purchaseProvider,
  documentProvider,
  taskProvider,
  approvalProvider,
  userProvider,
];
