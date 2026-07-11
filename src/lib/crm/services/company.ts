import "server-only";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { ENTITY_KINDS } from "@/lib/crm/constants";
import {
  provisionEntityFolder,
  syncEntityFolderName,
} from "@/lib/crm/entity-folder";
import type { CompanyInput } from "@/lib/crm/validators";
import { softDeleteCompanyChildren } from "./cascade-soft-delete";
import {
  auditRecord,
  decimalToNumber,
  paginate,
  type ListParams,
} from "./shared";

export async function listCompanies(params: ListParams = {}) {
  const { take, skip } = paginate(params);
  const search = params.search?.trim();

  const where = {
    deletedAt: null,
    ...(params.status ? { status: params.status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { code: { contains: search } },
            { contactPerson: { contains: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
      select: {
        id: true,
        name: true,
        code: true,
        contactPerson: true,
        phone: true,
        email: true,
        address: true,
        notes: true,
        status: true,
        _count: { select: { contracts: true, purchases: true } },
      },
    }),
    prisma.company.count({ where }),
  ]);

  return { items, total, skip, take };
}

export async function getCompany(id: string) {
  const company = await prisma.company.findFirst({
    where: { id, deletedAt: null },
    include: {
      folder: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      contracts: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          contractNumber: true,
          title: true,
          status: true,
          value: true,
          currency: true,
        },
      },
      purchases: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          purchaseNumber: true,
          title: true,
          status: true,
          amount: true,
          currency: true,
        },
      },
      awardedPractices: {
        where: { deletedAt: null },
        select: { id: true, referenceNumber: true, title: true, status: true },
      },
    },
  });
  if (!company) throw new NotFoundError("الشركة غير موجودة");

  return {
    ...company,
    contracts: company.contracts.map((c) => ({
      ...c,
      value: decimalToNumber(c.value),
    })),
    purchases: company.purchases.map((p) => ({
      ...p,
      amount: decimalToNumber(p.amount),
    })),
  };
}

async function assertUniqueCode(code: string | undefined, excludeId?: string) {
  if (!code) return;
  const existing = await prisma.company.findFirst({
    where: {
      code,
      deletedAt: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new ConflictError("يوجد شركة أخرى بنفس الرمز");
}

export async function createCompany(input: CompanyInput, actorId: string) {
  await assertUniqueCode(input.code);

  const company = await prisma.company.create({
    data: {
      name: input.name,
      code: input.code ?? null,
      contactPerson: input.contactPerson ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      status: input.status,
      createdById: actorId,
    },
  });

  const folderId = await provisionEntityFolder(
    ENTITY_KINDS.COMPANY,
    company.name,
    actorId,
  );
  await prisma.company.update({ where: { id: company.id }, data: { folderId } });

  await auditRecord("create", ENTITY_KINDS.COMPANY, company.id, company.name, actorId);
  return { ...company, folderId };
}

export async function updateCompany(
  id: string,
  input: CompanyInput,
  actorId: string,
) {
  const existing = await prisma.company.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, folderId: true },
  });
  if (!existing) throw new NotFoundError("الشركة غير موجودة");
  await assertUniqueCode(input.code, id);

  const company = await prisma.company.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code ?? null,
      contactPerson: input.contactPerson ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      status: input.status,
    },
  });

  await syncEntityFolderName(existing.folderId, company.name, actorId);
  await auditRecord("update", ENTITY_KINDS.COMPANY, id, company.name, actorId);
  return company;
}

export async function softDeleteCompany(id: string, actorId: string) {
  const company = await prisma.company.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!company) throw new NotFoundError("الشركة غير موجودة");

  await prisma.$transaction(async (tx) => {
    await softDeleteCompanyChildren(tx, id);
    await tx.company.update({ where: { id }, data: { deletedAt: new Date() } });
  });

  await auditRecord("delete", ENTITY_KINDS.COMPANY, id, company.name, actorId);
}
