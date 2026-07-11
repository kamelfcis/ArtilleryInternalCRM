import "./server-only-shim.cjs"; // must run before any server-only module loads
import { prisma } from "@/lib/prisma";
import { resolveImportActor } from "@/lib/import/service";
import { runBootstrap } from "@/lib/bootstrap/service";
import type { BootstrapEvent, KindReport } from "@/lib/bootstrap/types";

/**
 * CLI: `npm run bootstrap:crm [-- options]`
 *
 * Smart CRM Bootstrap (Phase 5.1). Seeds the CRM catalog from real AI extraction
 * results — companies, projects and sites from extracted entity names — never
 * fabricated data. De-duplicates against the existing catalog with the linker's
 * own matching so nothing is duplicated, records provenance for every created
 * record, emits domain events + audit entries, then reruns the linker and prints
 * a detailed report.
 *
 * Options:
 *   --dry-run   compute and print the full report without writing anything
 */

interface CliOptions {
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: false };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else throw new Error(`خيار غير معروف: ${arg}`);
  }
  return opts;
}

const KIND_LABEL: Record<string, string> = {
  COMPANY: "الشركات",
  PROJECT: "المشروعات",
  SITE: "المواقع",
  PURCHASE: "المشتريات",
  PRACTICE: "الممارسات",
  CONTRACT: "التعاقدات",
};

function kindLine(k: KindReport): string {
  const label = (KIND_LABEL[k.entityType] ?? k.entityType).padEnd(12, " ");
  const note = k.note ? `  ⚠ ${k.note}` : "";
  return `  ${label}  استُخرج: ${String(k.rawValues).padStart(3)}  ·  أُنشئ: ${String(k.created).padStart(3)}  ·  مُعاد استخدامه: ${String(k.reused).padStart(3)}  ·  مكرر مُمنوع: ${String(k.duplicatesPrevented).padStart(3)}${note}`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const actor = await resolveImportActor();

  console.log("════════════════════════════════════════════════");
  console.log("   التهيئة الذكية لقاعدة بيانات المدفعية (5.1)");
  console.log("════════════════════════════════════════════════");
  console.log(`المستخدم: ${actor.name}`);
  console.log(opts.dryRun ? "الوضع:   تجريبي (لا يُكتب شيء) --dry-run" : "الوضع:   تنفيذ فعلي");
  console.log("");

  const onEvent = (e: BootstrapEvent) => {
    switch (e.type) {
      case "kind-start":
        process.stdout.write(`🔎 ${KIND_LABEL[e.entityType] ?? e.entityType}: ${e.rawValues} قيمة مستخرجة\n`);
        break;
      case "record":
        if (e.outcome === "created") process.stdout.write(`   ➕ ${e.value}\n`);
        break;
      case "linking-start":
        process.stdout.write("\n🔗 إعادة تشغيل محرك الربط...\n");
        break;
      case "linking-done":
        process.stdout.write(`   تم الربط: ${e.counts.linked} · بدون تطابق: ${e.counts.unmatched} · متخطى: ${e.counts.skipped} · أخطاء: ${e.counts.failed}\n`);
        break;
    }
  };

  const report = await runBootstrap({ actorId: actor.id, dryRun: opts.dryRun, onEvent });

  console.log("");
  console.log("════════════════════════════════════════════════");
  console.log(opts.dryRun ? "📋 التقرير التجريبي" : "✅ اكتملت التهيئة");
  console.log("════════════════════════════════════════════════");
  for (const k of report.perKind) console.log(kindLine(k));
  console.log("────────────────────────────────────────────────");
  console.log(`الإجمالي   —  استُخرج: ${report.totals.rawValues}  ·  أُنشئ: ${report.totals.created}  ·  مُعاد استخدامه: ${report.totals.reused}  ·  مكرر مُمنوع: ${report.totals.duplicatesPrevented}`);
  console.log("");
  console.log("الربط:");
  console.log(`  روابط جديدة مُقترحة : ${report.linksCreated}`);
  console.log(`  إجمالي روابط بانتظار المراجعة : ${report.suggestedLinksAfter}`);
  console.log(`  مستندات بلا أي رابط : ${report.unmatchedDocuments}`);

  if (report.createdRecords.length > 0) {
    console.log("");
    console.log(`السجلات المُنشأة (${report.createdRecords.length}):`);
    for (const r of report.createdRecords.slice(0, 60)) {
      console.log(`  • [${KIND_LABEL[r.entityType] ?? r.entityType}] ${r.name}  ⟵ ${r.sourceDocument}  (ثقة ${(r.confidence * 100).toFixed(0)}% · ${r.provider})`);
    }
    if (report.createdRecords.length > 60) console.log(`  … و ${report.createdRecords.length - 60} سجلًا آخر`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("\n✖ فشلت التهيئة:", error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
