import "./server-only-shim.cjs";
import { prisma } from "@/lib/prisma";
import { runExtraction, resolveImportActor, type ExtractEvent } from "@/lib/extraction/service";
import { runLinking, type LinkEvent } from "@/lib/linking/service";
import { llmExtractor } from "@/lib/extraction/llm";
import { FIELD_KEYS } from "@/lib/extraction/types";

/**
 * End-to-end validation of the HYBRID extraction pipeline against a live LLM
 * provider (Phase 4.3) + the CRM linking engine (Phase 4.4).
 *
 * Requires a provider key — ANTHROPIC_API_KEY (Claude) or GEMINI_API_KEY /
 * GOOGLE_API_KEY (Gemini), loaded from .env / the environment. Without a key it
 * prints guidance and exits WITHOUT mutating anything — the rules-only path is
 * already covered by scripts/_verify-hybrid.ts.
 *
 * What it does (over every OCR'd document, across all folders):
 *   1. Force-runs the hybrid extractor (local rules + LLM free-form pass).
 *   2. Per document: rule fields vs LLM fields vs the merged result.
 *   3. Semantic-field coverage checklist (company/project/site/…/notes).
 *   4. Extraction idempotency (re-run → skipped).
 *   5. Force-runs CRM linking and reports exact / fuzzy / suggested / unmatched.
 *   6. Linking idempotency (re-run → skipped).
 *   7. Audit events (EXTRACT_FIELDS, LINK_DOCUMENT) + confidence-score summary.
 */

const RULE_KEYS = new Set<string>([
  FIELD_KEYS.DATE, FIELD_KEYS.PHONE, FIELD_KEYS.NATIONAL_ID, FIELD_KEYS.TAX_ID,
  FIELD_KEYS.AMOUNT, FIELD_KEYS.CURRENCY, FIELD_KEYS.CONTRACT_NUMBER,
  FIELD_KEYS.PURCHASE_NUMBER, FIELD_KEYS.PRACTICE_NUMBER,
]);

const SEMANTIC_KEYS: { key: string; label: string }[] = [
  { key: FIELD_KEYS.COMPANY, label: "company / الشركة" },
  { key: FIELD_KEYS.PROJECT, label: "project / المشروع" },
  { key: FIELD_KEYS.SITE, label: "site / الموقع" },
  { key: FIELD_KEYS.GOVERNMENT_ENTITY, label: "governmentEntity / الجهة" },
  { key: FIELD_KEYS.ENGINEER, label: "engineer / المهندس" },
  { key: FIELD_KEYS.REPRESENTATIVE, label: "representative / الممثل" },
  { key: FIELD_KEYS.ADDRESS, label: "address / العنوان" },
  { key: FIELD_KEYS.STATUS, label: "status / الحالة" },
  { key: FIELD_KEYS.NOTES, label: "notes / ملاحظات" },
];

function hr(ch = "─") { console.log(ch.repeat(70)); }
function fmtConf(c: number) { return c.toFixed(2); }

