/**
 * Central catalogue of constrained string values and their Arabic labels.
 *
 * Because the schema is kept portable (no native DB enums), these values are
 * the single source of truth and are enforced at the application layer via the
 * Zod validators in `src/lib/validators.ts`.
 */

// --- User roles ------------------------------------------------------------

export const ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  EDITOR: "EDITOR",
  VIEWER: "VIEWER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_ORDER: Role[] = [
  ROLES.VIEWER,
  ROLES.EDITOR,
  ROLES.MANAGER,
  ROLES.ADMIN,
];

/** Privilege rank; higher is more privileged. */
export const ROLE_RANK: Record<Role, number> = {
  [ROLES.VIEWER]: 0,
  [ROLES.EDITOR]: 1,
  [ROLES.MANAGER]: 2,
  [ROLES.ADMIN]: 3,
};

/** True when `role` is at least as privileged as `minRole`. Client-safe. */
export function hasRoleAtLeast(role: Role, minRole: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "مدير النظام",
  MANAGER: "مدير",
  EDITOR: "محرِّر",
  VIEWER: "مطالع",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "صلاحيات كاملة على النظام والمستخدمين والإعدادات",
  MANAGER: "إدارة المجلدات والوثائق ومنح الصلاحيات",
  EDITOR: "إضافة وتعديل الوثائق والمجلدات",
  VIEWER: "الاطّلاع على الوثائق دون تعديل",
};

// --- Folder-level permission levels ---------------------------------------

export const PERMISSION_LEVELS = {
  VIEW: "VIEW",
  EDIT: "EDIT",
  MANAGE: "MANAGE",
} as const;

export type PermissionLevel =
  (typeof PERMISSION_LEVELS)[keyof typeof PERMISSION_LEVELS];

export const PERMISSION_LEVEL_ORDER: PermissionLevel[] = [
  PERMISSION_LEVELS.VIEW,
  PERMISSION_LEVELS.EDIT,
  PERMISSION_LEVELS.MANAGE,
];

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  VIEW: "اطّلاع",
  EDIT: "تحرير",
  MANAGE: "إدارة كاملة",
};

// --- Audit actions ---------------------------------------------------------

