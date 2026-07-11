import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TransactionClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const ACTIVE_ONLY = { deletedAt: null } as const;

function deletedNow() {
  return new Date();
}

/**
 * CRM soft-delete cascade rules. Deleting a parent sets `deletedAt` on active
 * children (deletedAt: null); already-deleted records are skipped.
 *
 * SITE → PROJECT* → CONTRACT*, PRACTICE*, PURCHASE*
 * PROJECT → CONTRACT*, PRACTICE*, PURCHASE*
 *   CONTRACT → PURCHASE*
 *   PRACTICE → CONTRACT* → PURCHASE*
 * COMPANY → CONTRACT*, PRACTICE* (awarded), PURCHASE*
 *   CONTRACT → PURCHASE*
 *   PRACTICE → CONTRACT* → PURCHASE*
 * CONTRACT → PURCHASE*
 * PRACTICE → CONTRACT* → PURCHASE*
 * PURCHASE → (none)
 *
 * * = nested cascade continues to grandchildren.
 */

/** Soft-delete purchases linked to the given contracts (active only). */
export async function softDeletePurchasesForContracts(
  tx: TransactionClient,
  contractIds: string[],
) {
  if (contractIds.length === 0) return;
  await tx.purchase.updateMany({
    where: { contractId: { in: contractIds }, ...ACTIVE_ONLY },
    data: { deletedAt: deletedNow() },
  });
}

/** Soft-delete contracts matching `where` and their linked purchases. */
export async function softDeleteContractsCascade(
  tx: TransactionClient,
  where: Prisma.ContractWhereInput,
) {
  const contracts = await tx.contract.findMany({
    where: { ...where, ...ACTIVE_ONLY },
    select: { id: true },
  });
  const ids = contracts.map((c) => c.id);
  if (ids.length === 0) return;
  await softDeletePurchasesForContracts(tx, ids);
  await tx.contract.updateMany({
    where: { id: { in: ids } },
    data: { deletedAt: deletedNow() },
  });
}

/** Soft-delete practices matching `where`, their contracts, and those purchases. */
export async function softDeletePracticesCascade(
  tx: TransactionClient,
  where: Prisma.PracticeWhereInput,
) {
  const practices = await tx.practice.findMany({
    where: { ...where, ...ACTIVE_ONLY },
    select: { id: true },
  });
  const ids = practices.map((p) => p.id);
  if (ids.length === 0) return;
  await softDeleteContractsCascade(tx, { practiceId: { in: ids } });
  await tx.practice.updateMany({
    where: { id: { in: ids } },
    data: { deletedAt: deletedNow() },
  });
}

/** Full project subtree: contracts, practices (+ their contracts), direct purchases. */
export async function softDeleteProjectChildren(
  tx: TransactionClient,
  projectId: string,
) {
  await softDeleteContractsCascade(tx, { projectId });
  await softDeletePracticesCascade(tx, { projectId });
  await tx.purchase.updateMany({
    where: { projectId, ...ACTIVE_ONLY },
    data: { deletedAt: deletedNow() },
  });
}

/** Cascade-delete projects matching `where` and their full subtrees (used by site). */
export async function softDeleteProjectsCascade(
  tx: TransactionClient,
  where: Prisma.ProjectWhereInput,
) {
  const projects = await tx.project.findMany({
    where: { ...where, ...ACTIVE_ONLY },
    select: { id: true },
  });
  const ids = projects.map((p) => p.id);
  if (ids.length === 0) return;
  for (const id of ids) {
    await softDeleteProjectChildren(tx, id);
  }
  await tx.project.updateMany({
    where: { id: { in: ids } },
    data: { deletedAt: deletedNow() },
  });
}

/** Company subtree: contracts, awarded practices, and direct purchases. */
export async function softDeleteCompanyChildren(
  tx: TransactionClient,
  companyId: string,
) {
  await softDeleteContractsCascade(tx, { companyId });
  await softDeletePracticesCascade(tx, { awardedCompanyId: companyId });
  await tx.purchase.updateMany({
    where: { companyId, ...ACTIVE_ONLY },
    data: { deletedAt: deletedNow() },
  });
}
