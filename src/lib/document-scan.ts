"use client";

import { jsPDF } from "jspdf";

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

/** Convert an image file to PDF without border detection or perspective correction. */
export async function imageFileToPdf(file: File): Promise<File> {
  const img = await fileToImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذّر معالجة الصورة");
  ctx.drawImage(img, 0, 0);
  const stem = file.name.replace(/\.[^.]+$/, "") || `صورة-${Date.now()}`;
  return canvasToPdfFile(canvas, stem);
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
  const safeName = baseName.replace(/\.[^.]+$/, "") || "وثيقة";
  return new File([blob], `${safeName}.pdf`, { type: "application/pdf" });
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
