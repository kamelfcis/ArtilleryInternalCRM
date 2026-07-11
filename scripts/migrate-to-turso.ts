/**
 * One-off migration: copy all rows from local SQLite (prisma/dev.db) to Turso.
 *
 * Usage (from project root, with Turso env set):
 *   set TURSO_DATABASE_URL=libsql://...
 *   set TURSO_AUTH_TOKEN=...
 *   npm run migrate:turso
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import path from "node:path";

const LOCAL_DB = path.join(process.cwd(), "prisma", "dev.db");

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing ${name}. Set Turso credentials before running.`);
    process.exit(1);
  }
  return v;
}

function createLocalClient(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: `file:${LOCAL_DB}` } },
  });
}

function createTursoClient(): PrismaClient {
  const url = requireEnv("TURSO_DATABASE_URL");
  const authToken = requireEnv("TURSO_AUTH_TOKEN");
  const libsql = createClient({ url, authToken });
  const adapter = new PrismaLibSQL(libsql);
  return new PrismaClient({ adapter });
}

async function copyMany<T>(
  label: string,
  load: () => Promise<T[]>,
  save: (batch: T[]) => Promise<{ count: number }>,
): Promise<void> {
  const rows = await load();
  if (rows.length === 0) {
    console.log(`  ${label}: 0 rows (skip)`);
    return;
  }
  const BATCH = 100;
  let copied = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const result = await save(batch);
    copied += result.count;
  }
  console.log(`  ${label}: ${copied}/${rows.length} rows`);
}

async function main() {
  const local = createLocalClient();
  const remote = createTursoClient();

  const existing = await remote.user.count();
  if (existing > 0) {
    console.warn(
      `Turso already has ${existing} user(s). Re-run uses skipDuplicates; verify data before continuing.`,
    );
  }

  console.log("Migrating SQLite -> Turso...");

  await copyMany("User", () => local.user.findMany(), (data) =>
    remote.user.createMany({ data }),
  );

  const folders = await local.folder.findMany();
  folders.sort((a, b) => a.depth - b.depth);
  await copyMany("Folder", async () => folders, (data) =>
    remote.folder.createMany({ data }),
  );

  await copyMany("Document", () => local.document.findMany(), (data) =>
    remote.document.createMany({ data }),
  );
  await copyMany("DocumentVersion", () => local.documentVersion.findMany(), (data) =>
    remote.documentVersion.createMany({ data }),
  );
  await copyMany("FolderPermission", () => local.folderPermission.findMany(), (data) =>
    remote.folderPermission.createMany({ data }),
  );
  await copyMany("AuditLog", () => local.auditLog.findMany(), (data) =>
    remote.auditLog.createMany({ data }),
  );
  await copyMany("Site", () => local.site.findMany(), (data) =>
    remote.site.createMany({ data }),
  );
  await copyMany("Company", () => local.company.findMany(), (data) =>
    remote.company.createMany({ data }),
  );
  await copyMany("Project", () => local.project.findMany(), (data) =>
    remote.project.createMany({ data }),
  );
  await copyMany("Practice", () => local.practice.findMany(), (data) =>
    remote.practice.createMany({ data }),
  );
  await copyMany("Contract", () => local.contract.findMany(), (data) =>
    remote.contract.createMany({ data }),
  );
  await copyMany("Purchase", () => local.purchase.findMany(), (data) =>
    remote.purchase.createMany({ data }),
  );
  await copyMany("Approval", () => local.approval.findMany(), (data) =>
    remote.approval.createMany({ data }),
  );
  await copyMany("ApprovalTransition", () => local.approvalTransition.findMany(), (data) =>
    remote.approvalTransition.createMany({ data }),
  );
  await copyMany("Notification", () => local.notification.findMany(), (data) =>
    remote.notification.createMany({ data }),
  );
  await copyMany("Task", () => local.task.findMany(), (data) =>
    remote.task.createMany({ data }),
  );
  await copyMany("ImportJob", () => local.importJob.findMany(), (data) =>
    remote.importJob.createMany({ data }),
  );
  await copyMany("ImportFile", () => local.importFile.findMany(), (data) =>
    remote.importFile.createMany({ data }),
  );
  await copyMany("DocumentText", () => local.documentText.findMany(), (data) =>
    remote.documentText.createMany({ data }),
  );
  await copyMany("DocumentExtraction", () => local.documentExtraction.findMany(), (data) =>
    remote.documentExtraction.createMany({ data }),
  );
  await copyMany("DocumentField", () => local.documentField.findMany(), (data) =>
    remote.documentField.createMany({ data }),
  );
  await copyMany("DocumentLink", () => local.documentLink.findMany(), (data) =>
    remote.documentLink.createMany({ data }),
  );
  await copyMany("CrmRecordProvenance", () => local.crmRecordProvenance.findMany(), (data) =>
    remote.crmRecordProvenance.createMany({ data }),
  );

  console.log("Migration complete.");
  await local.$disconnect();
  await remote.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