async function main() {
  const rulesOnly = process.argv.slice(2).includes("--rules-only");
  const actor = await resolveImportActor();

  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   التحقق من محرك الاستخراج الهجين عبر LLM API + محرك الربط           ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  // ---- 0. Credential guard -------------------------------------------------
  const provider = llmExtractor.providerLabel;
  if (llmExtractor.isAvailable()) {
    console.log(`✅ مفتاح ${provider} API مضبوط.  النموذج: ${llmExtractor.model}\n`);
  } else if (rulesOnly) {
    console.log("⚠️  وضع مؤقت: قواعد فقط (--rules-only) — لا يوجد مفتاح LLM.");
    console.log("   يُنفَّذ كل شيء عدا محرّك LLM للحقول الدلالية.");
    console.log(`   عند توفّر المفتاح، أعد التشغيل بدون --rules-only لتفعيل النموذج (${llmExtractor.model}).\n`);
  } else {
    console.log("⛔ لا يوجد مفتاح LLM مضبوط في البيئة (ANTHROPIC_API_KEY أو GEMINI_API_KEY).");
    console.log("   محرك LLM لن يعمل — لن يتم تعديل أي بيانات.");
    console.log("   أضف ANTHROPIC_API_KEY=sk-ant-... أو GEMINI_API_KEY=... إلى .env، أو مرّر --rules-only للتشغيل المؤقت.\n");
    await prisma.$disconnect();
    process.exit(2);
  }

  const docCount = await prisma.document.count({ where: { deletedAt: null, texts: { some: {} } } });
  console.log(`عدد المستندات المُستخرَج نصها (العينة): ${docCount}\n`);

  // ---- 1. Hybrid extraction (force) ---------------------------------------
  hr("═");
  console.log(`① الاستخراج الهجين (قواعد محلية + ${provider}) — إعادة إجبارية`);
  hr("═");
  let engineUsed = "?";
  await runExtraction({
    actorId: actor.id,
    force: true,
    onEvent: (e: ExtractEvent) => {
      if (e.type === "scanned") engineUsed = e.llm ? `هجين (rules + ${provider})` : "قواعد فقط";
      if (e.type === "document" && e.status === "failed") console.log(`   ✖ فشل: ${e.name} — ${e.reason ?? ""}`);
      if (e.type === "done") console.log(`\nالمحرك: ${engineUsed}\nمُستخرَج: ${e.extracted} · بدون بيانات: ${e.empty} · أخطاء: ${e.failed}`);
    },
  });
  if (!engineUsed.startsWith("هجين") && !rulesOnly) {
    console.log(`\n⛔ لم يعمل محرك ${provider} — توقّف التحقق.`);
    await prisma.$disconnect();
    process.exit(2);
  }

  // ---- 2. Per-document rule vs LLM vs merged ------------------------------
  hr("═");
  console.log("② مقارنة الحقول: قواعد (rule) ⟷ نموذج (llm) — والنتيجة المدمجة");
  hr("═");
  const docs = await prisma.document.findMany({
    where: { deletedAt: null, extraction: { is: {} } },
    select: {
      id: true, name: true,
      folder: { select: { name: true } },
      extraction: { select: { engine: true, model: true, fields: { select: { key: true, value: true, normalizedValue: true, confidence: true, source: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const semanticCounts = new Map<string, number>();
  const confBySource: Record<string, number[]> = { rule: [], llm: [] };

  for (const d of docs) {
    const fields = d.extraction?.fields ?? [];
    const rule = fields.filter((f) => f.source === "rule");
    const llm = fields.filter((f) => f.source === "llm");
    for (const f of fields) confBySource[f.source]?.push(f.confidence);
    for (const f of llm) if (!RULE_KEYS.has(f.key)) semanticCounts.set(f.key, (semanticCounts.get(f.key) ?? 0) + 1);

    console.log(`\n📄 ${d.name}   📁 ${d.folder?.name ?? "—"}`);
    console.log(`   المحرك: ${d.extraction?.engine}${d.extraction?.model ? ` (${d.extraction.model})` : ""}`);
    if (rule.length === 0 && llm.length === 0) { console.log("   (لا حقول)"); continue; }
    if (rule.length) {
      console.log("   ── قواعد (rule) ──");
      for (const f of rule) console.log(`     • ${f.key.padEnd(16)} = "${f.value}"${f.normalizedValue ? `  →  ${f.normalizedValue}` : ""}   [${fmtConf(f.confidence)}]`);
    }
    if (llm.length) {
      console.log(`   ── نموذج ${provider} (llm) ──`);
      for (const f of llm) console.log(`     • ${f.key.padEnd(16)} = "${f.value}"   [${fmtConf(f.confidence)}]`);
    }
    console.log(`   ── مدمج: ${fields.length} حقل (${rule.length} قاعدة + ${llm.length} نموذج) ──`);
  }

  // ---- 3. Semantic-field coverage -----------------------------------------
  hr("═");
  console.log(`③ تغطية الحقول الدلالية (من محرك ${provider}) عبر العينة`);
  hr("═");
  if (rulesOnly) console.log("   (وضع قواعد فقط: هذه الحقول تتطلّب مفتاح LLM — متوقّع أن تكون صفرًا)\n");
  for (const { key, label } of SEMANTIC_KEYS) {
    const n = semanticCounts.get(key) ?? 0;
    console.log(`   ${n > 0 ? "✅" : "⬜"}  ${label.padEnd(28)} ${n} قيمة`);
  }

  // ---- 4. Extraction idempotency ------------------------------------------
  hr("═");
  console.log("④ ثبات الاستخراج (idempotency) — إعادة تشغيل دون --force");
  hr("═");
  const e2 = await runExtraction({ actorId: actor.id, force: false });
  console.log(`   مُستخرَج: ${e2.extracted} · بدون بيانات: ${e2.empty} · متخطى: ${e2.skipped} · أخطاء: ${e2.failed}`);
  console.log(`   ${e2.skipped === docs.length ? "✅ كل المستندات تم تخطيها (ثابت)" : "⚠️ بعض المستندات أُعيد استخراجها"}`);

  // ---- 5. CRM linking (force) + report ------------------------------------
  hr("═");
  console.log("⑤ محرك الربط بـ CRM — إعادة إجبارية + تقرير");
  hr("═");
  await runLinking({
    actorId: actor.id,
    force: true,
    onEvent: (e: LinkEvent) => {
      if (e.type === "done") console.log(`   مرتبط: ${e.linked} · بدون تطابق: ${e.unmatched} · أخطاء: ${e.failed}`);
    },
  });
  const links = await prisma.documentLink.findMany({
    select: { documentId: true, entityType: true, method: true, status: true, matchedKey: true, matchedValue: true, confidence: true },
  });
  const exact = links.filter((l) => l.method === "exact");
  const fuzzy = links.filter((l) => l.method === "fuzzy");
  const suggested = links.filter((l) => l.status === "SUGGESTED");
  const linkedDocIds = new Set(links.map((l) => l.documentId));
  const unmatchedDocs = docs.filter((d) => !linkedDocIds.has(d.id));
  console.log(`\n   🔗 تطابق دقيق (exact):   ${exact.length}`);
  console.log(`   🔗 تطابق تقريبي (fuzzy): ${fuzzy.length}`);
  console.log(`   📋 مقترح (SUGGESTED):     ${suggested.length}`);
  console.log(`   ○ مستندات بدون تطابق:    ${unmatchedDocs.length} / ${docs.length}`);
  if (links.length) {
    console.log("\n   الروابط المقترحة:");
    for (const l of links) console.log(`     • ${l.entityType.padEnd(9)} ← ${l.matchedKey}="${l.matchedValue}" [${l.method}, ${fmtConf(l.confidence)}, ${l.status}]`);
  }

  // ---- 6. Linking idempotency ---------------------------------------------
  hr("═");
  console.log("⑥ ثبات الربط (idempotency) — إعادة تشغيل دون --force");
  hr("═");
  const l2 = await runLinking({ actorId: actor.id, force: false });
  console.log(`   مرتبط: ${l2.linked} · بدون تطابق: ${l2.unmatched} · متخطى: ${l2.skipped}`);
  console.log(`   ${l2.linked === 0 ? "✅ لا روابط جديدة عند الإعادة (ثابت)" : "⚠️ أُنشئت روابط جديدة"}`);

  // ---- 7. Audit events + confidence summary -------------------------------
  hr("═");
  console.log("⑦ أحداث التدقيق ودرجات الثقة");
  hr("═");
  const extractAudits = await prisma.auditLog.count({ where: { action: "EXTRACT_FIELDS" } });
  const linkAudits = await prisma.auditLog.count({ where: { action: "LINK_DOCUMENT" } });
  console.log(`   سجلات EXTRACT_FIELDS: ${extractAudits}`);
  console.log(`   سجلات LINK_DOCUMENT:  ${linkAudits}`);
  const recent = await prisma.auditLog.findMany({ where: { action: { in: ["EXTRACT_FIELDS", "LINK_DOCUMENT"] } }, orderBy: { createdAt: "desc" }, take: 6, select: { action: true, summary: true } });
  console.log("   أحدث السجلات:");
  for (const a of recent) console.log(`     • [${a.action}] ${a.summary}`);
  const stat = (xs: number[]) => xs.length ? `min ${Math.min(...xs).toFixed(2)} · max ${Math.max(...xs).toFixed(2)} · avg ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)} · n=${xs.length}` : "n=0";
  console.log(`\n   ثقة القواعد (rule): ${stat(confBySource.rule!)}`);
  console.log(`   ثقة النموذج (llm):  ${stat(confBySource.llm!)}`);

  hr("═");
  if (rulesOnly) {
    console.log("⚠️  اكتمل التحقق المؤقت (قواعد فقط). محرّك LLM للحقول الدلالية لم يُختبر بعد.");
    console.log("   لإكمال التحقق: أضف مفتاح LLM (ANTHROPIC_API_KEY أو GEMINI_API_KEY) وشغّل: npm run validate:hybrid");
  } else {
    console.log(`✅ اكتمل التحقق من المحرك الهجين عبر ${provider} API.`);
  }
  hr("═");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\n✖ فشل التحقق:", e instanceof Error ? e.stack : e);
  await prisma.$disconnect();
  process.exit(1);
});
