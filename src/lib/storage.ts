import "server-only";
import { createReadStream, type ReadStream } from "node:fs";
import { mkdir, writeFile, unlink, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { del, get, head, put } from "@vercel/blob";
import { env } from "@/lib/env";

const STORAGE_ROOT = path.resolve(process.cwd(), env.STORAGE_ROOT);

function useBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  return token;
}

/** Resolve a storage key to an absolute path, guarding against traversal. */
function resolveKey(key: string): string {
  const normalized = path
    .normalize(key)
    .replace(/^([/\\])+/, "")
    .replace(/\\/g, "/");
  const abs = path.resolve(STORAGE_ROOT, normalized);
  if (!abs.startsWith(STORAGE_ROOT + path.sep) && abs !== STORAGE_ROOT) {
    throw new Error("Invalid storage key (path traversal detected)");
  }
  return abs;
}

/** Generate a unique storage key partitioned by year/month. */
export function generateStorageKey(extension: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const id = randomBytes(16).toString("hex");
  const ext = extension ? `.${extension.toLowerCase()}` : "";
  return `${year}/${month}/${id}${ext}`;
}

/** Persist a buffer under a freshly generated key; returns the key. */
export async function saveBuffer(
  buffer: Buffer,
  extension: string,
): Promise<string> {
  const key = generateStorageKey(extension);
  if (useBlobStorage()) {
    await put(key, buffer, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      token: blobToken(),
    });
    return key;
  }

  const abs = resolveKey(key);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
  return key;
}

/** Open a read stream for a stored file (downloads / preview). */
export async function openReadStream(key: string): Promise<ReadStream> {
  if (useBlobStorage()) {
    const result = await get(key, {
      access: "private",
      token: blobToken(),
    });
    if (!result?.stream) {
      throw new Error(`Blob not found for key: ${key}`);
    }
    return Readable.fromWeb(
      result.stream as unknown as import("node:stream/web").ReadableStream,
    ) as ReadStream;
  }

  return createReadStream(resolveKey(key));
}

/** Read a stored file fully into memory (OCR pipeline). */
export async function readStored(key: string): Promise<Buffer> {
  if (useBlobStorage()) {
    const result = await get(key, {
      access: "private",
      token: blobToken(),
    });
    if (!result?.stream) {
      throw new Error(`Blob not found for key: ${key}`);
    }
    const ab = await new Response(result.stream).arrayBuffer();
    return Buffer.from(ab);
  }

  return readFile(resolveKey(key));
}

/** Return the byte size of a stored file. */
export async function getStoredSize(key: string): Promise<number> {
  if (useBlobStorage()) {
    const info = await head(key, { token: blobToken() });
    return info.size;
  }

  const info = await stat(resolveKey(key));
  return info.size;
}

/** Delete a stored file. Missing files are ignored (idempotent). */
export async function deleteStored(key: string): Promise<void> {
  if (useBlobStorage()) {
    try {
      await del(key, { token: blobToken() });
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === "BlobNotFoundError") return;
      throw error;
    }
    return;
  }

  try {
    await unlink(resolveKey(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
