"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2, UploadCloud } from "lucide-react";
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
  useCloseOnSuccess(state.ok, onClose);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="رفع وثائق"
      description="يمكنك اختيار ملف واحد أو أكثر (PDF، Word، Excel، صور)"
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="folderId" value={folderId} />
        <label
          htmlFor="upload-files"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line-strong bg-surface-muted px-4 py-8 text-center hover:border-brand-300 hover:bg-brand-50/40"
        >
          <UploadCloud className="h-8 w-8 text-brand-400" aria-hidden />
          <span className="text-sm font-medium text-brand-800">
            اضغط لاختيار الملفات
          </span>
          <span className="text-xs text-slate-500">
            الحد الأقصى لحجم الملف الواحد ٥٠ ميجابايت
          </span>
        </label>
        <input
          id="upload-files"
          ref={fileRef}
          name="files"
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
          className="block w-full text-sm text-slate-600 file:me-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
        />
        <Feedback state={state} />
        <div className="flex justify-start gap-2 pt-1">
          <SubmitButton pendingLabel="جارٍ الرفع…">رفع</SubmitButton>
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
