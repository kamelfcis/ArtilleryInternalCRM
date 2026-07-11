/**
 * Clear append-only / job-history log tables. Does not touch business data.
 *
 * Clears:
 *   - AuditLog        (global audit trail at /admin/audit)
 *   - ImportJob       (document import runs; ImportFile rows cascade)
 *
 * Preserves:
 *   users, folders, documents, CRM records, tasks, notifications, approvals,
 *   OCR text (DocumentText), extractions, links, provenance, permissions, etc.
 *
 * Usage:
 *   npm run db:clear-logs                 # local SQLite (DATABASE_URL / prisma/dev.db)
 *   npm run db:clear-logs -- --turso      # Turso production (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
 *   npm run db:clear-logs -- --dry-run    # show counts only, no deletes
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import path from "node:path";

type Target = "local" | "turso";

interface CliOptions {
  target: Target;
  dryRun: boolean;
}

interface LogTable {
  name: string;
  count: () => Promise<number>;
  clear: () => Promise<{ count: number }>;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { target: "local", dryRun: false };
  for (const arg of argv) {
    if (arg === "--turso") opts.target = "turso";
    else if (arg === "--local") opts.target = "local";
    else if (arg === "--dry-run") opts.dryRun = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return opts;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}. Set Turso credentials before using --turso.`);
    process.exit(1);
  }
  return value;
}

function createClientForTarget(target: Target): PrismaClient {
  if (target === "turso") {
    const url = requireEnv("TURSO_DATABASE_URL");
    const authToken = requireEnv("TURSO_AUTH_TOKEN");
    const libsql = createClient({ url, authToken });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter });
  }

  const databaseUrl =
    process.env.DATABASE_URL?.trim() ||
    `file:${path.join(process.cwd(), "prisma", "dev.db")}`;

  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
}

function logTables(prisma: PrismaClient): LogTable[] {
  return [
    {
      name: "AuditLog",
      count: () => prisma.auditLog.count(),
      clear: () => prisma.auditLog.deleteMany(),
    },
    {
      name: "ImportJob",
      count: () => prisma.importJob.count(),
      // ImportFile has onDelete: Cascade from ImportJob.
      clear: () => prisma.importJob.deleteMany(),
    },
  ];
}

async function countImportFiles(prisma: PrismaClient): Promise<number> {
  return prisma.importFile.count();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const prisma = createClientForTarget(opts.target);

  const targetLabel =
    opts.target === "turso"
      ? `Turso (${process.env.TURSO_DATABASE_URL})`
      : process.env.DATABASE_URL?.trim() ||
        `file:${path.join(process.cwd(), "prisma", "dev.db")}`;

  console.log(`Target: ${targetLabel}`);
  console.log(opts.dryRun ? "Mode: dry-run (no deletes)\n" : "Mode: delete\n");

  const tables = logTables(prisma);
  const auditTable = tables.find((t) => t.name === "AuditLog");
  const importJobTable = tables.find((t) => t.name === "ImportJob");
  if (!auditTable || !importJobTable) {
    throw new Error("Expected AuditLog and ImportJob log tables");
  }
  const before: Record<string, number> = {};

  before.AuditLog = await auditTable.count();
  before.ImportFile = await countImportFiles(prisma);
  before.ImportJob = await importJobTable.count();

  console.log("Before:");
  console.log(`  AuditLog:    ${before.AuditLog}`);
  console.log(`  ImportFile:  ${before.ImportFile} (cleared via ImportJob cascade)`);
  console.log(`  ImportJob:   ${before.ImportJob}`);

  const totalBefore = before.AuditLog + before.ImportFile + before.ImportJob;
  if (totalBefore === 0) {
    console.log("\nNo log rows to delete. Done.");
    await prisma.$disconnect();
    return;
  }

  if (opts.dryRun) {
    console.log(`\nDry-run: would delete ${totalBefore} row(s).`);
    await prisma.$disconnect();
    return;
  }

  let deletedAudit = 0;
  let deletedJobs = 0;

  deletedAudit = (await auditTable.clear()).count;
  deletedJobs = (await importJobTable.clear()).count;

  const afterAudit = await auditTable.count();
  const afterImportFile = await countImportFiles(prisma);
  const afterImportJob = await importJobTable.count();

  console.log("\nDeleted:");
  console.log(`  AuditLog:    ${deletedAudit}`);
  console.log(`  ImportJob:   ${deletedJobs} (ImportFile cascade: ${before.ImportFile})`);

  console.log("\nAfter:");
  console.log(`  AuditLog:    ${afterAudit}`);
  console.log(`  ImportFile:  ${afterImportFile}`);
  console.log(`  ImportJob:   ${afterImportJob}`);

  if (afterAudit === 0 && afterImportFile === 0 && afterImportJob === 0) {
    console.log("\nAll log tables cleared.");
  } else {
    console.warn("\nWarning: some rows remain — verify manually.");
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
