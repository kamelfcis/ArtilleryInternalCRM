import "server-only";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { ENTITY_KINDS } from "@/lib/crm/constants";
import { provisionEntityFolder } from "@/lib/crm/entity-folder";
import type { ContractInput } from "@/lib/crm/validators";
import { softDeletePurchasesForContracts } from "./cascade-soft-delete";
import {
  auditRecord,
  decimalToNumber,
  paginate,
  type ListParams,
} from "./shared";

export async function listContracts(params: ListParams = {}) {
  const { take, skip } = paginate(params);
  const search = params.search?.trim();
  const where = {
    deletedAt: null,
    ...(params.status ? { status: params.status } : {}),
    ...(search
      ? {
          OR: [
            { contractNumber: { contains: search } },
            { title: { contains: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        contractNumber: true,
        title: true,
        description: true,
        status: true,
        value: true,
        currency: true,
        signedDate: true,
        startDate: true,
        endDate: true,
        companyId: true,
        projectId: true,
        practiceId: true,
        company: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.contract.count({ where }),
  ]);

  return {
    items: items.map((c) => ({ ...c, value: decimalToNumber(c.value) })),
    total,
    skip,
    take,
  };
}

export async function getContract(id: string) {
  const contract = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
    include: {
      folder: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      practice: { select: { id: true, referenceNumber: true, title: true } },
      createdBy: { select: { name: true } },
      purchases: {
        where: { deletedAt: null },
        select: {
          id: true,
          purchaseNumber: true,
          title: true,
          status: true,
          amount: true,
          currency: true,
        },
      },
    },
  });
  if (!contract) throw new NotFoundError("العقد غير موجود");
  return {
    ...contract,
    value: decimalToNumber(contract.value),
    purchases: contract.purchases.map((p) => ({
      ...p,
      amount: decimalToNumber(p.amount),
    })),
  };
}

async function assertNumberUnique(num: string, excludeId?: string) {
  const existing = await prisma.contract.findFirst({
    where: { contractNumber: num, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  if (existing) throw new ConflictError("يوجد عقد آخر بنفس الرقم");
}

async function assertRefs(input: ContractInput) {
  const company = await prisma.company.findFirst({
    where: { id: input.companyId, deletedAt: null },
    select: { id: true },
  });
  if (!company) throw new NotFoundError("الشركة المحددة غير موجودة");

  if (input.projectId) {
    const p = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
      select: { id: true },
    });
    if (!p) throw new NotFoundError("المشروع المحدد غير موجود");
  }
  if (input.practiceId) {
    const pr = await prisma.practice.findFirst({
      where: { id: input.practiceId, deletedAt: null },
      select: { id: true },
    });
    if (!pr) throw new NotFoundError("الممارسة المحددة غير موجودة");
  }
}

export async function createContract(input: ContractInput, actorId: string) {
  await assertNumberUnique(input.contractNumber);
  await assertRefs(input);

  const contract = await prisma.contract.create({
    data: {
      contractNumber: input.contractNumber,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      value: input.value,
      currency: input.currency,
      companyId: input.companyId,
      projectId: input.projectId ?? null,
      practiceId: input.practiceId ?? null,
      signedDate: input.signedDate,
      startDate: input.startDate,
      endDate: input.endDate,
      createdById: actorId,
    },
  });

  const folderId = await provisionEntityFolder(
    ENTITY_KINDS.CONTRACT,
    `${contract.contractNumber} - ${contract.title}`,
    actorId,
  );
  await prisma.contract.update({ where: { id: contract.id }, data: { folderId } });

  await auditRecord("create", ENTITY_KINDS.CONTRACT, contract.id, contract.title, actorId);
  return { ...contract, folderId };
}

export async function updateContract(
  id: string,
  input: ContractInput,
  actorId: string,
) {
  const existing = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, folderId: true },
  });
  if (!existing) throw new NotFoundError("العقد غير موجود");
  await assertNumberUnique(input.contractNumber, id);
  await assertRefs(input);

  const contract = await prisma.contract.update({
    where: { id },
    data: {
      contractNumber: input.contractNumber,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      value: input.value,
      currency: input.currency,
      companyId: input.companyId,
      projectId: input.projectId ?? null,
      practiceId: input.practiceId ?? null,
      signedDate: input.signedDate,
      startDate: input.startDate,
      endDate: input.endDate,
    },
  });

  await auditRecord("update", ENTITY_KINDS.CONTRACT, id, contract.title, actorId);
  return contract;
}

export async function softDeleteContract(id: string, actorId: string) {
  const contract = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, title: true },
  });
  if (!contract) throw new NotFoundError("العقد غير موجود");

  await prisma.$transaction(async (tx) => {
    await softDeletePurchasesForContracts(tx, [id]);
    await tx.contract.update({ where: { id }, data: { deletedAt: new Date() } });
  });

  await auditRecord("delete", ENTITY_KINDS.CONTRACT, id, contract.title, actorId);
}