export const AUDIT_ACTIONS = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  LOGIN_FAILED: "LOGIN_FAILED",
  CREATE_FOLDER: "CREATE_FOLDER",
  RENAME_FOLDER: "RENAME_FOLDER",
  MOVE_FOLDER: "MOVE_FOLDER",
  DELETE_FOLDER: "DELETE_FOLDER",
  RESTORE_FOLDER: "RESTORE_FOLDER",
  UPLOAD_DOCUMENT: "UPLOAD_DOCUMENT",
  UPDATE_DOCUMENT: "UPDATE_DOCUMENT",
  RENAME_DOCUMENT: "RENAME_DOCUMENT",
  MOVE_DOCUMENT: "MOVE_DOCUMENT",
  DELETE_DOCUMENT: "DELETE_DOCUMENT",
  RESTORE_DOCUMENT: "RESTORE_DOCUMENT",
  DOWNLOAD_DOCUMENT: "DOWNLOAD_DOCUMENT",
  NEW_VERSION: "NEW_VERSION",
  EXTRACT_TEXT: "EXTRACT_TEXT",
  EXTRACT_FIELDS: "EXTRACT_FIELDS",
  LINK_DOCUMENT: "LINK_DOCUMENT",
  CONFIRM_LINK: "CONFIRM_LINK",
  REJECT_LINK: "REJECT_LINK",
  CREATE_USER: "CREATE_USER",
  UPDATE_USER: "UPDATE_USER",
  DEACTIVATE_USER: "DEACTIVATE_USER",
  GRANT_PERMISSION: "GRANT_PERMISSION",
  REVOKE_PERMISSION: "REVOKE_PERMISSION",
  CREATE_RECORD: "CREATE_RECORD",
  UPDATE_RECORD: "UPDATE_RECORD",
  DELETE_RECORD: "DELETE_RECORD",
  APPROVAL_SUBMITTED: "APPROVAL_SUBMITTED",
  APPROVAL_REVIEW_STARTED: "APPROVAL_REVIEW_STARTED",
  APPROVAL_APPROVED: "APPROVAL_APPROVED",
  APPROVAL_REJECTED: "APPROVAL_REJECTED",
  APPROVAL_RETURNED: "APPROVAL_RETURNED",
  APPROVAL_CANCELLED: "APPROVAL_CANCELLED",
  APPROVAL_ARCHIVED: "APPROVAL_ARCHIVED",
  TASK_CREATED: "TASK_CREATED",
  TASK_ASSIGNED: "TASK_ASSIGNED",
  TASK_UPDATED: "TASK_UPDATED",
  TASK_COMPLETED: "TASK_COMPLETED",
  TASK_CANCELLED: "TASK_CANCELLED",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN: "تسجيل دخول",
  LOGOUT: "تسجيل خروج",
  LOGIN_FAILED: "محاولة دخول فاشلة",
  CREATE_FOLDER: "إنشاء مجلد",
  RENAME_FOLDER: "إعادة تسمية مجلد",
  MOVE_FOLDER: "نقل مجلد",
  DELETE_FOLDER: "حذف مجلد",
  RESTORE_FOLDER: "استعادة مجلد",
  UPLOAD_DOCUMENT: "رفع وثيقة",
  UPDATE_DOCUMENT: "تحديث وثيقة",
  RENAME_DOCUMENT: "إعادة تسمية وثيقة",
  MOVE_DOCUMENT: "نقل وثيقة",
  DELETE_DOCUMENT: "حذف وثيقة",
  RESTORE_DOCUMENT: "استعادة وثيقة",
  DOWNLOAD_DOCUMENT: "تنزيل وثيقة",
  NEW_VERSION: "إصدار جديد لوثيقة",
  EXTRACT_TEXT: "استخراج نص من وثيقة",
  EXTRACT_FIELDS: "استخراج بيانات من وثيقة",
  LINK_DOCUMENT: "ربط وثيقة بسجلات",
  CONFIRM_LINK: "تأكيد ربط وثيقة",
  REJECT_LINK: "رفض ربط وثيقة",
  CREATE_USER: "إنشاء مستخدم",
  UPDATE_USER: "تعديل مستخدم",
  DEACTIVATE_USER: "تعطيل مستخدم",
  GRANT_PERMISSION: "منح صلاحية",
  REVOKE_PERMISSION: "سحب صلاحية",
  CREATE_RECORD: "إنشاء سجل",
  UPDATE_RECORD: "تعديل سجل",
  DELETE_RECORD: "حذف سجل",
  APPROVAL_SUBMITTED: "تقديم للاعتماد",
  APPROVAL_REVIEW_STARTED: "بدء المراجعة",
  APPROVAL_APPROVED: "اعتماد",
  APPROVAL_REJECTED: "رفض",
  APPROVAL_RETURNED: "إعادة للتعديل",
  APPROVAL_CANCELLED: "إلغاء التقديم",
  APPROVAL_ARCHIVED: "أرشفة الاعتماد",
  TASK_CREATED: "إنشاء مهمة",
  TASK_ASSIGNED: "إسناد مهمة",
  TASK_UPDATED: "تحديث مهمة",
  TASK_COMPLETED: "إكمال مهمة",
  TASK_CANCELLED: "إلغاء مهمة",
} as const;

// --- Entity types (for audit + generic references) -------------------------

export const ENTITY_TYPES = {
  FOLDER: "FOLDER",
  DOCUMENT: "DOCUMENT",
  USER: "USER",
  PERMISSION: "PERMISSION",
  COMPANY: "COMPANY",
  CONTRACT: "CONTRACT",
  PRACTICE: "PRACTICE",
  PROJECT: "PROJECT",
  SITE: "SITE",
  PURCHASE: "PURCHASE",
  APPROVAL: "APPROVAL",
  TASK: "TASK",
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

// --- Seed: the department's core business entities (top-level folders) ------
// These mirror the existing Google Drive structure so the transition is
// seamless for employees.

export const CORE_BUSINESS_ENTITIES: { name: string; description: string; color: string }[] = [
  { name: "الممارسات", description: "ملفات الممارسات والمناقصات", color: "#2f66b5" },
  { name: "التعاقدات", description: "العقود والاتفاقيات", color: "#1c7d5a" },
  { name: "الشركات", description: "بيانات الشركات والموردين", color: "#8a5a1c" },
  { name: "الحديقة", description: "مشروع الحديقة", color: "#4f9e3a" },
  { name: "السخنة", description: "مشروع السخنة", color: "#b5482f" },
  { name: "المالية", description: "المستندات المالية", color: "#7a2fb5" },
  { name: "الدار", description: "ملفات الدار", color: "#2f8fb5" },
  { name: "الأقسام", description: "الأقسام التنظيمية", color: "#555f6e" },
  { name: "المشروعات", description: "المشروعات العامة", color: "#b5912f" },
  { name: "المواقع", description: "المواقع والمنشآت", color: "#2f8fb5" },
  { name: "المشتريات", description: "أوامر الشراء والمشتريات", color: "#7a2fb5" },
];

// --- File handling ---------------------------------------------------------

/** Extensions permitted for upload. PDF-first, with common office formats. */
export const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "png",
  "jpg",
  "jpeg",
  "txt",
] as const;

export const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  txt: "text/plain",
};
