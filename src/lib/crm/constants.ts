/**
 * CRM domain metadata: the registry of business-entity kinds and their
 * constrained status values with Arabic labels. This is the single source of
 * truth for entity labels, routes, and the root folder each entity's documents
 * live under (preserving the familiar folder navigation).
 */

export const ENTITY_KINDS = {
  COMPANY: "COMPANY",
  CONTRACT: "CONTRACT",
  PRACTICE: "PRACTICE",
  PROJECT: "PROJECT",
  SITE: "SITE",
  PURCHASE: "PURCHASE",
} as const;

export type EntityKind = (typeof ENTITY_KINDS)[keyof typeof ENTITY_KINDS];

export interface EntityKindMeta {
  kind: EntityKind;
  /** URL segment under /crm, e.g. "companies". */
  route: string;
  labelSingular: string;
  labelPlural: string;
  /** Name of the top-level system folder that hosts this entity's documents. */
  rootFolderName: string;
  /** UI accent color (hex). */
  color: string;
}

export const ENTITY_KIND_META: Record<EntityKind, EntityKindMeta> = {
  COMPANY: {
    kind: "COMPANY",
    route: "companies",
    labelSingular: "شركة",
    labelPlural: "الشركات",
    rootFolderName: "الشركات",
    color: "#8a5a1c",
  },
  CONTRACT: {
    kind: "CONTRACT",
    route: "contracts",
    labelSingular: "عقد",
    labelPlural: "التعاقدات",
    rootFolderName: "التعاقدات",
    color: "#1c7d5a",
  },
  PRACTICE: {
    kind: "PRACTICE",
    route: "practices",
    labelSingular: "ممارسة",
    labelPlural: "الممارسات",
    rootFolderName: "الممارسات",
    color: "#2f66b5",
  },
  PROJECT: {
    kind: "PROJECT",
    route: "projects",
    labelSingular: "مشروع",
    labelPlural: "المشروعات",
    rootFolderName: "المشروعات",
    color: "#b5912f",
  },
  SITE: {
    kind: "SITE",
    route: "sites",
    labelSingular: "موقع",
    labelPlural: "المواقع",
    rootFolderName: "المواقع",
    color: "#2f8fb5",
  },
  PURCHASE: {
    kind: "PURCHASE",
    route: "purchases",
    labelSingular: "أمر شراء",
    labelPlural: "المشتريات",
    rootFolderName: "المشتريات",
    color: "#7a2fb5",
  },
};

export const ENTITY_KIND_ORDER: EntityKind[] = [
  ENTITY_KINDS.COMPANY,
  ENTITY_KINDS.PRACTICE,
  ENTITY_KINDS.CONTRACT,
  ENTITY_KINDS.PROJECT,
  ENTITY_KINDS.SITE,
  ENTITY_KINDS.PURCHASE,
];

// --- Status catalogues -----------------------------------------------------

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface StatusMeta {
  label: string;
  tone: StatusTone;
}

export const COMPANY_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  BLACKLISTED: "BLACKLISTED",
} as const;

export const COMPANY_STATUS_META: Record<string, StatusMeta> = {
  ACTIVE: { label: "نشطة", tone: "success" },
  INACTIVE: { label: "غير نشطة", tone: "neutral" },
  BLACKLISTED: { label: "محظورة", tone: "danger" },
};

export const PROJECT_STATUS = {
  PLANNED: "PLANNED",
  ACTIVE: "ACTIVE",
  ON_HOLD: "ON_HOLD",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export const PROJECT_STATUS_META: Record<string, StatusMeta> = {
  PLANNED: { label: "مخطط", tone: "neutral" },
  ACTIVE: { label: "قيد التنفيذ", tone: "info" },
  ON_HOLD: { label: "متوقف مؤقتًا", tone: "warning" },
  COMPLETED: { label: "مكتمل", tone: "success" },
  CANCELLED: { label: "ملغى", tone: "danger" },
};

export const PRACTICE_STATUS = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  UNDER_REVIEW: "UNDER_REVIEW",
  AWARDED: "AWARDED",
  CANCELLED: "CANCELLED",
} as const;

export const PRACTICE_STATUS_META: Record<string, StatusMeta> = {
  DRAFT: { label: "مسودة", tone: "neutral" },
  OPEN: { label: "مطروحة", tone: "info" },
  UNDER_REVIEW: { label: "تحت الدراسة", tone: "warning" },
  AWARDED: { label: "تمت الترسية", tone: "success" },
  CANCELLED: { label: "ملغاة", tone: "danger" },
};

export const CONTRACT_STATUS = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  COMPLETED: "COMPLETED",
  TERMINATED: "TERMINATED",
} as const;

export const CONTRACT_STATUS_META: Record<string, StatusMeta> = {
  DRAFT: { label: "مسودة", tone: "neutral" },
  ACTIVE: { label: "ساري", tone: "success" },
  SUSPENDED: { label: "موقوف", tone: "warning" },
  COMPLETED: { label: "منتهٍ", tone: "info" },
  TERMINATED: { label: "مفسوخ", tone: "danger" },
};

export const PURCHASE_STATUS = {
  REQUESTED: "REQUESTED",
  APPROVED: "APPROVED",
  ORDERED: "ORDERED",
  RECEIVED: "RECEIVED",
  CANCELLED: "CANCELLED",
} as const;

export const PURCHASE_STATUS_META: Record<string, StatusMeta> = {
  REQUESTED: { label: "مطلوب", tone: "neutral" },
  APPROVED: { label: "معتمد", tone: "info" },
  ORDERED: { label: "تم الطلب", tone: "warning" },
  RECEIVED: { label: "تم الاستلام", tone: "success" },
  CANCELLED: { label: "ملغى", tone: "danger" },
};

/** Currencies offered across contract/purchase money forms. */
export const CURRENCY_OPTIONS = [
  { value: "EGP", label: "جنيه مصري" },
  { value: "USD", label: "دولار أمريكي" },
  { value: "EUR", label: "يورو" },
  { value: "SAR", label: "ريال سعودي" },
] as const;

/** Ordered status option lists for select inputs. */
export const STATUS_OPTIONS = {
  COMPANY: Object.entries(COMPANY_STATUS_META).map(([value, m]) => ({
    value,
    label: m.label,
  })),
  PROJECT: Object.entries(PROJECT_STATUS_META).map(([value, m]) => ({
    value,
    label: m.label,
  })),
  PRACTICE: Object.entries(PRACTICE_STATUS_META).map(([value, m]) => ({
    value,
    label: m.label,
  })),
  CONTRACT: Object.entries(CONTRACT_STATUS_META).map(([value, m]) => ({
    value,
    label: m.label,
  })),
  PURCHASE: Object.entries(PURCHASE_STATUS_META).map(([value, m]) => ({
    value,
    label: m.label,
  })),
} as const;

/** Look up a status label + tone for any entity kind. */
export function getStatusMeta(kind: EntityKind, status: string): StatusMeta {
  const map: Record<EntityKind, Record<string, StatusMeta>> = {
    COMPANY: COMPANY_STATUS_META,
    PROJECT: PROJECT_STATUS_META,
    PRACTICE: PRACTICE_STATUS_META,
    CONTRACT: CONTRACT_STATUS_META,
    PURCHASE: PURCHASE_STATUS_META,
    SITE: {},
  };
  return map[kind]?.[status] ?? { label: status, tone: "neutral" };
}
