import "./server-only-shim.cjs";
import { prisma } from "@/lib/prisma";
import { runLinking, resolveImportActor } from "@/lib/linking/service";
import { MATCHERS, normalizeRef, scoreName, MIN_CONFIDENCE } from "@/lib/linking/matchers";
import { normalize } from "@/lib/search/normalize";
import type { FieldValue, CrmRecord } from "@/lib/linking/types";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, extra?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${extra ? `  — ${extra}` : ""}`);
  }
}

function runMatchers(fields: FieldValue[], byType: Record<string, CrmRecord[]>) {
  const out = [];
  for (const m of MATCHERS) out.push(...m.match(fields, byType[m.entityType] ?? []));
  return out;
}

async function unitTests() {
  console.log("\n── A. Pure matcher unit tests ──");

  // normalizeRef folds Arabic-Indic digits and strips non digit/slash noise.
  check("normalizeRef('١٢٣ / ٢٠٢٥') === '123/2025'", normalizeRef("١٢٣ / ٢٠٢٥") === "123/2025", normalizeRef("١٢٣ / ٢٠٢٥"));
  check("normalizeRef('ع/9001/2025') === '9001/2025'", normalizeRef("ع/9001/2025") === "9001/2025", normalizeRef("ع/9001/2025"));

  // scoreName behaviour.
  check("exact name → 0.9", scoreName(normalize("شركة النصر"), normalize("شركة النصر")) === 0.9);
  check("ta-marbuta typo folds to exact", scoreName(normalize("شركه النصر"), normalize("شركة النصر")) === 0.9);
  check("containment → 0.72", scoreName(normalize("شركة النصر"), normalize("شركة النصر للمقاولات")) === 0.72);
  check("dissimilar → 0 (below threshold)", scoreName(normalize("الشركة المصرية"), normalize("شركة النصر")) < MIN_CONFIDENCE);

  // Exact ref matcher via full set.
  const exact = runMatchers(
    [{ key: "contractNumber", value: "9001/2025", normalizedValue: "9001/2025" }],
    { CONTRACT: [{ id: "C1", key: "ع/9001/2025" }, { id: "C2", key: "5000/2020" }] },
  );
  check("contractNumber matches C1 only (exact, 0.97)", exact.length === 1 && exact[0]!.entityId === "C1" && exact[0]!.method === "exact" && exact[0]!.confidence === 0.97, JSON.stringify(exact));

  // Fuzzy name matcher via full set, incl. a decoy that must NOT match.
  const fuzzy = runMatchers(
    [{ key: "company", value: "شركة النصر للمقاولات", normalizedValue: null }],
    { COMPANY: [{ id: "CO1", key: "شركة النصر" }, { id: "CO2", key: "المقاولون العرب" }] },
  );
  check("company fuzzy-matches CO1 only", fuzzy.length === 1 && fuzzy[0]!.entityId === "CO1" && fuzzy[0]!.method === "fuzzy", JSON.stringify(fuzzy));
}

async function integrationTest() {
  console.log("\n── B. DB integration test ──");
  const actor = await resolveImportActor();
  const folder = await prisma.folder.findFirst({ select: { id: true } });
  if (!folder) throw new Error("no folder to attach the test document to");

  const contractNo = "TEST-9001/2025";
  const created: { docId?: string; contractId?: string; companyId?: string } = {};

  try {
    // Seed a company + a contract whose number/name the fields will reference.
    const company = await prisma.company.create({
      data: { name: "شركة الاختبار الوهمية للمقاولات", createdById: actor.id },
      select: { id: true },
    });
    created.companyId = company.id;
    const contract = await prisma.contract.create({
      data: { contractNumber: contractNo, title: "عقد اختبار الربط", companyId: company.id, createdById: actor.id },
      select: { id: true },
    });
    created.contractId = contract.id;

    // Seed a document with an extraction that references both.
    const doc = await prisma.document.create({
      data: {
        name: "وثيقة اختبار الربط.pdf",
        originalName: "وثيقة اختبار الربط.pdf",
        mimeType: "application/pdf",
        size: 1,
        storageKey: "test/linking-verify.pdf",
        folderId: folder.id,
        uploadedById: actor.id,
        extraction: {
          create: {
            engine: "rules-only",
            sourceHash: "verify-linking",
            fields: {
              create: [
                { documentId: "placeholder", key: "contractNumber", value: "9001/2025", normalizedValue: "9001/2025", confidence: 0.88, source: "rule" },
                { documentId: "placeholder", key: "company", value: "شركة الاختبار الوهمية", normalizedValue: null, confidence: 0.7, source: "llm" },
                { documentId: "placeholder", key: "company", value: "شركة لا وجود لها إطلاقًا", normalizedValue: null, confidence: 0.7, source: "llm" },
              ],
            },
          },
        },
      },
      select: { id: true },
    });
    created.docId = doc.id;
    // Fix the denormalized documentId on the fields (unknown at create time).
    await prisma.documentField.updateMany({ where: { documentId: "placeholder" }, data: { documentId: doc.id } });

    // 1) First run — should produce exactly 2 links (contract exact + company fuzzy).
    const c1 = await runLinking({ actorId: actor.id, documentId: doc.id });
    const links1 = await prisma.documentLink.findMany({ where: { documentId: doc.id }, orderBy: { entityType: "asc" } });
    check("first run: linked=1", c1.linked === 1, JSON.stringify(c1));
    check("2 DocumentLink rows created", links1.length === 2, JSON.stringify(links1.map((l) => `${l.entityType}:${l.method}:${l.confidence}`)));
    const contractLink = links1.find((l) => l.entityType === "CONTRACT");
    const companyLink = links1.find((l) => l.entityType === "COMPANY");
    check("contract link is exact → seeded contract, conf 0.97", !!contractLink && contractLink.entityId === contract.id && contractLink.method === "exact" && contractLink.confidence === 0.97);
    check("company link is fuzzy → seeded company", !!companyLink && companyLink.entityId === company.id && companyLink.method === "fuzzy");
    check("all first-run links are AUTO + SUGGESTED", links1.every((l) => l.source === "AUTO" && l.status === "SUGGESTED"));

    // 2) Audit row written.
    const audit = await prisma.auditLog.findFirst({ where: { action: "LINK_DOCUMENT", entityId: doc.id }, orderBy: { createdAt: "desc" } });
    check("LINK_DOCUMENT audit row written", !!audit && !!audit.summary?.includes("ربط وثيقة بسجلات"), audit?.summary ?? "none");

    // 3) Idempotent rerun — no change → skipped, still 2 links.
    const c2 = await runLinking({ actorId: actor.id, documentId: doc.id });
    const links2 = await prisma.documentLink.count({ where: { documentId: doc.id } });
    check("rerun: skipped=1, linked=0", c2.skipped === 1 && c2.linked === 0, JSON.stringify(c2));
    check("rerun: still 2 links (no duplicates)", links2 === 2);

    // 4) Human preservation: confirm the company link + add a MANUAL link, then rerun with --force.
    await prisma.documentLink.update({ where: { id: companyLink!.id }, data: { status: "CONFIRMED" } });
    await prisma.documentLink.create({
      data: { documentId: doc.id, entityType: "PROJECT", entityId: "manual-proj", matchedKey: "project", matchedValue: "يدوي", method: "fuzzy", confidence: 1, status: "SUGGESTED", source: "MANUAL" },
    });
    await runLinking({ actorId: actor.id, documentId: doc.id, force: true });
    const links3 = await prisma.documentLink.findMany({ where: { documentId: doc.id } });
    const confirmedStillThere = links3.find((l) => l.id === companyLink!.id);
    const manualStillThere = links3.find((l) => l.source === "MANUAL");
    check("force rerun: CONFIRMED company link preserved (not duplicated)", !!confirmedStillThere && confirmedStillThere.status === "CONFIRMED" && links3.filter((l) => l.entityType === "COMPANY").length === 1, JSON.stringify(links3.map((l) => `${l.entityType}:${l.status}:${l.source}`)));
    check("force rerun: MANUAL link preserved", !!manualStillThere);
    check("force rerun: contract auto link re-created once", links3.filter((l) => l.entityType === "CONTRACT").length === 1);
  } finally {
    // Cleanup — order matters (links cascade with the document).
    if (created.docId) await prisma.document.delete({ where: { id: created.docId } }).catch(() => {});
    if (created.contractId) await prisma.contract.delete({ where: { id: created.contractId } }).catch(() => {});
    if (created.companyId) await prisma.company.delete({ where: { id: created.companyId } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { action: "LINK_DOCUMENT", entityId: created.docId } }).catch(() => {});
  }
}

async function main() {
  await unitTests();
  await integrationTest();
  console.log(`\n════════════════════════════\n  PASS: ${pass}   FAIL: ${fail}\n════════════════════════════`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("verify failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
