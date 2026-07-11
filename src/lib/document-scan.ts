"use client";

import { jsPDF } from "jspdf";

const OPENCV_CDN = "https://docs.opencv.org/4.7.0/opencv.js";
const JSCANIFY_CDN =
  "https://cdn.jsdelivr.net/npm/jscanify@1.4.2/src/jscanify.js";

let scannerReady: Promise<void> | null = null;

declare global {
  interface Window {
    cv?: {
      onRuntimeInitialized?: () => void;
      imread: (el: HTMLImageElement | HTMLCanvasElement) => unknown;
      Mat: new () => unknown;
    };
    jscanify?: new () => JscanifyScanner;
  }
}

interface JscanifyScanner {
  highlightPaper(
    image: HTMLImageElement | HTMLCanvasElement,
    options?: { color?: string; thickness?: number },
  ): HTMLCanvasElement;
  extractPaper(
    image: HTMLImageElement | HTMLCanvasElement,
    width: number,
    height: number,
  ): HTMLCanvasElement | null;
}

/** Load OpenCV.js + jscanify from CDN once (keeps main bundle small). */
export function ensureScannerLibs(): Promise<void> {
  if (scannerReady) return scannerReady;

  scannerReady = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("المسح الضوئي متاح في المتصفح فقط"));
      return;
    }

    const finish = () => {
      if (window.cv && window.jscanify) resolve();
      else reject(new Error("تعذّر تحميل مكتبات المسح"));
    };

    const loadScript = (src: string) =>
      new Promise<void>((res, rej) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          res();
          return;
        }
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => res();
        s.onerror = () => rej(new Error(`فشل تحميل ${src}`));
        document.head.appendChild(s);
      });

    void (async () => {
      try {
        await loadScript(OPENCV_CDN);
        await new Promise<void>((res) => {
          if (window.cv?.Mat) {
            res();
            return;
          }
          const prev = window.cv?.onRuntimeInitialized;
          if (window.cv) {
            window.cv.onRuntimeInitialized = () => {
              prev?.();
              res();
            };
          } else {
            res();
          }
        });
        await loadScript(JSCANIFY_CDN);
        finish();
      } catch (err) {
        scannerReady = null;
        reject(err);
      }
    })();
  });

  return scannerReady;
}

/** Read a File/Blob as an HTMLImageElement. */
export function fileToImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("تعذّر قراءة الصورة"));
    };
    img.src = url;
  });
}

/** Capture the current video frame to a canvas. */
export function captureVideoFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذّر التقاط الإطار");
  ctx.drawImage(video, 0, 0);
  return canvas;
}

/**
 * Detect document edges, perspective-correct, and return a flattened canvas.
 * Falls back to the source image when detection fails.
 */
export async function extractDocument(
  source: HTMLImageElement | HTMLCanvasElement,
): Promise<HTMLCanvasElement> {
  await ensureScannerLibs();
  const scanner = new window.jscanify!();

  const w = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const h = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const longEdge = Math.max(w, h);
  const outW = Math.round(longEdge * 0.85);
  const outH = Math.round((h / w) * outW);

  const extracted = scanner.extractPaper(source, outW, outH);
  if (extracted) return extracted;

  const fallback = document.createElement("canvas");
  fallback.width = w;
  fallback.height = h;
  const ctx = fallback.getContext("2d");
  if (ctx) ctx.drawImage(source, 0, 0, w, h);
  return fallback;
}

/** Highlight detected paper edges on a canvas (for live preview). */
export async function highlightDocument(
  source: HTMLImageElement | HTMLCanvasElement,
): Promise<HTMLCanvasElement> {
  await ensureScannerLibs();
  const scanner = new window.jscanify!();
  return scanner.highlightPaper(source, { color: "#2f66b5", thickness: 8 });
}

/** Convert a canvas to a JPEG-backed PDF File. */
export function canvasToPdfFile(
  canvas: HTMLCanvasElement,
  baseName: string,
): File {
  const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
  const pdf = new jsPDF({
    orientation,
    unit: "px",
    format: [canvas.width, canvas.height],
  });
  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
  const blob = pdf.output("blob");
  const safeName = baseName.replace(/\.[^.]+$/, "") || "مسح-وثيقة";
  return new File([blob], `${safeName}.pdf`, { type: "application/pdf" });
}

/** Full pipeline: image file → border detect → PDF. */
export async function scanImageFileToPdf(file: File): Promise<File> {
  const img = await fileToImage(file);
  const canvas = await extractDocument(img);
  const stem = file.name.replace(/\.[^.]+$/, "") || `مسح-${Date.now()}`;
  return canvasToPdfFile(canvas, stem);
}

/** Assign files to a hidden file input for form submission. */
export function assignFilesToInput(
  input: HTMLInputElement,
  files: File[],
): void {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  input.files = dt.files;
}

/** Whether a mime/extension can show an image thumbnail. */
export function isImageMime(mime: string, ext?: string | null): boolean {
  if (mime.startsWith("image/")) return true;
  const e = (ext ?? "").toLowerCase();
  return e === "png" || e === "jpg" || e === "jpeg";
}

export function isPdfMime(mime: string, ext?: string | null): boolean {
  if (mime === "application/pdf") return true;
  return (ext ?? "").toLowerCase() === "pdf";
}

/** Create an object URL preview for a local File. Caller must revoke when done. */
export function previewUrlForFile(file: File): string {
  return URL.createObjectURL(file);
}
