import "server-only";
import { recordAudit } from "@/lib/audit";
import {
  AUDIT_ACTIONS,
  ENTITY_TYPES,
  type AuditAction,
  type EntityType,
} from "@/lib/constants";
import { ENTITY_KIND_META, type EntityKind } from "@/lib/crm/constants";
import { ALL_EVENT_NAMES, EVENT_NAMES } from "../catalog";
import type { EventBus } from "../bus";
import type { DomainEvent } from "../types";

/**
 * Audit subscriber — the single place that turns domain events into
 * append-only audit-trail entries.
 *
 * Audit logging used to be invoked imperatively from every service; it is now a
 * *reaction* to domain events. All audit phrasing (Arabic summaries, action
 * mapping) lives here — its single responsibility — so producers only emit
 * facts. Output is behaviour-preserving: identical action, entityType, summary
 * and metadata to the pre-migration audit entries.
 */

/** Static event → audit action. Recycle-restore resolves by entityType below. */
const ACTION_BY_EVENT: Partial<Record<string, AuditAction>> = {
  [EVENT_NAMES.UserLoggedIn]: AUDIT_ACTIONS.LOGIN,
  [EVENT_NAMES.UserLoggedOut]: AUDIT_ACTIONS.LOGOUT,
  [EVENT_NAMES.UserLoginFailed]: AUDIT_ACTIONS.LOGIN_FAILED,
  [EVENT_NAMES.UserPasswordChanged]: AUDIT_ACTIONS.UPDATE_USER,
  [EVENT_NAMES.UserCreated]: AUDIT_ACTIONS.CREATE_USER,
  [EVENT_NAMES.UserUpdated]: AUDIT_ACTIONS.UPDATE_USER,
  [EVENT_NAMES.UserRoleChanged]: AUDIT_ACTIONS.UPDATE_USER,
  [EVENT_NAMES.UserDeleted]: AUDIT_ACTIONS.DEACTIVATE_USER,
  [EVENT_NAMES.FolderCreated]: AUDIT_ACTIONS.CREATE_FOLDER,
  [EVENT_NAMES.FolderRenamed]: AUDIT_ACTIONS.RENAME_FOLDER,
  [EVENT_NAMES.FolderMoved]: AUDIT_ACTIONS.MOVE_FOLDER,
  [EVENT_NAMES.FolderDeleted]: AUDIT_ACTIONS.DELETE_FOLDER,
  [EVENT_NAMES.FolderRestored]: AUDIT_ACTIONS.RESTORE_FOLDER,
  [EVENT_NAMES.DocumentUploaded]: AUDIT_ACTIONS.UPLOAD_DOCUMENT,
  [EVENT_NAMES.DocumentUpdated]: AUDIT_ACTIONS.RENAME_DOCUMENT,
  [EVENT_NAMES.DocumentDeleted]: AUDIT_ACTIONS.DELETE_DOCUMENT,
  [EVENT_NAMES.DocumentRestored]: AUDIT_ACTIONS.RESTORE_DOCUMENT,
  [EVENT_NAMES.DocumentVersionCreated]: AUDIT_ACTIONS.NEW_VERSION,
  [EVENT_NAMES.DocumentDownloaded]: AUDIT_ACTIONS.DOWNLOAD_DOCUMENT,
  [EVENT_NAMES.DocumentTextExtracted]: AUDIT_ACTIONS.EXTRACT_TEXT,
  [EVENT_NAMES.DocumentFieldsExtracted]: AUDIT_ACTIONS.EXTRACT_FIELDS,
  [EVENT_NAMES.DocumentLinked]: AUDIT_ACTIONS.LINK_DOCUMENT,
  [EVENT_NAMES.DocumentLinkConfirmed]: AUDIT_ACTIONS.CONFIRM_LINK,
  [EVENT_NAMES.DocumentLinkRejected]: AUDIT_ACTIONS.REJECT_LINK,
  [EVENT_NAMES.CrmRecordCreated]: AUDIT_ACTIONS.CREATE_RECORD,
  [EVENT_NAMES.CrmRecordUpdated]: AUDIT_ACTIONS.UPDATE_RECORD,
  [EVENT_NAMES.CrmRecordDeleted]: AUDIT_ACTIONS.DELETE_RECORD,
  [EVENT_NAMES.RecyclePurged]: AUDIT_ACTIONS.DELETE_DOCUMENT,
  [EVENT_NAMES.ApprovalSubmitted]: AUDIT_ACTIONS.APPROVAL_SUBMITTED,
  [EVENT_NAMES.ApprovalReviewStarted]: AUDIT_ACTIONS.APPROVAL_REVIEW_STARTED,
  [EVENT_NAMES.ApprovalApproved]: AUDIT_ACTIONS.APPROVAL_APPROVED,
  [EVENT_NAMES.ApprovalRejected]: AUDIT_ACTIONS.APPROVAL_REJECTED,
  [EVENT_NAMES.ApprovalReturned]: AUDIT_ACTIONS.APPROVAL_RETURNED,
  [EVENT_NAMES.ApprovalCancelled]: AUDIT_ACTIONS.APPROVAL_CANCELLED,
  [EVENT_NAMES.ApprovalArchived]: AUDIT_ACTIONS.APPROVAL_ARCHIVED,
  [EVENT_NAMES.TaskCreated]: AUDIT_ACTIONS.TASK_CREATED,
  [EVENT_NAMES.TaskAssigned]: AUDIT_ACTIONS.TASK_ASSIGNED,
  [EVENT_NAMES.TaskUpdated]: AUDIT_ACTIONS.TASK_UPDATED,
  [EVENT_NAMES.TaskCompleted]: AUDIT_ACTIONS.TASK_COMPLETED,
  [EVENT_NAMES.TaskCancelled]: AUDIT_ACTIONS.TASK_CANCELLED,
};

