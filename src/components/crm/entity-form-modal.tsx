"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2, ScanLine, Loader2, Camera } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState, type ActionState } from "@/lib/action-result";
import { cn } from "@/lib/utils";

export type FieldType =
  | "text"
  | "textarea"
  | "select"
  | "date"
  | "money"
  | "email"
  | "tel";

export interface FormField {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Span both columns (e.g. textareas). */
  full?: boolean;
  dir?: "ltr" | "rtl";
  hint?: string;
}

/** Enables the scan-to-fill panel above the form (create dialogs only). */
export interface ScanConfig {
  /** CRM kind sent to the scan endpoint, e.g. "CONTRACT" | "PURCHASE". */
  kind: string;
  /** POST endpoint that returns { values, warnings }. */
  endpoint: string;
  /** Button label, e.g. "مسح ضوئي للعقد". */
  label: string;
}

interface EntityFormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: FormField[];
  initialValues?: Record<string, string>;
  recordId?: string;
  submitLabel?: string;
  scan?: ScanConfig;
}

export function EntityFormModal({
  open,
  onClose,
  title,
  action,
  fields,
  initialValues,
  recordId,
  submitLabel = "حفظ",
  scan,
}: EntityFormModalProps) {
  const [state, formAction] = useFormState(action, initialActionState);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    () => initialValues ?? {},
  );

  useEffect(() => {
    if (open) setFieldValues(initialValues ?? {});
  }, [open, initialValues]);

  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(onClose, 600);
      return () => clearTimeout(t);
    }
  }, [state.ok, onClose]);

  function setFieldValue(name: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form action={formAction} className="space-y-4">
        {recordId && <input type="hidden" name="id" value={recordId} />}

        {scan && (
          <ScanPanel
            scan={scan}
            onFilled={(values) => {
              setFieldValues((prev) => ({ ...prev, ...values }));
            }}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <FieldRenderer
              key={field.name}
              field={field}
              value={fieldValues[field.name] ?? ""}
              onChange={setFieldValue}
              error={state.fieldErrors?.[field.name]}
            />
          ))}
        </div>

        {state.message && (
          <div
            role={state.ok ? "status" : "alert"}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm",
              state.ok
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {state.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{state.message}</span>
          </div>
        )}

        <div className="flex justify-start gap-2 pt-1">
          <SubmitButton pendingLabel="جارٍ الحفظ…">{submitLabel}</SubmitButton>
          <button type="button" onClick={onClose} className="btn-secondary">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Scan-to-fill panel: capture a photo (mobile camera) or upload a photo/PDF of
 * the document, POST it to the scan endpoint, and hand the returned values up so
 * the form pre-fills. The chosen file stays in its input so it is submitted with
 * the form — the create action then saves it into the record's folder under
 * المستندات. OCR + extraction run server-side; nothing is persisted until submit.
 */
function ScanPanel({
  scan,
  onFilled,
}: {
  scan: ScanConfig;
  onFilled: (values: Record<string, string>) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleFile(file: File, source: "camera" | "upload") {
    // Keep only the input that holds the chosen file, so exactly one is
    // submitted with the form.
    if (source === "camera" && uploadRef.current) uploadRef.current.value = "";
    if (source === "upload" && cameraRef.current) cameraRef.current.value = "";

    setBusy(true);
    setResult(null);
    setFileName(file.name);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", scan.kind);
      const res = await fetch(scan.endpoint, {
        method: "POST",
        body,
        credentials: "same-origin",
      });

      if (res.redirected) {
        setResult({
          ok: false,
          text: "انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.",
        });
        return;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        setResult({ ok: false, text: "استجابة غير متوقعة من الخادم" });
        return;
      }

      let data: {
        values?: Record<string, string>;
        warnings?: string[];
        error?: string;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        setResult({ ok: false, text: "تعذّر قراءة استجابة الخادم" });
        return;
      }

      if (!res.ok) {
        setResult({ ok: false, text: data.error ?? "تعذّر تحليل المستند" });
        return;
      }

      const values = data.values ?? {};
      const filled = Object.keys(values).length;
      if (filled === 0) {
        const warn = data.warnings?.join(" · ");
        setResult({
          ok: false,
          text:
            warn ??
            "لم يُستخرج أي حقل من المستند. جرّب صورة أوضح أو ملفًا مختلفًا.",
        });
        return;
      }

      onFilled(values);
      const warn = data.warnings?.length ? ` — ${data.warnings.join(" · ")}` : "";
      setResult({ ok: true, text: `تم تعبئة ${filled} حقلًا من المستند${warn}` });
    } catch {
      setResult({ ok: false, text: "تعذّر الاتصال بالخادم" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-brand-300 bg-brand-50/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy}
          className="btn-secondary gap-2"
          aria-busy={busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Camera className="h-4 w-4" aria-hidden />
          )}
          التقاط بالكاميرا
        </button>
        <button
          type="button"
          onClick={() => uploadRef.current?.click()}
          disabled={busy}
          className="btn-secondary gap-2"
          aria-busy={busy}
        >
          <ScanLine className="h-4 w-4" aria-hidden />
          {scan.label}
        </button>
        <p className="text-xs text-slate-500">
          {busy ? "جارٍ التحليل…" : "التقط صورة أو ارفع ملف PDF لتعبئة الحقول وحفظه في المستندات"}
        </p>

        {/* Mobile camera capture; on desktop this falls back to a file picker. */}
        <input
          ref={cameraRef}
          type="file"
          name="scanFileCamera"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file, "camera");
          }}
        />
        <input
          ref={uploadRef}
          type="file"
          name="scanFileUpload"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file, "upload");
          }}
        />
      </div>

      {fileName && !result && !busy && (
        <p className="mt-2 truncate text-xs text-slate-500">الملف: {fileName}</p>
      )}
      {result && (
        <div
          role={result.ok ? "status" : "alert"}
          className={cn(
            "mt-2 flex items-start gap-2 rounded-md px-2.5 py-2 text-xs",
            result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700",
          )}
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span>{result.text}</span>
        </div>
      )}
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: string[];
}) {
  const id = `field-${field.name}`;
  const isFull = field.full || field.type === "textarea";

  return (
    <div className={isFull ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="field-label">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
      </label>

      {field.type === "textarea" ? (
        <textarea
          id={id}
          name={field.name}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          rows={3}
          placeholder={field.placeholder}
          className="field-input resize-none"
        />
      ) : field.type === "select" ? (
        <select
          id={id}
          name={field.name}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          className="field-input"
        >
          {!field.required && <option value="">— بدون —</option>}
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          name={field.name}
          type={
            field.type === "money"
              ? "number"
              : field.type === "date"
                ? "date"
                : field.type === "email"
                  ? "email"
                  : field.type === "tel"
                    ? "tel"
                    : "text"
          }
          step={field.type === "money" ? "0.01" : undefined}
          min={field.type === "money" ? "0" : undefined}
          dir={field.dir}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.placeholder}
          className="field-input"
        />
      )}

      {field.hint && !error && (
        <p className="mt-1 text-xs text-slate-400">{field.hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error[0]}</p>}
    </div>
  );
}
