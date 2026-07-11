import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getExtension } from "@/lib/utils";

/**
 * Recursive filesystem scanner. Walks a source directory depth-first and yields
 * one descriptor per regular file, carrying the folder segments (relative to the
 * root) needed to recreate the exact hierarchy in the database. Hidden entries
 * (dot-prefixed) are ignored. No database or side effects here — pure scan.
 */

export interface ScannedFile {
  /** Absolute path on disk. */
  absPath: string;
  /** POSIX path relative to the scan root, e.g. "الحديقة/أعمال/العقد.pdf". */
  relPath: string;
  /** Folder names from the root down to this file's parent. */
  segments: string[];
  /** File name including extension. */
  name: string;
  /** Lowercase extension without dot, or null. */
  extension: string | null;
  size: number;
  createdAt: Date | null;
  modifiedAt: Date | null;
}

export interface ScanResult {
  files: ScannedFile[];
  /** Count of distinct folders discovered under the root. */
  folderCount: number;
}

/** Scan a directory tree, returning every file with its folder segments. */
export async function scanDirectory(root: string): Promise<ScanResult> {
  const files: ScannedFile[] = [];
  const folders = new Set<string>();

  async function walk(dir: string, segments: string[]): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "ar"));

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue; // skip hidden files/folders
      const abs = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const next = [...segments, entry.name];
        folders.add(next.join("/"));
        await walk(abs, next);
      } else if (entry.isFile()) {
        const info = await stat(abs);
        const ext = getExtension(entry.name);
        files.push({
          absPath: abs,
          relPath: [...segments, entry.name].join("/"),
          segments,
          name: entry.name,
          extension: ext || null,
          size: info.size,
          createdAt: info.birthtime ?? null,
          modifiedAt: info.mtime ?? null,
        });
      }
    }
  }

  await walk(root, []);
  return { files, folderCount: folders.size };
}
