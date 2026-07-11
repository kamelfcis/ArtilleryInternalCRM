/**
 * Database seed. Bootstraps:
 *   1. The initial system administrator (credentials from .env).
 *   2. The department's core business folders (top-level system entities),
 *      mirroring the existing Google Drive structure.
 *
 * Idempotent: running it repeatedly will not create duplicates. Kept
 * self-contained (no imports of `server-only` Next.js modules) so it runs
 * under plain `tsx`.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CORE_BUSINESS_ENTITIES } from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  const adminName = process.env.SEED_ADMIN_NAME ?? "مدير النظام";
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@artillery.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";

  // --- Admin user ---------------------------------------------------------
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      jobTitle: "مدير النظام",
      isActive: true,
    },
  });
  console.log(`✔ Administrator ready: ${admin.email}`);

  // --- Core business folders (top-level, system) --------------------------
  let created = 0;
  for (const entity of CORE_BUSINESS_ENTITIES) {
    const existing = await prisma.folder.findFirst({
      where: { name: entity.name, parentId: null, deletedAt: null },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.folder.create({
      data: {
        name: entity.name,
        description: entity.description,
        color: entity.color,
        parentId: null,
        path: "/",
        depth: 0,
        isSystem: true,
        createdById: admin.id,
      },
    });
    created += 1;
  }
  console.log(`✔ Core business folders ensured (${created} newly created)`);

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "CREATE_USER",
      entityType: "USER",
      entityId: admin.id,
      summary: "تهيئة النظام وإنشاء حساب المدير والمجلدات الأساسية",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
