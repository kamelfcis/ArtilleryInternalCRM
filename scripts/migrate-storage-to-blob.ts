/**
 * Upload local ./storage files to Vercel Blob using DB storage keys.
 *
 * Usage:
 *   set BLOB_READ_WRITE_TOKEN=...
 *   set TURSO_DATABASE_URL=...  (or DATABASE_URL=file:./prisma/dev.db for local DB)
 *   set TURSO_AUTH_TOKEN=...
 *   npm run migrate:blob
 */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

function createDbClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (tursoUrl && tursoToken) {
    const libsql = createClient({ url: tursoUrl, authToken: tursoToken });
    return new PrismaClient({ adapter: new PrismaLibSQL(libsql) });
  }
  return new PrismaClient({
    datasources: { db: { url: "file:./prisma/dev.db" } },
  });
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    console.error("BLOB_READ_WRITE_TOKEN is required.");
    process.exit(1);
  }

  const prisma = createDbClient();
  const storageRoot = path.resolve(process.cwd(), process.env.STORAGE_ROOT ?? "./storage");

  const docs = await prisma.document.findMany({ select: { storageKey: true } });
  const versions = await prisma.documentVersion.findMany({ select: { storageKey: true } });
  const keys = [...new Set([...docs.map((d) => d.storageKey), ...versions.map((v) => v.storageKey)])];

  let uploaded = 0;
  let missing = 0;
  let failed = 0;

  for (const key of keys) {
    const abs = path.join(storageRoot, key.replace(/\\/g, "/"));
    try {
      await stat(abs);
    } catch {
      missing++;
      console.warn(`Missing file: ${key}`);
      continue;
    }

    try {
      const body = await readFile(abs);
      await put(key, body, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        token,
      });
      uploaded++;
      if (uploaded % 25 === 0) console.log(`Uploaded ${uploaded}/${keys.length}...`);
    } catch (err) {
      failed++;
      console.error(`Failed ${key}:`, err);
    }
  }

  console.log(`Done. keys=${keys.length} uploaded=${uploaded} missing=${missing} failed=${failed}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
