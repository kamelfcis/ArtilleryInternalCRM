import "./server-only-shim.cjs"; // must run before any server-only module loads
import path from "node:path";
import { stat } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import {
  runImport,
  resolveImportActor,
  type ImportEvent,
} from "@/lib/import/service";

/**
 * CLI: `npm run import:documents [sourceDir]`
 *
 * Recursively imports the local Documents folder into the CRM, reusing the
 * existing folder + document services (audit events included). Idempotent and
 * resumable — safe to re-run. Source defaults to the "دار المدفعية" folder at
 * the project root; override via argv[2] or DOCS_SOURCE_DIR.
 */

const DEFAULT_SOURCE = "دار المدفعية";

function progressLine(e: Extract<ImportEvent, { type: "progress" }>): string {
  return `\r[${e.done}/${e.total}]  ✔ مستورد: ${e.imported}  ·  ⏭ متخطى: ${e.skipped}  ·  ✖ أخطاء: ${e.failed}   `;
}

async function main() {
  const argSource = process.argv[2];
  const sourceRoot = path.resolve(
    process.cwd(),
    argSource ?? process.env.DOCS_SOURCE_DIR ?? DEFAULT_SOURCE,
  );

  try {
    const info = await stat(sourceRoot);
    if (!info.isDirectory()) throw new Error("ليس مجلدًا");
  } catch {
    console.error(`✖ مجلد المصدر غير موجود: ${sourceRoot}`);
    console.error("  حدّد المسار: npm run import:documents -- \"<path>\"");
    await prisma.$disconnect();
    process.exit(1);
  }

  const actor = await resolveImportActor();

  console.log("════════════════════════════════════════════");
  console.log("   استيراد المستندات إلى نظام إدارة المدفعية");
  console.log("════════════════════════════════════════════");
  console.log(`المصدر:   ${sourceRoot}`);
  console.log(`المستورِد: ${actor.name}`);
  console.log("");

  const failures: { relPath: string; reason?: string }[] = [];

  const onEvent = (e: ImportEvent) => {
    switch (e.type) {
      case "scanning":
        process.stdout.write("🔍 جارٍ الفحص...\n");
        break;
      case "scanned":
        console.log(`   تم العثور على ${e.files} ملف داخل ${e.folders} مجلد.`);
        console.log("");
        process.stdout.write("⬇️  جارٍ الاستيراد...\n");
        break;
      case "file":
        if (e.status === "failed") failures.push({ relPath: e.relPath, reason: e.reason });
        break;
      case "progress":
        process.stdout.write(progressLine(e));
        break;
      case "done":
        process.stdout.write("\n\n");
        console.log("✅ اكتمل الاستيراد");
        console.log("────────────────────────────");
        console.log(`إجمالي الملفات : ${e.total}`);
        console.log(`تم الاستيراد   : ${e.imported}`);
        console.log(`تم التخطي      : ${e.skipped}`);
        console.log(`أخطاء          : ${e.failed}`);
        console.log(`رقم المهمة     : ${e.jobId}`);
        break;
    }
  };

  const job = await runImport({ sourceRoot, actorId: actor.id, onEvent });

  if (failures.length > 0) {
    console.log("");
    console.log("الملفات التي فشل استيرادها:");
    for (const f of failures.slice(0, 30)) {
      console.log(`  ✖ ${f.relPath}${f.reason ? ` — ${f.reason}` : ""}`);
    }
    if (failures.length > 30) console.log(`  … و ${failures.length - 30} ملفًا آخر`);
  }

  await prisma.$disconnect();
  process.exit(job.status === "COMPLETED" ? 0 : 1);
}

main().catch(async (error) => {
  console.error("\n✖ فشل الاستيراد:", error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
