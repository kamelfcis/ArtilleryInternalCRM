"use client";

import { useEffect } from "react";
import { Download, ExternalLink, X } from "lucide-react";
import { isImageMime, isPdfMime } from "@/lib/document-scan";
import { cn } from "@/lib/utils";

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
  const pdfSrc = showPdf ? `${contentUrl}#view=FitH&zoom=page-width` : contentUrl;

  return (
    <div
      className="fixed inset-0 z-[60] flex sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`معاينة: ${name}`}
    >
      <div
        className="absolute inset-0 bg-brand-950/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "relative flex h-full w-full min-h-0 flex-col bg-white",
          "sm:max-h-[calc(100dvh-2rem)] sm:max-w-4xl sm:rounded-card sm:border sm:border-line sm:shadow-overlay",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-3 sm:gap-3 sm:px-5 sm:py-4">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-900 sm:text-base">
            {name}
          </h2>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <a
              href={contentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost min-h-11 min-w-11 p-2.5 text-slate-500 sm:min-h-0 sm:min-w-0 sm:p-2"
              title="فتح في تبويب جديد"
            >
              <ExternalLink className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden />
            </a>
            <a
              href={downloadUrl}
              className="btn-ghost min-h-11 min-w-11 p-2.5 text-slate-500 sm:min-h-0 sm:min-w-0 sm:p-2"
              title="تنزيل"
            >
              <Download className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="btn-ghost min-h-11 min-w-11 p-2.5 text-slate-400 sm:min-h-0 sm:min-w-0 sm:p-2"
            >
              <X className="h-5 w-5 sm:h-5 sm:w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-muted p-2 sm:p-4">
          {showImage && (
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={contentUrl}
                alt={name}
                className="max-h-full max-w-full rounded-lg border border-line bg-white object-contain shadow-card"
              />
            </div>
          )}
          {showPdf && (
            <iframe
              src={pdfSrc}
              title={name}
              className="min-h-0 w-full flex-1 rounded-lg border border-line bg-white shadow-card"
            />
          )}
          {!showImage && !showPdf && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
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
