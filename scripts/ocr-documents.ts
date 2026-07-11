import "./server-only-shim.cjs"; // must run before any server-only module loads
import { prisma } from "@/lib/prisma";
import { runOcr, resolveImportActor, type OcrEvent } from "@/lib/ocr/service";

/**
 * CLI: `npm run ocr:documents [-- options]`
 *
 * Extracts raw text from every stored document (PDF text layer or Tesseract OCR,
 * plus Word/Excel/text parsers) into the DocumentText table. Idempotent and
 * resumable — a rerun skips documents whose content is unchanged.
 *
 * Options:
 *   --force               re-extract even if the stored text is up to date
 *   --limit <n>           process at most n documents (useful for a smoke test)
 *   --document <id>       process only the given document id
 */

interface CliOptions {
  force: boolean;
  limit?: number;
  documentId?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { force: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--force") opts.force = true;
    else if (arg === "--limit") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n <= 0) throw new Error("قيمة --limit غير صحيحة");
      opts.limit = n;
    } else if (arg === "--document") {
      opts.documentId = argv[++i];
      if (!opts.documentId) throw new Error("قيمة --document مفقودة");
    } else {
      throw new Error(`خيار غير معروف: ${arg}`);
    }
  }
  return opts;
}

function progressLine(e: Extract<OcrEvent, { type: "progress" }>): string {
  return `\r[${e.done}/${e.total}]  ✔ مستخرج: ${e.extracted}  ·  ⏭ متخطى: ${e.skipped}  ·  ⃠ غير مدعوم: ${e.unsupported}  ·  ✖ أخطاء: ${e.failed}   `;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const actor = await resolveImportActor();

  console.log("════════════════════════════════════════════");
  console.log("   استخراج النصوص من مستندات نظام المدفعية");
  console.log("════════════════════════════════════════════");
  console.log(`المستخدم: ${actor.name}`);
  if (opts.force) console.log("الوضع:   إعادة استخراج إجبارية (--force)");
  if (opts.limit) console.log(`الحد:     ${opts.limit} مستند`);
  if (opts.documentId) console.log(`مستند:   ${opts.documentId}`);
  console.log("");

  const failures: { name: string; reason?: string }[] = [];

  const onEvent = (e: OcrEvent) => {
    switch (e.type) {
      case "scanning":
        process.stdout.write("🔍 جارٍ الفحص...\n");
        break;
      case "scanned":
        console.log(`   عدد المستندات: ${e.total}`);
        console.log("");
        process.stdout.write("🧠 جارٍ الاستخراج (قد يستغرق وقتًا مع التعرّف الضوئي)...\n");
        break;
      case "document":
        if (e.status === "failed") failures.push({ name: e.name, reason: e.reason });
        break;
      case "progress":
        process.stdout.write(progressLine(e));
        break;
      case "done":
        process.stdout.write("\n\n");
        console.log("✅ اكتمل الاستخراج");
        console.log("────────────────────────────");
        console.log(`تم الاستخراج : ${e.extracted}`);
        console.log(`تم التخطي    : ${e.skipped}`);
        console.log(`غير مدعوم    : ${e.unsupported}`);
        console.log(`أخطاء        : ${e.failed}`);
        break;
    }
  };

  const counts = await runOcr({
    actorId: actor.id,
    force: opts.force,
    documentId: opts.documentId,
    limit: opts.limit,
    onEvent,
  });

  if (failures.length > 0) {
    console.log("");
    console.log("المستندات التي فشل استخراجها:");
    for (const f of failures.slice(0, 30)) {
      console.log(`  ✖ ${f.name}${f.reason ? ` — ${f.reason}` : ""}`);
    }
    if (failures.length > 30) console.log(`  … و ${failures.length - 30} مستندًا آخر`);
  }

  await prisma.$disconnect();
  process.exit(counts.failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error("\n✖ فشل الاستخراج:", error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
