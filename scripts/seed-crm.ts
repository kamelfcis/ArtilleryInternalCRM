import "./server-only-shim.cjs"; // must run before any server-only module loads
import { prisma } from "@/lib/prisma";
import { runSeed, resolveImportActor } from "@/lib/seed/service";
import { runLinking, type LinkEvent } from "@/lib/linking/service";
import { ENTITY_KIND_META, ENTITY_KIND_ORDER, type EntityKind } from "@/lib/crm/constants";
import type { SeedCounts, SeedEvent } from "@/lib/seed/types";

/**
 * CLI: `npm run seed:crm [-- --verbose]`
 *
 * Smart CRM seeding (Phase 4.5). Bootstraps the CRM tables from the REAL entities
 * extracted in Phase 4.3 — normalizing, Arabic-folding and fuzzy-deduplicating
 * each company/site/project name and contract/purchase/practice number, then
 * reusing an existing record or creating a new one (never a duplicate). Every
 * created record emits a `crm.record.created` event (with provenance) that the
 * audit subscriber records. Idempotent: rerunning creates nothing new.
 *
 * After seeding, it automatically reruns the CRM linking engine and prints a
 * second report (exact / fuzzy / suggested / unmatched) so the payoff — real
 * document→record links — is visible in one command.
 *
 * Options:
 *   --verbose   print every created / reused / skipped decision
 */

function hr(ch = "─", n = 60) {
  console.log(ch.repeat(n));
}

function seedReport(counts: SeedCounts) {
  let totalCreated = 0;
  let reused = 0;
  let skipped = 0;
  let errors = 0;

  hr("═");
  console.log("  تقرير البذر الذكي — سجلات أُنشئت من الاستخراج الحقيقي");
  hr("═");
  for (const kind of ENTITY_KIND_ORDER) {
    const r = counts[kind];
    totalCreated += r.created;
    reused += r.reused;
    skipped += r.skipped;
    errors += r.errors;
    const label = ENTITY_KIND_META[kind].labelPlural.padEnd(12);
    console.log(`  ${label} : ${String(r.created).padStart(3)} أُنشئ  ·  ${r.reused} مُعاد استخدامه  ·  ${r.skipped} متخطى`);
  }
  hr();
  console.log(`  إجمالي المُنشأ (Created)      : ${totalCreated}`);
  console.log(`  مُعاد استخدامه (Reused)       : ${reused}`);
  console.log(`  متخطى (Skipped)              : ${skipped}`);
  console.log(`  أخطاء (Errors)               : ${errors}`);
  hr("═");
}

async function linkingReport(actorId: string) {
  console.log("");
  hr("═");
  console.log("  إعادة تشغيل محرك الربط بعد البذر — التقرير الثاني");
  hr("═");
  await runLinking({
    actorId,
    force: true,
    onEvent: (e: LinkEvent) => {
      if (e.type === "scanned") console.log(`  المستندات المُستخرَجة: ${e.total}`);
      if (e.type === "done") console.log(`  مرتبط: ${e.linked} · بدون تطابق: ${e.unmatched} · أخطاء: ${e.failed}`);
    },
  });

  const links = await prisma.documentLink.findMany({
    select: { documentId: true, entityType: true, method: true, status: true, matchedKey: true, matchedValue: true, confidence: true },
  });
  const docsWithExtraction = await prisma.document.count({ where: { deletedAt: null, extraction: { is: {} } } });
  const exact = links.filter((l) => l.method === "exact").length;
  const fuzzy = links.filter((l) => l.method === "fuzzy").length;
  const suggested = links.filter((l) => l.status === "SUGGESTED").length;
  const linkedDocs = new Set(links.map((l) => l.documentId)).size;

  hr();
  console.log(`  🔗 تطابق دقيق (Exact Matches)     : ${exact}`);
  console.log(`  🔗 تطابق تقريبي (Fuzzy Matches)   : ${fuzzy}`);
  console.log(`  📋 مقترح (Suggested Matches)      : ${suggested}`);
  console.log(`  ○ مستندات بدون تطابق (Unmatched) : ${docsWithExtraction - linkedDocs} / ${docsWithExtraction}`);
  hr("═");
  if (links.length) {
    console.log("  الروابط المقترحة:");
    for (const l of links) {
      const label = ENTITY_KIND_META[l.entityType as EntityKind]?.labelSingular ?? l.entityType;
      console.log(`    • ${label.padEnd(8)} ← ${l.matchedKey}="${l.matchedValue}" [${l.method}, ${l.confidence.toFixed(2)}, ${l.status}]`);
    }
    hr("═");
  }
}

async function main() {
  const verbose = process.argv.slice(2).includes("--verbose");
  const actor = await resolveImportActor();

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   محرّك البذر الذكي — بناء سجلات CRM من الاستخراج الحقيقي   ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`المستخدم: ${actor.name}\n`);

  const onEvent = (e: SeedEvent) => {
    switch (e.type) {
      case "scanning":
        process.stdout.write("🔍 جارٍ قراءة الحقول المستخرجة...\n");
        break;
      case "scanned":
        console.log(`   حقول مستخرجة: ${e.fields} · مستندات: ${e.documents}\n`);
        process.stdout.write("🧠 جارٍ البذر (تطبيع + مطابقة ضبابية + إنشاء)...\n\n");
        break;
      case "kind-start":
        console.log(`▸ ${ENTITY_KIND_META[e.kind].labelPlural}: ${e.candidates} كيان مميز`);
        break;
      case "created":
        if (verbose) console.log(`    ＋ إنشاء: "${e.name}"  [${e.confidence.toFixed(2)}]  ← ${e.document}`);
        break;
      case "reused":
        if (verbose) console.log(`    ↻ إعادة استخدام: "${e.name}"`);
        break;
      case "skipped":
        if (verbose) console.log(`    ⏭ تخطٍّ: ${e.value} (${e.reason})`);
        break;
      case "error":
        console.log(`    ✖ خطأ: "${e.value}" — ${e.reason}`);
        break;
      case "kind-done":
        console.log(`    = ${e.result.created} أُنشئ · ${e.result.reused} مُعاد · ${e.result.skipped} متخطى · ${e.result.errors} أخطاء\n`);
        break;
    }
  };

  const counts = await runSeed({ actorId: actor.id, onEvent });

  console.log("");
  seedReport(counts);
  await linkingReport(actor.id);

  const errors = Object.values(counts).reduce((a, r) => a + r.errors, 0);
  await prisma.$disconnect();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error("\n✖ فشل البذر:", error instanceof Error ? error.stack : error);
  await prisma.$disconnect();
  process.exit(1);
});
