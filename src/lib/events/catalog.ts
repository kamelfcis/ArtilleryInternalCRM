/**
 * Central domain-event catalog — the single source of truth for event names.
 *
 * Every event name in the system is declared here as a strongly-typed constant.
 * Producers and subscribers reference `EVENT_NAMES.*`; there are no magic
 * strings anywhere in the codebase. Adding a new event = adding one entry here
 * (see docs/architecture/event-driven-architecture.md).
 */
export const EVENT_NAMES = {
  // --- Authentication ------------------------------------------------------
  UserLoggedIn: "user.logged_in",
  UserLoggedOut: "user.logged_out",
  UserLoginFailed: "user.login_failed",
  UserPasswordChanged: "user.password_changed",

  // --- Users ---------------------------------------------------------------
  UserCreated: "user.created",
  UserUpdated: "user.updated",
  UserRoleChanged: "user.role_changed",
  UserDeleted: "user.deleted",

  // --- Folders -------------------------------------------------------------
  FolderCreated: "folder.created",
  FolderRenamed: "folder.renamed",
  FolderMoved: "folder.moved",
  FolderDeleted: "folder.deleted",
  FolderRestored: "folder.restored",

  // --- Documents -----------------------------------------------------------
  DocumentUploaded: "document.uploaded",
  DocumentUpdated: "document.updated",
  DocumentDeleted: "document.deleted",
  DocumentRestored: "document.restored",
  DocumentVersionCreated: "document.version.created",
  DocumentDownloaded: "document.downloaded",
  DocumentTextExtracted: "document.text_extracted",
  DocumentFieldsExtracted: "document.fields_extracted",
  DocumentLinked: "document.linked",
  DocumentLinkConfirmed: "document.link.confirmed",
  DocumentLinkRejected: "document.link.rejected",

  // --- CRM records ---------------------------------------------------------
  CrmRecordCreated: "crm.record.created",
  CrmRecordUpdated: "crm.record.updated",
  CrmRecordDeleted: "crm.record.deleted",

  // --- Recycle bin ---------------------------------------------------------
  RecycleRestored: "recycle.restored",
  RecyclePurged: "recycle.purged",

  // --- Approval workflow ---------------------------------------------------
  ApprovalSubmitted: "approval.submitted",
  ApprovalReviewStarted: "approval.review_started",
  ApprovalApproved: "approval.approved",
  ApprovalRejected: "approval.rejected",
  ApprovalReturned: "approval.returned",
  ApprovalCancelled: "approval.cancelled",
  ApprovalArchived: "approval.archived",

  // --- Tasks / assignments -------------------------------------------------
  TaskCreated: "task.created",
  TaskAssigned: "task.assigned",
  TaskUpdated: "task.updated",
  TaskCompleted: "task.completed",
  TaskCancelled: "task.cancelled",
} as const;

/** Union of every valid event name. */
export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];

/** All event names as a runtime array (used by the bus registration + tests). */
export const ALL_EVENT_NAMES = Object.values(EVENT_NAMES) as EventName[];
