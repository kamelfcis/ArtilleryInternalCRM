"use client";

import { useEffect } from "react";
import { Download, ExternalLink, X } from "lucide-react";
import { isImageMime, isPdfMime } from "@/lib/document-scan";

interface DocumentPreviewModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  contentUrl: string;
  mimeType: string;
  extension?: string | null;
}

/** In-app preview for authorized document content (images + PDFs inline). */
export function DocumentPreviewModal({
  open,
  onClose,
  name,
  contentUrl,
  mimeType,
  extension,
}: DocumentPreviewModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const downloadUrl = `${contentUrl}?download=1`;
  const showImage = isImageMime(mimeType, extension);
  const showPdf = isPdfMime(mimeType, extension);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`معاينة: ${name}`}
    >
      <div
        className="absolute inset-0 bg-brand-950/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col rounded-card border border-line bg-white shadow-overlay">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="truncate text-base font-semibold text-brand-900">
            {name}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={contentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost p-2 text-slate-500"
              title="فتح في تبويب جديد"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
            <a
              href={downloadUrl}
              className="btn-ghost p-2 text-slate-500"
              title="تنزيل"
            >
              <Download className="h-4 w-4" aria-hidden />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="btn-ghost p-2 text-slate-400"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-surface-muted p-4">
          {showImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={contentUrl}
              alt={name}
              className="mx-auto max-h-[70vh] rounded-lg border border-line bg-white object-contain shadow-card"
            />
          )}
          {showPdf && (
            <iframe
              src={contentUrl}
              title={name}
              className="h-[70vh] w-full rounded-lg border border-line bg-white shadow-card"
            />
          )}
          {!showImage && !showPdf && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="text-sm text-slate-600">
                لا تتوفر معاينة مباشرة لهذا النوع من الملفات.
              </p>
              <a href={downloadUrl} className="btn-primary gap-2">
                <Download className="h-4 w-4" aria-hidden />
                تنزيل الملف
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
