import "./server-only-shim.cjs";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ruleExtractor } from "@/lib/extraction/rules";
import { llmExtractor } from "@/lib/extraction/llm";
import { runExtraction, resolveImportActor } from "@/lib/extraction/service";
import type { FieldCandidate } from "@/lib/extraction/types";

/** Representative sample: one document per CRM category, across distinct folders. */
const SAMPLE: Array<{ category: string; id: string }> = [
  { category: "Companies", id: "cmr9wyhk7005uqpv0t021e3z6" },
  { category: "Contracts", id: "cmr9wymri0085qpv0j9a2jflw" },
  { category: "Purchases", id: "cmr9wyt6b00b3qpv0t5chvfq1" },
  { category: "Practices", id: "cmr9x2cbd01taqpv096sd4hke" },
  { category: "Projects", id: "cmr9wy7sf001xqpv0hanka8o6" },
];

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

async function ocrText(id: string): Promise<string> {
  const rows = await prisma.documentText.findMany({
    where: { documentId: id },
    select: { pageNumber: true, rawText: true },
    orderBy: { pageNumber: "asc" },
  });
  return rows.map((r) => r.rawText).join("\n\n").trim();
}

function fmt(fields: FieldCandidate[]): string {
  if (fields.length === 0) return "    (none)";
  return fields
    .map(
      (f) =>
        `    • ${f.key} = "${f.value.replace(/\s+/g, " ").slice(0, 55)}"${
          f.normalizedValue ? ` → ${f.normalizedValue}` : ""
        }  [${f.source}/${f.confidence}]`,
    )
    .join("\n");
}

const auditCount = (id: string) =>
  prisma.auditLog.count({ where: { action: "EXTRACT_FIELDS", entityId: id } });
const extractionCount = (id: string) =>
  prisma.documentExtraction.count({ where: { documentId: id } });

async function main() {
  const actor = await resolveImportActor();
  const llmOn = llmExtractor.isAvailable();
  console.log("══════════════════════════════════════════════════════");
  console.log("  HYBRID EXTRACTION — RUNTIME VERIFICATION");
  console.log(`  LLM pass: ${llmOn ? `ON (${llmExtractor.providerLabel}, model ${llmExtractor.model})` : "OFF — no LLM key (ANTHROPIC_API_KEY / GEMINI_API_KEY)"}`);
  console.log("══════════════════════════════════════════════════════\n");

  const ocrBefore = new Map<string, string>();
  const checks: string[] = [];

  for (const { category, id } of SAMPLE) {
    const doc = await prisma.document.findUnique({
      where: { id },
      select: { name: true, folder: { select: { name: true } } },
    });
    const text = await ocrText(id);
    ocrBefore.set(id, sha256(text));

    console.log(`### [${category}] ${doc?.name}  (folder: ${doc?.folder.name})`);
    console.log(`  OCR text length: ${text.length} chars`);

    const rules = await ruleExtractor.extract(text);
    const claude = await llmExtractor.extract(text);
    console.log(`  Rule-based fields (${rules.length}):`);
    console.log(fmt(rules));
    console.log(`  Claude fields (${claude.length})${llmOn ? "" : " — SKIPPED (no key)"}:`);
    console.log(fmt(claude));
    console.log(`  Merged total: ${rules.length + claude.length} fields\n`);
  }

  // ---- Persist via the real service (force), then verify invariants ---------
  console.log("── Persist (force) + invariant checks ──\n");
  for (const { id } of SAMPLE) {
    const auditBefore = await auditCount(id);
    await runExtraction({ actorId: actor.id, documentId: id, force: true });
    const auditAfterForce = await auditCount(id);
    const rowsAfter = await extractionCount(id);
    const ocrAfter = sha256(await ocrText(id));

    // Idempotency: rerun without force must skip (no new audit event).
    let skipped = 0;
    await runExtraction({
      actorId: actor.id,
      documentId: id,
      onEvent: (e) => {
        if (e.type === "done") skipped = e.skipped;
      },
    });
    const auditAfterRerun = await auditCount(id);

    const ok = {
      ocrUnchanged: ocrBefore.get(id) === ocrAfter,
      singleRow: rowsAfter === 1,
      auditOncePerForce: auditAfterForce - auditBefore === 1,
      idempotentSkip: skipped === 1,
      noAuditOnRerun: auditAfterRerun - auditAfterForce === 0,
    };
    const pass = Object.values(ok).every(Boolean);
    checks.push(
      `  ${pass ? "✅" : "❌"} ${id}  ocrUnchanged=${ok.ocrUnchanged} singleRow=${ok.singleRow} auditOnce=${ok.auditOncePerForce} idempotentSkip=${ok.idempotentSkip} noAuditOnRerun=${ok.noAuditOnRerun}`,
    );
  }

  console.log("Invariants (per document):");
  console.log(checks.join("\n"));
  const allPass = checks.every((c) => c.includes("✅"));
  console.log(`\n${allPass ? "✅ ALL INVARIANTS HOLD" : "❌ SOME INVARIANTS FAILED"}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
