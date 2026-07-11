import "./server-only-shim.cjs"; // must run before any server-only module loads
import { prisma } from "@/lib/prisma";
import {
  runExtraction,
  resolveImportActor,
  type ExtractEvent,
} from "@/lib/extraction/service";
import { llmExtractor } from "@/lib/extraction/llm";

/**
 * CLI: `npm run extract:documents [-- options]`
 *
 * Extracts structured information (company, contract/purchase/practice numbers,
 * dates, phones, IDs, amounts, …) from each document's OCR text into the
 * DocumentField table. Hybrid engine: local rules always run; the Claude pass
 * for free-form entities runs only when ANTHROPIC_API_KEY is set. Idempotent and
 * resumable — a rerun skips documents whose OCR text is unchanged.
 *
 * Options:
 *   --force               re-extract even if the stored fields are up to date
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

function progressLine(e: Extract<ExtractEvent, { type: "progress" }>): string {
  return `\r[${e.done}/${e.total}]  ✔ مستخرج: ${e.extracted}  ·  ○ بدون بيانات: ${e.empty}  ·  ⏭ متخطى: ${e.skipped}  ·  ✖ أخطاء: ${e.failed}   `;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const actor = await resolveImportActor();

  console.log("════════════════════════════════════════════");
  console.log("   استخراج البيانات الذكي من مستندات المدفعية");
  console.log("════════════════════════════════════════════");
  console.log(`المستخدم: ${actor.name}`);
  if (opts.force) console.log("الوضع:   إعادة استخراج إجبارية (--force)");
  if (opts.limit) console.log(`الحد:     ${opts.limit} مستند`);
  if (opts.documentId) console.log(`مستند:   ${opts.documentId}`);
  console.log("");

  const failures: { name: string; reason?: string }[] = [];

  const onEvent = (e: ExtractEvent) => {
    switch (e.type) {
      case "scanning":
        process.stdout.write("🔍 جارٍ الفحص...\n");
        break;
      case "scanned":
        console.log(`   عدد المستندات المُفهرَسة: ${e.total}`);
        console.log(
          e.llm
            ? `   المحرك: هجين (قواعد محلية + نموذج ${llmExtractor.providerLabel})`
            : "   المحرك: قواعد محلية فقط (لم يتم ضبط مفتاح LLM: ANTHROPIC_API_KEY أو GEMINI_API_KEY)",
        );
        console.log("");
        process.stdout.write("🧠 جارٍ الاستخراج...\n");
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
        console.log(`بدون بيانات  : ${e.empty}`);
        console.log(`تم التخطي    : ${e.skipped}`);
        console.log(`أخطاء        : ${e.failed}`);
        break;
    }
  };

  const counts = await runExtraction({
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
