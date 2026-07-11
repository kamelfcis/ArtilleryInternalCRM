import os from "node:os";
import path from "node:path";
import type { Worker } from "tesseract.js";

/**
 * Shared Tesseract worker (Arabic + English). Creating a worker loads several
 * MB of language data, so the whole run reuses ONE worker — call `ocrImage`
 * per page and `shutdownOcr` once at the end. Trained-data is cached under
 * `.cache/tesseract` locally or `/tmp/tesseract` on Vercel (read-only cwd).
 */

function tesseractCacheDir(): string {
  if (process.env.VERCEL) return path.join(os.tmpdir(), "tesseract");
  return path.resolve(process.cwd(), ".cache", "tesseract");
}

const LANGS = ["ara", "eng"];

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return createWorker(LANGS, undefined, {
        cachePath: tesseractCacheDir(),
        gzip: true,
      });
    })();
  }
  return workerPromise;
}

export interface OcrOutput {
  text: string;
  /** Tesseract confidence, 0–100. */
  confidence: number;
}

/** OCR a raster image (PNG/JPEG buffer). */
export async function ocrImage(image: Buffer): Promise<OcrOutput> {
  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  return {
    text: data.text.trim(),
    confidence: Number.isFinite(data.confidence) ? data.confidence : 0,
  };
}

/** Terminate the shared worker and free its resources. Safe to call twice. */
export async function shutdownOcr(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  workerPromise = null;
  await worker.terminate();
}
