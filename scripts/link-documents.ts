import "./server-only-shim.cjs"; // must run before any server-only module loads
import { prisma } from "@/lib/prisma";
import {
  runLinking,
  resolveImportActor,
  type LinkEvent,
} from "@/lib/linking/service";

/**
 * CLI: `npm run link:documents [-- options]`
 *
 * Links each extracted document (Phase 4.3) to the CRM records it references —
 * matching contract/purchase/practice numbers exactly and company/project/site
 * names fuzzily — and stores each match as a SUGGESTED DocumentLink for review.
 * The linker never mutates CRM records and preserves human-confirmed/rejected
 * and manual links. Idempotent and resumable — a rerun skips documents whose
 * computed links are unchanged.
 *
 * Options:
 *   --force               re-link even if the stored links are up to date
 *   --limit <n>           process at most n documents
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

function progressLine(e: Extract<LinkEvent, { type: "progress" }>): string {
  return `\r[${e.done}/${e.total}]  🔗 مرتبط: ${e.linked}  ·  ○ بدون تطابق: ${e.unmatched}  ·  ⏭ متخطى: ${e.skipped}  ·  ✖ أخطاء: ${e.failed}   `;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const actor = await resolveImportActor();

  console.log("════════════════════════════════════════════");
  console.log("   الربط الذكي للمستندات بسجلات المدفعية");
  console.log("════════════════════════════════════════════");
  console.log(`المستخدم: ${actor.name}`);
  if (opts.force) console.log("الوضع:   إعادة ربط إجبارية (--force)");
  if (opts.limit) console.log(`الحد:     ${opts.limit} مستند`);
  if (opts.documentId) console.log(`مستند:   ${opts.documentId}`);
  console.log("");

  const failures: { name: string; reason?: string }[] = [];

  const onEvent = (e: LinkEvent) => {
    switch (e.type) {
      case "scanning":
        process.stdout.write("🔍 جارٍ فحص السجلات والمستندات...\n");
        break;
      case "scanned":
        console.log(`   عدد المستندات المُستخرَجة: ${e.total}`);
        console.log("");
        process.stdout.write("🔗 جارٍ الربط...\n");
        break;
      case "document":
        if (e.status === "failed") failures.push({ name: e.name, reason: e.reason });
        break;
      case "progress":
        process.stdout.write(progressLine(e));
        break;
      case "done":
        process.stdout.write("\n\n");
        console.log("✅ اكتمل الربط");
        console.log("────────────────────────────");
        console.log(`تم الربط     : ${e.linked}`);
        console.log(`بدون تطابق   : ${e.unmatched}`);
        console.log(`تم التخطي    : ${e.skipped}`);
        console.log(`أخطاء        : ${e.failed}`);
        break;
    }
  };

  const counts = await runLinking({
    actorId: actor.id,
    force: opts.force,
    documentId: opts.documentId,
    limit: opts.limit,
    onEvent,
  });

  if (failures.length > 0) {
    console.log("");
    console.log("المستندات التي فشل ربطها:");
    for (const f of failures.slice(0, 30)) {
      console.log(`  ✖ ${f.name}${f.reason ? ` — ${f.reason}` : ""}`);
    }
    if (failures.length > 30) console.log(`  … و ${failures.length - 30} مستندًا آخر`);
  }

  await prisma.$disconnect();
  process.exit(counts.failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error("\n✖ فشل الربط:", error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
