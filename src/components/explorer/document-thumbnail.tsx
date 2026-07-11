"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { DocumentIcon } from "@/components/ui/file-icon";
import { cn } from "@/lib/utils";
import { isImageMime, isPdfMime } from "@/lib/document-scan";

interface DocumentThumbnailProps {
  /** Authorized content URL for stored documents. */
  contentUrl?: string;
  /** Local file before upload. */
  file?: File;
  mimeType?: string;
  extension?: string | null;
  name: string;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Clickable thumbnail for documents. Images use direct preview; PDFs render
 * the first page client-side via pdfjs-dist (lazy-loaded).
 */
export function DocumentThumbnail({
  contentUrl,
  file,
  mimeType = "",
  extension,
  name,
  onClick,
  className,
  size = "md",
}: DocumentThumbnailProps) {
  const dims = size === "sm" ? "h-12 w-12" : "h-16 w-16";
  const effectiveMime = file?.type || mimeType;
  const effectiveExt = extension ?? (file?.name.split(".").pop() ?? null);

  if (isImageMime(effectiveMime, effectiveExt)) {
    const src = file ? URL.createObjectURL(file) : contentUrl;
    return (
      <ImageThumbnail
        src={src}
        name={name}
        onClick={onClick}
        className={cn(dims, className)}
        revokeOnUnmount={!!file}
      />
    );
  }

  if (isPdfMime(effectiveMime, effectiveExt)) {
    return (
      <PdfThumbnail
        contentUrl={contentUrl}
        file={file}
        name={name}
        onClick={onClick}
        className={cn(dims, className)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={name}
      className={cn(
        "shrink-0 transition-shadow hover:shadow-glow",
        className,
      )}
    >
      <DocumentIcon extension={effectiveExt} className={dims} />
    </button>
  );
}

function ImageThumbnail({
  src,
  name,
  onClick,
  className,
  revokeOnUnmount,
}: {
  src?: string;
  name: string;
  onClick?: () => void;
  className?: string;
  revokeOnUnmount?: boolean;
}) {
  useEffect(() => {
    if (!revokeOnUnmount || !src?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(src);
  }, [revokeOnUnmount, src]);

  return (
    <button
      type="button"
      onClick={onClick}
      title={name}
      className={cn(
        "group shrink-0 overflow-hidden rounded-lg border border-line bg-white shadow-sm transition-shadow hover:shadow-glow",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={name} className="h-full w-full object-cover" />
    </button>
  );
}

function PdfThumbnail({
  contentUrl,
  file,
  name,
  onClick,
  className,
}: {
  contentUrl?: string;
  file?: File;
  name: string;
  onClick?: () => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();

        let data: ArrayBuffer;
        if (file) {
          data = await file.arrayBuffer();
        } else if (contentUrl) {
          const res = await fetch(contentUrl);
          data = await res.arrayBuffer();
        } else {
          return;
        }

        const doc = await pdfjs.getDocument({ data }).promise;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [contentUrl, file]);

  return (
    <button
      type="button"
      onClick={onClick}
      title={name}
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-lg border border-line bg-white shadow-sm transition-shadow hover:shadow-glow",
        className,
      )}
    >
      {!ready && !failed && (
        <span className="absolute inset-0 flex items-center justify-center bg-surface-muted">
          <Loader2 className="h-4 w-4 animate-spin text-brand-400" aria-hidden />
        </span>
      )}
      {failed && (
        <span className="flex h-full w-full items-center justify-center bg-red-50 text-red-500">
          <FileText className="h-5 w-5" aria-hidden />
        </span>
      )}
      <canvas
        ref={canvasRef}
        className={cn(
          "h-full w-full object-contain",
          ready ? "opacity-100" : "opacity-0",
        )}
      />
    </button>
  );
}