/** Metadata keys used only to build the summary — not stored on the audit row. */
const PRESENTATION_KEYS = new Set(["name", "reason", "email", "version"]);

function metaString(meta: Record<string, unknown> | undefined, key: string): string {
  const value = meta?.[key];
  return typeof value === "string" ? value : "";
}

function crmLabel(entityType: EntityType): string {
  return ENTITY_KIND_META[entityType as EntityKind]?.labelSingular ?? "";
}

function actionFor(event: DomainEvent): AuditAction | undefined {
  if (event.eventName === EVENT_NAMES.RecycleRestored) {
    return event.entityType === ENTITY_TYPES.FOLDER
      ? AUDIT_ACTIONS.RESTORE_FOLDER
      : AUDIT_ACTIONS.RESTORE_DOCUMENT;
  }
  return ACTION_BY_EVENT[event.eventName];
}

function summaryFor(event: DomainEvent): string {
  const name = metaString(event.metadata, "name");
  switch (event.eventName) {
    case EVENT_NAMES.UserLoggedIn:
      return "تسجيل دخول ناجح";
    case EVENT_NAMES.UserLoggedOut:
      return "تسجيل خروج";
    case EVENT_NAMES.UserLoginFailed:
      return metaString(event.metadata, "reason") === "unknown_account"
        ? `محاولة دخول بحساب غير موجود: ${metaString(event.metadata, "email")}`
        : "كلمة مرور غير صحيحة";
    case EVENT_NAMES.UserPasswordChanged:
      return `إعادة تعيين كلمة مرور المستخدم: ${name}`;
    case EVENT_NAMES.UserCreated:
      return `إنشاء مستخدم: ${name}`;
    case EVENT_NAMES.UserUpdated:
    case EVENT_NAMES.UserRoleChanged:
    case EVENT_NAMES.UserDeleted:
      return `تعديل مستخدم: ${name}`;
    case EVENT_NAMES.FolderCreated:
      return `إنشاء مجلد: ${name}`;
    case EVENT_NAMES.FolderRenamed:
      return `إعادة تسمية مجلد إلى: ${name}`;
    case EVENT_NAMES.FolderDeleted:
      return `حذف مجلد: ${name}`;
    case EVENT_NAMES.FolderRestored:
      return `استعادة مجلد: ${name}`;
    case EVENT_NAMES.DocumentUploaded:
      return `رفع وثيقة: ${name}`;
    case EVENT_NAMES.DocumentVersionCreated: {
      const version = event.metadata?.version;
      return `إصدار جديد (${typeof version === "number" ? version : ""}) للوثيقة: ${name}`;
    }
    case EVENT_NAMES.DocumentUpdated:
      return `إعادة تسمية وثيقة إلى: ${name}`;
    case EVENT_NAMES.DocumentDeleted:
      return `حذف وثيقة: ${name}`;
    case EVENT_NAMES.DocumentRestored:
      return `استعادة وثيقة: ${name}`;
    case EVENT_NAMES.DocumentDownloaded:
      return `تنزيل وثيقة: ${name}`;
    case EVENT_NAMES.DocumentTextExtracted: {
      const pages = event.metadata?.pages;
      return `استخراج نص من وثيقة: ${name}${
        typeof pages === "number" ? ` (${pages} صفحة)` : ""
      }`;
    }
    case EVENT_NAMES.DocumentFieldsExtracted: {
      const fields = event.metadata?.fields;
      return `استخراج بيانات من وثيقة: ${name}${
        typeof fields === "number" ? ` (${fields} حقل)` : ""
      }`;
    }
    case EVENT_NAMES.DocumentLinked: {
      const links = event.metadata?.links;
      return `ربط وثيقة بسجلات: ${name}${
        typeof links === "number" ? ` (${links} رابط)` : ""
      }`;
    }
    case EVENT_NAMES.DocumentLinkConfirmed: {
      const target = metaString(event.metadata, "target");
      return `تأكيد ربط «${name}»${target ? ` بـ${target}` : ""}`;
    }
    case EVENT_NAMES.DocumentLinkRejected: {
      const target = metaString(event.metadata, "target");
      return `رفض ربط «${name}»${target ? ` بـ${target}` : ""}`;
    }
    case EVENT_NAMES.RecyclePurged:
      return `حذف نهائي لوثيقة: ${name}`;
    case EVENT_NAMES.CrmRecordCreated:
      return `إنشاء ${crmLabel(event.entityType)}: ${name}`;
    case EVENT_NAMES.CrmRecordUpdated:
      return `تعديل ${crmLabel(event.entityType)}: ${name}`;
    case EVENT_NAMES.CrmRecordDeleted:
      return `حذف ${crmLabel(event.entityType)}: ${name}`;
    case EVENT_NAMES.ApprovalSubmitted:
      return `تقديم «${name}» للاعتماد`;
    case EVENT_NAMES.ApprovalReviewStarted:
      return `بدء مراجعة «${name}»`;
    case EVENT_NAMES.ApprovalApproved:
      return `اعتماد «${name}»`;
    case EVENT_NAMES.ApprovalRejected:
      return `رفض «${name}»`;
    case EVENT_NAMES.ApprovalReturned:
      return `إعادة «${name}» للتعديل`;
    case EVENT_NAMES.ApprovalCancelled:
      return `إلغاء تقديم «${name}»`;
    case EVENT_NAMES.ApprovalArchived:
      return `أرشفة اعتماد «${name}»`;
    case EVENT_NAMES.TaskCreated:
      return `إنشاء مهمة: «${name}»`;
    case EVENT_NAMES.TaskAssigned:
      return `إعادة إسناد مهمة: «${name}»`;
    case EVENT_NAMES.TaskUpdated:
      return `تحديث مهمة: «${name}»`;
    case EVENT_NAMES.TaskCompleted:
      return `إكمال مهمة: «${name}»`;
    case EVENT_NAMES.TaskCancelled:
      return `إلغاء مهمة: «${name}»`;
    default:
      return name || event.eventName;
  }
}

/** Extra context stored on the audit row (presentation-only keys removed). */
function auditMetadata(
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (!PRESENTATION_KEYS.has(key)) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function onEvent(event: DomainEvent): Promise<void> | void {
  const action = actionFor(event);
  if (!action) return; // Not an audited event (none today, but future-safe).
  return recordAudit({
    userId: event.actorId,
    action,
    entityType: event.entityType,
    entityId: event.entityId || undefined,
    summary: summaryFor(event),
    metadata: auditMetadata(event.metadata),
  });
}

export function registerAuditSubscriber(bus: EventBus): void {
  for (const eventName of ALL_EVENT_NAMES) {
    bus.on(eventName, onEvent);
  }
}
