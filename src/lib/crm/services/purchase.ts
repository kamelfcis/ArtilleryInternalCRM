import "server-only";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { ENTITY_KINDS } from "@/lib/crm/constants";
import { provisionEntityFolder } from "@/lib/crm/entity-folder";
import type { PurchaseInput } from "@/lib/crm/validators";
import {
  auditRecord,
  decimalToNumber,
  paginate,
  type ListParams,
} from "./shared";

export async function listPurchases(params: ListParams = {}) {
  const { take, skip } = paginate(params);
  const search = params.search?.trim();
  const where = {
    deletedAt: null,
    ...(params.status ? { status: params.status } : {}),
    ...(search
      ? {
          OR: [
            { purchaseNumber: { contains: search } },
            { title: { contains: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        purchaseNumber: true,
        title: true,
        description: true,
        status: true,
        amount: true,
        currency: true,
        requestDate: true,
        deliveryDate: true,
        companyId: true,
        projectId: true,
        contractId: true,
        company: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.purchase.count({ where }),
  ]);

  return {
    items: items.map((p) => ({ ...p, amount: decimalToNumber(p.amount) })),
    total,
    skip,
    take,
  };
}

export async function getPurchase(id: string) {
  const purchase = await prisma.purchase.findFirst({
    where: { id, deletedAt: null },
    include: {
      folder: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      contract: { select: { id: true, contractNumber: true, title: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!purchase) throw new NotFoundError("أمر الشراء غير موجود");
  return { ...purchase, amount: decimalToNumber(purchase.amount) };
}

async function assertRefs(input: PurchaseInput) {
  if (input.companyId) {
    const c = await prisma.company.findFirst({
      where: { id: input.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundError("الشركة المحددة غير موجودة");
  }
  if (input.projectId) {
    const p = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
      select: { id: true },
    });
    if (!p) throw new NotFoundError("المشروع المحدد غير موجود");
  }
  if (input.contractId) {
    const ct = await prisma.contract.findFirst({
      where: { id: input.contractId, deletedAt: null },
      select: { id: true },
    });
    if (!ct) throw new NotFoundError("العقد المحدد غير موجود");
  }
}

export async function createPurchase(input: PurchaseInput, actorId: string) {
  await assertRefs(input);

  const purchase = await prisma.purchase.create({
    data: {
      purchaseNumber: input.purchaseNumber,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      amount: input.amount,
      currency: input.currency,
      companyId: input.companyId ?? null,
      projectId: input.projectId ?? null,
      contractId: input.contractId ?? null,
      requestDate: input.requestDate,
      deliveryDate: input.deliveryDate,
      createdById: actorId,
    },
  });

  const folderId = await provisionEntityFolder(
    ENTITY_KINDS.PURCHASE,
    `${purchase.purchaseNumber} - ${purchase.title}`,
    actorId,
  );
  await prisma.purchase.update({ where: { id: purchase.id }, data: { folderId } });

  await auditRecord("create", ENTITY_KINDS.PURCHASE, purchase.id, purchase.title, actorId);
  return { ...purchase, folderId };
}

export async function updatePurchase(
  id: string,
  input: PurchaseInput,
  actorId: string,
) {
  const existing = await prisma.purchase.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("أمر الشراء غير موجود");
  await assertRefs(input);

  const purchase = await prisma.purchase.update({
    where: { id },
    data: {
      purchaseNumber: input.purchaseNumber,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      amount: input.amount,
      currency: input.currency,
      companyId: input.companyId ?? null,
      projectId: input.projectId ?? null,
      contractId: input.contractId ?? null,
      requestDate: input.requestDate,
      deliveryDate: input.deliveryDate,
    },
  });

  await auditRecord("update", ENTITY_KINDS.PURCHASE, id, purchase.title, actorId);
  return purchase;
}

export async function softDeletePurchase(id: string, actorId: string) {
  const purchase = await prisma.purchase.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, title: true },
  });
  if (!purchase) throw new NotFoundError("أمر الشراء غير موجود");
  await prisma.purchase.update({ where: { id }, data: { deletedAt: new Date() } });
  await auditRecord("delete", ENTITY_KINDS.PURCHASE, id, purchase.title, actorId);
}
