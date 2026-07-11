"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FileUp,
  ScanLine,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState, type ActionState } from "@/lib/action-result";
import {
  createFolderAction,
  uploadDocumentAction,
  renameFolderAction,
  renameDocumentAction,
  deleteFolderAction,
  deleteDocumentAction,
} from "@/app/(app)/folders/actions";
import {
  assignFilesToInput,
  previewUrlForFile,
  scanImageFileToPdf,
} from "@/lib/document-scan";
import { cn, formatFileSize } from "@/lib/utils";
import { DocumentScannerPanel } from "./document-scanner-panel";
import { DocumentThumbnail } from "./document-thumbnail";

type ServerAction = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/** Close the enclosing dialog once the action reports success. */
function useCloseOnSuccess(ok: boolean, onClose: () => void) {
  useEffect(() => {
    if (ok) {
      const t = setTimeout(onClose, 600);
      return () => clearTimeout(t);
    }
  }, [ok, onClose]);
}

function Feedback({ state }: { state: ActionState }) {
  if (state.ok && state.message) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        <span>{state.message}</span>
      </div>
    );
  }
  if (!state.ok && state.message) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        <span>{state.message}</span>
      </div>
    );
  }
  return null;
}

interface PendingFile {
  id: string;
  file: File;
  previewUrl: string;
}

// --- Upload documents ------------------------------------------------------

