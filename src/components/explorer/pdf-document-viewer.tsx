"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { loadPdfjs } from "@/lib/pdf-viewer";
import { cn, toArabicDigits } from "@/lib/utils";

interface PdfDocumentViewerProps {
  url: string;
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDoc = any;

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.2;

/** Canvas-based PDF viewer with page navigation and zoom (pdfjs-dist). */
export function PdfDocumentViewer({ url, className }: PdfDocumentViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PdfDoc | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState(false);

  const renderPage = useCallback(
    async (doc: PdfDoc, pageNum: number, renderScale: number) => {
      const canvas = canvasRef.current;
      const container = scrollRef.current;
      if (!canvas || !container) return;

      renderTaskRef.current?.cancel();
      setRendering(true);

      try {
        const pdfPage = await doc.getPage(pageNum);
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const widthScale = (container.clientWidth - 16) / baseViewport.width;
        const effectiveScale = renderScale * Math.max(widthScale, 0.25);
        const viewport = pdfPage.getViewport({ scale: effectiveScale });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);

        const task = pdfPage.render({ canvasContext: ctx, viewport, canvas });
        renderTaskRef.current = task;
        await task.promise;
      } finally {
        setRendering(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    docRef.current = null;
    setLoading(true);
    setError(false);
    setPage(1);
    setNumPages(0);

    async function load() {
      try {
        const pdfjs = await loadPdfjs();
        const res = await fetch(url);
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.arrayBuffer();
        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        setScale(1);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      void docRef.current?.destroy?.();
      docRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    const doc = docRef.current;
    if (!doc || loading || error) return;
    void renderPage(doc, page, scale);
  }, [page, scale, loading, error, renderPage]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    function onResize() {
      const doc = docRef.current;
      if (!doc || loading || error) return;
      void renderPage(doc, page, scale);
    }

    const observer = new ResizeObserver(onResize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [page, scale, loading, error, renderPage]);

  function changePage(delta: number) {
    setPage((p) => Math.min(numPages, Math.max(1, p + delta)));
  }

  function zoom(delta: number) {
    setScale((s) =>
      Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((s + delta) * 10) / 10)),
    );
  }

  function fitWidth() {
    setScale(1);
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex flex-1 items-center justify-center rounded-lg border border-line bg-white p-6 text-center text-sm text-slate-600",
          className,
        )}
      >
        تعذّر تحميل ملف PDF للمعاينة.
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-2", className)}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white px-2 py-2 sm:px-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => changePage(-1)}
            disabled={loading || page <= 1}
            className="btn-ghost min-h-10 min-w-10 p-2 text-slate-600 disabled:opacity-40"
            aria-label="الصفحة السابقة"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
          <span className="min-w-[5.5rem] text-center text-xs font-medium text-slate-600 sm:text-sm">
            {loading
              ? "…"
              : `${toArabicDigits(String(page))} / ${toArabicDigits(String(numPages))}`}
          </span>
          <button
            type="button"
            onClick={() => changePage(1)}
            disabled={loading || page >= numPages}
            className="btn-ghost min-h-10 min-w-10 p-2 text-slate-600 disabled:opacity-40"
            aria-label="الصفحة التالية"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => zoom(-SCALE_STEP)}
            disabled={loading || scale <= MIN_SCALE}
            className="btn-ghost min-h-10 min-w-10 p-2 text-slate-600 disabled:opacity-40"
            aria-label="تصغير"
          >
            <ZoomOut className="h-4 w-4" aria-hidden />
          </button>
          <span className="hidden min-w-[3rem] text-center text-xs text-slate-500 sm:inline">
            {toArabicDigits(String(Math.round(scale * 100)))}%
          </span>
          <button
            type="button"
            onClick={() => zoom(SCALE_STEP)}
            disabled={loading || scale >= MAX_SCALE}
            className="btn-ghost min-h-10 min-w-10 p-2 text-slate-600 disabled:opacity-40"
            aria-label="تكبير"
          >
            <ZoomIn className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={fitWidth}
            disabled={loading}
            className="btn-ghost min-h-10 min-w-10 p-2 text-slate-600 disabled:opacity-40"
            aria-label="ملاءمة العرض"
            title="ملاءمة العرض"
          >
            <Maximize2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-white shadow-card"
      >
        {(loading || rendering) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" aria-hidden />
          </div>
        )}
        <div className="flex min-h-full justify-center p-2 sm:p-4">
          <canvas ref={canvasRef} className="max-w-full" />
        </div>
      </div>
    </div>
  );
}
