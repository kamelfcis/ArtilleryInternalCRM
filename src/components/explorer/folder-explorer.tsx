"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Folder as FolderIcon,
  FolderPlus,
  UploadCloud,
  MoreVertical,
  Pencil,
  Trash2,
  Download,
  Eye,
  Lock,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CreateFolderDialog,
  UploadDialog,
  RenameDialog,
  DeleteDialog,
} from "./dialogs";
import { DocumentThumbnail } from "./document-thumbnail";
import { DocumentPreviewModal } from "./document-preview-modal";
import { formatFileSize, formatDate, toArabicDigits } from "@/lib/utils";
import type {
  SubfolderView,
  DocumentView,
} from "@/lib/services/folder-view";

interface FolderExplorerProps {
  currentFolderId: string | null;
  currentFolder?: { id: string; name: string; isSystem: boolean } | null;
  canEdit: boolean;
  canManage: boolean;
  subfolders: SubfolderView[];
  documents: DocumentView[];
}

type DialogState =
  | { type: "create" }
  | { type: "upload" }
  | { type: "rename"; kind: "folder" | "document"; id: string; name: string }
  | {
      type: "delete";
      kind: "folder" | "document";
      id: string;
      name: string;
      returnToParent?: boolean;
    }
  | {
      type: "preview";
      id: string;
      name: string;
      mimeType: string;
      extension: string | null;
    }
  | null;