export function UploadDialog({
  open,
  onClose,
  folderId,
}: {
  open: boolean;
  onClose: () => void;
  folderId: string;
}) {
  const [state, action] = useFormState(uploadDocumentAction, initialActionState);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [scanningImage, setScanningImage] = useState(false);
  const cameraPickRef = useRef<HTMLInputElement>(null);

  useCloseOnSuccess(state.ok, onClose);

  useEffect(() => {
    if (!open) {
      setPending((prev) => {
        for (const p of prev) URL.revokeObjectURL(p.previewUrl);
        return [];
      });
      setShowScanner(false);
    }
  }, [open]);

  function addFiles(files: FileList | File[]) {
    const next: PendingFile[] = [];
    for (const file of Array.from(files)) {
      next.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: previewUrlForFile(file),
      });
    }
    setPending((prev) => [...prev, ...next]);
  }

  function removeFile(id: string) {
    setPending((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (pending.length === 0) {
      e.preventDefault();
      return;
    }
    if (fileRef.current) {
      assignFilesToInput(
        fileRef.current,
        pending.map((p) => p.file),
      );
    }
  }

  async function handleImageScan(file: File) {
    setScanningImage(true);
    try {
      const pdf = await scanImageFileToPdf(file);
      addFiles([pdf]);
    } catch {
      addFiles([file]);
    } finally {
      setScanningImage(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="رفع وثائق"
      wide
      description="اختر ملفات، أو امسح وثيقة بالكاميرا مع اكتشاف الحدود وتحويلها إلى PDF"
    >
      <form
        ref={formRef}
        action={action}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <input type="hidden" name="folderId" value={folderId} />

        {/* Upload modes */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label
            htmlFor="upload-files"
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed px-3 py-4 text-center transition-colors",
              "border-line-strong bg-surface-muted hover:border-brand-300 hover:bg-brand-50/40",
            )}
          >
            <UploadCloud className="h-6 w-6 text-brand-400" aria-hidden />
            <span className="text-xs font-medium text-brand-800">
              اختيار ملفات
            </span>
          </label>

          <button
            type="button"
            onClick={() => setShowScanner((v) => !v)}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed px-3 py-4 text-center transition-colors",
              showScanner
                ? "border-brand-400 bg-brand-50 ring-1 ring-brand-200"
                : "border-line-strong bg-surface-muted hover:border-brand-300 hover:bg-brand-50/40",
            )}
          >
            <ScanLine className="h-6 w-6 text-brand-500" aria-hidden />
            <span className="text-xs font-medium text-brand-800">
              مسح بالكاميرا
            </span>
          </button>

          <button
            type="button"
            onClick={() => cameraPickRef.current?.click()}
            disabled={scanningImage}
            className="flex flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-line-strong bg-surface-muted px-3 py-4 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-60"
          >
            <Camera className="h-6 w-6 text-brand-500" aria-hidden />
            <span className="text-xs font-medium text-brand-800">
              {scanningImage ? "جارٍ المعالجة…" : "صورة سريعة"}
            </span>
          </button>
        </div>

        <input
          id="upload-files"
          ref={fileRef}
          name="files"
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,image/*"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <input
          ref={cameraPickRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImageScan(file);
            e.target.value = "";
          }}
        />

        {showScanner && (
          <DocumentScannerPanel
            onScanned={(file) => {
              addFiles([file]);
              setShowScanner(false);
            }}
            onClose={() => setShowScanner(false)}
          />
        )}

        {/* Pending file previews */}
        {pending.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">
              الملفات الجاهزة للرفع ({pending.length})
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pending.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-line bg-white p-2 shadow-sm"
                >
                  <DocumentThumbnail
                    file={item.file}
                    name={item.file.name}
                    size="sm"
                    onClick={() => {
                      window.open(item.previewUrl, "_blank", "noopener");
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-brand-900">
                      {item.file.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatFileSize(item.file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(item.id)}
                    className="btn-ghost shrink-0 p-1.5 text-slate-400 hover:text-red-600"
                    aria-label={`إزالة ${item.file.name}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {pending.length === 0 && !showScanner && (
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-muted/50 px-3 py-2.5 text-xs text-slate-500">
            <FileUp className="h-4 w-4 shrink-0" aria-hidden />
            لم تُضَف ملفات بعد. اختر ملفات أو امسح وثيقة بالكاميرا.
          </div>
        )}

        <Feedback state={state} />
        <div className="flex justify-start gap-2 pt-1">
          <SubmitButton
            pendingLabel="جارٍ الرفع…"
            disabled={pending.length === 0}
          >
            رفع {pending.length > 0 ? `(${pending.length})` : ""}
          </SubmitButton>
          <button type="button" onClick={onClose} className="btn-secondary">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Create folder ---------------------------------------------------------

export function CreateFolderDialog({
  open,
  onClose,
  parentId,
}: {
  open: boolean;
  onClose: () => void;
  parentId: string | null;
}) {
  const [state, action] = useFormState(createFolderAction, initialActionState);
  useCloseOnSuccess(state.ok, onClose);

  return (
    <Modal open={open} onClose={onClose} title="مجلد جديد">
      <form action={action} className="space-y-4">
        {parentId && <input type="hidden" name="parentId" value={parentId} />}
        <div>
          <label htmlFor="new-folder-name" className="field-label">
            اسم المجلد
          </label>
          <input
            id="new-folder-name"
            name="name"
            className="field-input"
            autoFocus
            placeholder="مثال: عقود ٢٠٢٦"
          />
          {state.fieldErrors?.name && (
            <p className="mt-1 text-xs text-red-600">
              {state.fieldErrors.name[0]}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="new-folder-desc" className="field-label">
            وصف (اختياري)
          </label>
          <textarea
            id="new-folder-desc"
            name="description"
            rows={2}
            className="field-input resize-none"
            placeholder="وصف مختصر لمحتوى المجلد"
          />
        </div>
        <Feedback state={state} />
        <div className="flex justify-start gap-2 pt-1">
          <SubmitButton pendingLabel="جارٍ الإنشاء…">إنشاء</SubmitButton>
          <button type="button" onClick={onClose} className="btn-secondary">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Rename (folder or document) -------------------------------------------

export function RenameDialog({
  open,
  onClose,
  kind,
  id,
  currentName,
}: {
  open: boolean;
  onClose: () => void;
  kind: "folder" | "document";
  id: string;
  currentName: string;
}) {
  const serverAction: ServerAction =
    kind === "folder" ? renameFolderAction : renameDocumentAction;
  const [state, action] = useFormState(serverAction, initialActionState);
  useCloseOnSuccess(state.ok, onClose);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kind === "folder" ? "إعادة تسمية المجلد" : "إعادة تسمية الوثيقة"}
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={id} />
        <div>
          <label htmlFor="rename-input" className="field-label">
            الاسم الجديد
          </label>
          <input
            id="rename-input"
            name="name"
            defaultValue={currentName}
            className="field-input"
            autoFocus
          />
          {state.fieldErrors?.name && (
            <p className="mt-1 text-xs text-red-600">
              {state.fieldErrors.name[0]}
            </p>
          )}
        </div>
        <Feedback state={state} />
        <div className="flex justify-start gap-2 pt-1">
          <SubmitButton pendingLabel="جارٍ الحفظ…">حفظ</SubmitButton>
          <button type="button" onClick={onClose} className="btn-secondary">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Delete confirmation (folder or document) ------------------------------

export function DeleteDialog({
  open,
  onClose,
  kind,
  id,
  name,
  returnToParent,
}: {
  open: boolean;
  onClose: () => void;
  kind: "folder" | "document";
  id: string;
  name: string;
  returnToParent?: boolean;
}) {
  const serverAction: ServerAction =
    kind === "folder" ? deleteFolderAction : deleteDocumentAction;
  const [state, action] = useFormState(serverAction, initialActionState);
  useCloseOnSuccess(state.ok, onClose);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kind === "folder" ? "حذف المجلد" : "حذف الوثيقة"}
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={id} />
        {kind === "folder" && returnToParent && (
          <input type="hidden" name="returnToParent" value="1" />
        )}
        <p className="text-sm text-slate-600">
          هل أنت متأكد من نقل{" "}
          <span className="font-semibold text-brand-900">«{name}»</span> إلى
          المحذوفات؟
          {kind === "folder" &&
            " سيتم نقل كل المجلدات والوثائق بداخله أيضًا."}{" "}
          يمكن استعادته لاحقًا من صفحة المحذوفات.
        </p>
        <Feedback state={state} />
        <div className="flex justify-start gap-2 pt-1">
          <SubmitButton className="btn-danger" pendingLabel="جارٍ الحذف…">
            نقل إلى المحذوفات
          </SubmitButton>
          <button type="button" onClick={onClose} className="btn-secondary">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
