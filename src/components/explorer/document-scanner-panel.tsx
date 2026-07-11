"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Loader2,
  RefreshCw,
  ScanLine,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  canvasToPdfFile,
  captureVideoFrame,
  ensureScannerLibs,
  extractDocument,
  highlightDocument,
} from "@/lib/document-scan";

interface DocumentScannerPanelProps {
  onScanned: (file: File) => void;
  onClose: () => void;
}

type Phase = "init" | "camera" | "processing" | "preview";

/**
 * Live camera document scanner with border detection and PDF export.
 * OpenCV + jscanify load from CDN on demand (~8MB) to avoid bloating the bundle.
 */
export function DocumentScannerPanel({
  onScanned,
  onClose,
}: DocumentScannerPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("init");
  const [error, setError] = useState<string | null>(null);
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(
    null,
  );
  const [highlightUrl, setHighlightUrl] = useState<string | null>(null);
  const [libsLoading, setLibsLoading] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function startCamera() {
    setError(null);
    setLibsLoading(true);
    try {
      await ensureScannerLibs();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("camera");
    } catch {
      setError(
        "تعذّر الوصول للكاميرا. يمكنك التقاط صورة من زر «التقاط بالكاميرا» أدناه.",
      );
    } finally {
      setLibsLoading(false);
    }
  }

  async function processSource(source: HTMLImageElement | HTMLCanvasElement) {
    setPhase("processing");
    setError(null);
    try {
      await ensureScannerLibs();
      const [extracted, highlighted] = await Promise.all([
        extractDocument(source),
        highlightDocument(source).catch(() => null),
      ]);
      setPreviewCanvas(extracted);
      if (highlighted) {
        setHighlightUrl(highlighted.toDataURL("image/jpeg", 0.85));
      }
      setPhase("preview");
    } catch {
      setError("تعذّر اكتشاف حدود الوثيقة. حاول مرة أخرى بإضاءة أفضل.");
      setPhase("camera");
    }
  }

  async function captureFromVideo() {
    if (!videoRef.current?.videoWidth) return;
    stopCamera();
    const frame = captureVideoFrame(videoRef.current);
    await processSource(frame);
  }

  async function handleCameraFile(file: File) {
    stopCamera();
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(url);
      await processSource(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("تعذّر قراءة الصورة");
      setPhase("init");
    };
    img.src = url;
  }

  function confirmScan() {
    if (!previewCanvas) return;
    const ts = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
    const pdf = canvasToPdfFile(previewCanvas, `مسح-${ts}`);
    onScanned(pdf);
    onClose();
  }

  function retry() {
    setPreviewCanvas(null);
    setHighlightUrl(null);
    void startCamera();
  }

  return (
    <div className="space-y-4 rounded-card border border-brand-200/60 bg-gradient-to-b from-brand-50/80 to-white p-4 ring-1 ring-brand-100">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-brand-900">
          <ScanLine className="h-4 w-4 text-brand-600" aria-hidden />
          مسح وثيقة بالكاميرا
        </div>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="btn-ghost p-1.5 text-slate-400"
          aria-label="إغلاق المسح"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <p className="text-xs text-slate-500">
        ضع الوثيقة على سطح بلون موحّد. سيتم اكتشاف الحدود تلقائيًا وتحويلها إلى
        PDF قبل الرفع.
      </p>

      {phase === "init" && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void startCamera()}
            disabled={libsLoading}
            className="btn-primary w-full gap-2"
          >
            {libsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Camera className="h-4 w-4" aria-hidden />
            )}
            {libsLoading ? "جارٍ تحميل أدوات المسح…" : "تشغيل الكاميرا المباشرة"}
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="btn-secondary w-full gap-2"
          >
            <Camera className="h-4 w-4" aria-hidden />
            التقاط صورة بالكاميرا
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleCameraFile(file);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {phase === "camera" && (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-line bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-[3/4] w-full object-cover sm:aspect-video"
            />
          </div>
          <button
            type="button"
            onClick={() => void captureFromVideo()}
            className="btn-primary w-full gap-2"
          >
            <ScanLine className="h-4 w-4" aria-hidden />
            التقاط ومسح الوثيقة
          </button>
        </div>
      )}

      {phase === "processing" && (
        <div className="flex flex-col items-center gap-2 py-8 text-sm text-slate-600">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" aria-hidden />
          جارٍ اكتشاف الحدود وتصحيح المنظور…
        </div>
      )}

      {phase === "preview" && previewCanvas && (
        <div className="space-y-3">
          {highlightUrl && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">
                الحدود المكتشفة
              </p>
              <img
                src={highlightUrl}
                alt="معاينة الحدود"
                className="max-h-32 w-full rounded-lg border border-line object-contain"
              />
            </div>
          )}
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">
              النتيجة بعد التصحيح
            </p>
            <img
              src={previewCanvas.toDataURL("image/jpeg", 0.9)}
              alt="معاينة الوثيقة الممسوحة"
              className="max-h-64 w-full rounded-lg border border-line bg-white object-contain shadow-card"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmScan}
              className="btn-primary gap-2"
            >
              <Check className="h-4 w-4" aria-hidden />
              إضافة كـ PDF
            </button>
            <button type="button" onClick={retry} className="btn-secondary gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden />
              إعادة المسح
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            "border-amber-200 bg-amber-50 text-amber-800",
          )}
        >
          {error}
        </div>
      )}
    </div>
  );
}