export function FolderExplorer({
  currentFolderId,
  currentFolder,
  canEdit,
  canManage,
  subfolders,
  documents,
}: FolderExplorerProps) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const close = () => setDialog(null);

  const isEmpty = subfolders.length === 0 && documents.length === 0;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      {(canEdit || canManage) && (
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => setDialog({ type: "create" })}
              className="btn-secondary min-h-11 px-4 sm:min-h-0"
            >
              <FolderPlus className="h-4 w-4" aria-hidden />
              مجلد جديد
            </button>
          )}
          {canEdit && currentFolderId && (
            <button
              type="button"
              onClick={() => setDialog({ type: "upload" })}
              className="btn-primary min-h-11 px-4 sm:min-h-0"
            >
              <UploadCloud className="h-4 w-4" aria-hidden />
              رفع وثائق
            </button>
          )}
          {canManage && currentFolder && !currentFolder.isSystem && (
            <button
              type="button"
              onClick={() =>
                setDialog({
                  type: "delete",
                  kind: "folder",
                  id: currentFolder.id,
                  name: currentFolder.name,
                  returnToParent: true,
                })
              }
              className="btn-danger min-h-11 px-4 sm:min-h-0"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              حذف المجلد
            </button>
          )}
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          icon={FolderIcon}
          title="هذا المجلد فارغ"
          description={
            canEdit
              ? "ابدأ بإنشاء مجلد فرعي أو رفع أول وثيقة."
              : "لا توجد عناصر لعرضها في هذا الموقع."
          }
        />
      ) : (
        <>
          {/* Subfolders */}
          {subfolders.length > 0 && (
            <section>
              <SectionTitle
                label="المجلدات"
                count={subfolders.length}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {subfolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onRename={() =>
                      setDialog({
                        type: "rename",
                        kind: "folder",
                        id: folder.id,
                        name: folder.name,
                      })
                    }
                    onDelete={() =>
                      setDialog({
                        type: "delete",
                        kind: "folder",
                        id: folder.id,
                        name: folder.name,
                      })
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* Documents */}
          {documents.length > 0 && (
            <section>
              <SectionTitle label="الوثائق" count={documents.length} />

              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    canEdit={canEdit}
                    canManage={canManage}
                    onPreview={() =>
                      setDialog({
                        type: "preview",
                        id: doc.id,
                        name: doc.name,
                        mimeType: doc.mimeType,
                        extension: doc.extension,
                      })
                    }
                    onRename={() =>
                      setDialog({
                        type: "rename",
                        kind: "document",
                        id: doc.id,
                        name: doc.name,
                      })
                    }
                    onDelete={() =>
                      setDialog({
                        type: "delete",
                        kind: "document",
                        id: doc.id,
                        name: doc.name,
                      })
                    }
                  />
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-hidden rounded-card border border-line bg-white shadow-card md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-right text-xs font-medium text-slate-500">
                        <th className="px-4 py-3 font-medium">الاسم</th>
                        <th className="hidden px-4 py-3 font-medium md:table-cell">
                          الحجم
                        </th>
                        <th className="hidden px-4 py-3 font-medium lg:table-cell">
                          آخر تحديث
                        </th>
                        <th className="hidden px-4 py-3 font-medium lg:table-cell">
                          بواسطة
                        </th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {documents.map((doc) => (
                        <DocumentRow
                          key={doc.id}
                          doc={doc}
                          canEdit={canEdit}
                          canManage={canManage}
                          onPreview={() =>
                            setDialog({
                              type: "preview",
                              id: doc.id,
                              name: doc.name,
                              mimeType: doc.mimeType,
                              extension: doc.extension,
                            })
                          }
                          onRename={() =>
                            setDialog({
                              type: "rename",
                              kind: "document",
                              id: doc.id,
                              name: doc.name,
                            })
                          }
                          onDelete={() =>
                            setDialog({
                              type: "delete",
                              kind: "document",
                              id: doc.id,
                              name: doc.name,
                            })
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Dialogs */}
      {dialog?.type === "create" && (
        <CreateFolderDialog
          open
          onClose={close}
          parentId={currentFolderId}
        />
      )}
      {dialog?.type === "upload" && currentFolderId && (
        <UploadDialog open onClose={close} folderId={currentFolderId} />
      )}
      {dialog?.type === "rename" && (
        <RenameDialog
          open
          onClose={close}
          kind={dialog.kind}
          id={dialog.id}
          currentName={dialog.name}
        />
      )}
      {dialog?.type === "delete" && (
        <DeleteDialog
          open
          onClose={close}
          kind={dialog.kind}
          id={dialog.id}
          name={dialog.name}
          returnToParent={dialog.returnToParent}
        />
      )}
      {dialog?.type === "preview" && (
        <DocumentPreviewModal
          open
          onClose={close}
          name={dialog.name}
          contentUrl={`/api/documents/${dialog.id}/content`}
          mimeType={dialog.mimeType}
          extension={dialog.extension}
        />
      )}
    </div>
  );
}

function SectionTitle({ label, count }: { label: string; count: number }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-900">
      {label}
      <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-slate-500">
        {toArabicDigits(String(count))}
      </span>
    </h2>
  );
}

function FolderCard({
  folder,
  onRename,
  onDelete,
}: {
  folder: SubfolderView;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative">
      <Link
        href={`/folders/${folder.id}`}
        className="flex h-full items-start gap-3 rounded-card border border-line bg-white p-4 shadow-card transition-shadow hover:shadow-panel"
      >
        <span
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `${folder.color ?? "#2f66b5"}18`,
            color: folder.color ?? "#2f66b5",
          }}
        >
          <FolderIcon className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-semibold text-brand-900">
              {folder.name}
            </h3>
            {folder.isSystem && (
              <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            )}
          </div>
          {folder.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
              {folder.description}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-400">
            {toArabicDigits(String(folder.childCount))} مجلد ·{" "}
            {toArabicDigits(String(folder.documentCount))} وثيقة
          </p>
        </div>
      </Link>

      {folder.canManage && !folder.isSystem && (
        <ItemMenu onRename={onRename} onDelete={onDelete} />
      )}
    </div>
  );
}

function DocumentCard({
  doc,
  canEdit,
  canManage,
  onPreview,
  onRename,
  onDelete,
}: {
  doc: DocumentView;
  canEdit: boolean;
  canManage: boolean;
  onPreview: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const previewUrl = `/api/documents/${doc.id}/content`;

  return (
    <article className="rounded-card border border-line bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <DocumentThumbnail
          contentUrl={previewUrl}
          mimeType={doc.mimeType}
          extension={doc.extension}
          name={doc.name}
          size="sm"
          onClick={onPreview}
        />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onPreview}
            className="block w-full truncate text-right font-medium text-brand-900 hover:text-brand-600 hover:underline"
          >
            {doc.name}
          </button>
          <p className="mt-0.5 text-xs text-slate-400">
            {(doc.extension ?? "").toUpperCase()}
            {doc.currentVersion > 1 &&
              ` · الإصدار ${toArabicDigits(String(doc.currentVersion))}`}
          </p>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <div>
              <dt className="sr-only">الحجم</dt>
              <dd>{formatFileSize(doc.size)}</dd>
            </div>
            <div>
              <dt className="sr-only">آخر تحديث</dt>
              <dd>{formatDate(doc.updatedAt)}</dd>
            </div>
            {doc.uploadedByName && (
              <div>
                <dt className="sr-only">بواسطة</dt>
                <dd>{doc.uploadedByName}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end border-t border-line pt-3">
        <DocumentActions
          previewUrl={previewUrl}
          canEdit={canEdit}
          canManage={canManage}
          onPreview={onPreview}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>
    </article>
  );
}

function DocumentRow({
  doc,
  canEdit,
  canManage,
  onPreview,
  onRename,
  onDelete,
}: {
  doc: DocumentView;
  canEdit: boolean;
  canManage: boolean;
  onPreview: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const previewUrl = `/api/documents/${doc.id}/content`;

  return (
    <tr className="group hover:bg-surface-muted/60">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <DocumentThumbnail
            contentUrl={previewUrl}
            mimeType={doc.mimeType}
            extension={doc.extension}
            name={doc.name}
            size="sm"
            onClick={onPreview}
          />
          <div className="min-w-0">
            <button
              type="button"
              onClick={onPreview}
              className="block truncate text-right font-medium text-brand-900 hover:text-brand-600 hover:underline"
            >
              {doc.name}
            </button>
            <p className="text-xs text-slate-400">
              {(doc.extension ?? "").toUpperCase()}
              {doc.currentVersion > 1 &&
                ` · الإصدار ${toArabicDigits(String(doc.currentVersion))}`}
            </p>
          </div>
        </div>
      </td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-slate-500 md:table-cell">
        {formatFileSize(doc.size)}
      </td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-slate-500 lg:table-cell">
        {formatDate(doc.updatedAt)}
      </td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-slate-500 lg:table-cell">
        {doc.uploadedByName}
      </td>
      <td className="px-4 py-3">
        <DocumentActions
          previewUrl={previewUrl}
          canEdit={canEdit}
          canManage={canManage}
          onPreview={onPreview}
          onRename={onRename}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}

function DocumentActions({
  previewUrl,
  canEdit,
  canManage,
  onPreview,
  onRename,
  onDelete,
}: {
  previewUrl: string;
  canEdit: boolean;
  canManage: boolean;
  onPreview: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const downloadUrl = `${previewUrl}?download=1`;

  return (
    <div className="flex items-center justify-end gap-1">
      <a
        href={downloadUrl}
        className="btn-ghost min-h-11 min-w-11 p-2.5 text-slate-500 hover:text-brand-700 sm:min-h-0 sm:min-w-0 sm:p-2"
        title="تنزيل"
        aria-label="تنزيل الوثيقة"
      >
        <Download className="h-4 w-4" aria-hidden />
      </a>
      <button
        type="button"
        onClick={onPreview}
        className="btn-ghost min-h-11 min-w-11 p-2.5 text-slate-500 hover:text-brand-700 sm:min-h-0 sm:min-w-0 sm:p-2"
        title="معاينة"
        aria-label="معاينة الوثيقة"
      >
        <Eye className="h-4 w-4" aria-hidden />
      </button>
      {canEdit && (
        <button
          type="button"
          onClick={onRename}
          className="btn-ghost min-h-11 min-w-11 p-2.5 text-slate-500 hover:text-brand-700 sm:min-h-0 sm:min-w-0 sm:p-2"
          title="إعادة تسمية"
          aria-label="إعادة تسمية الوثيقة"
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
      )}
      {canManage && (
        <button
          type="button"
          onClick={onDelete}
          className="btn-ghost min-h-11 min-w-11 p-2.5 text-red-500 hover:bg-red-50 sm:min-h-0 sm:min-w-0 sm:p-2"
          title="حذف"
          aria-label="حذف الوثيقة"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Small kebab dropdown menu for folder cards. */
function ItemMenu({
  onRename,
  onDelete,
  previewUrl,
}: {
  onRename?: () => void;
  onDelete?: () => void;
  previewUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div
      ref={ref}
      className="absolute left-2 top-2 z-10 [tr_&]:static"
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="خيارات"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-white/90 text-slate-500 opacity-100 shadow-sm transition-opacity hover:text-brand-700 focus-visible:opacity-100 aria-expanded:opacity-100 sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-9 w-44 rounded-xl border border-line bg-white p-1.5 shadow-overlay"
        >
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-800 hover:bg-surface-muted"
            >
              <Eye className="h-4 w-4" aria-hidden />
              معاينة
            </a>
          )}
          {onRename && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onRename();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-800 hover:bg-surface-muted"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              إعادة تسمية
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              حذف
            </button>
          )}
        </div>
      )}
    </div>
  );
}
