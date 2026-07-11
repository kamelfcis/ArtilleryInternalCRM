import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

/**
 * SHA-256 of a file's bytes, computed by streaming so large files never need to
 * be buffered in memory. This checksum is the import dedup key: identical
 * content is imported at most once, and reruns skip already-imported files.
 */
export function fileChecksum(absPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(absPath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
