import "server-only";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { ENTITY_KINDS } from "@/lib/crm/constants";
import { provisionEntityFolder } from "@/lib/crm/entity-folder";
import type { PracticeInput } from "@/lib/crm/validators";
import { softDeleteContractsCascade } from "./cascade-soft-delete";
import {
  auditRecord,
  decimalToNumber,
  paginate,
  type ListParams,
} from "./shared";

export async function listPractices(params: ListParams = {}) {
  const { take, skip } = paginate(params);
  const search = params.search?.trim();
  const where = {
    deletedAt: null,
    ...(params.status ? { status: params.status } : {}),
    ...(search
      ? {
          OR: [
            { referenceNumber: { contains: search } },
            { title: { contains: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.practice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        referenceNumber: true,
        title: true,
        description: true,
        status: true,
        estimatedValue: true,
        openDate: true,
        closeDate: true,
        projectId: true,
        awardedCompanyId: true,
        project: { select: { id: true, name: true } },
        awardedCompany: { select: { id: true, name: true } },
      },
    }),
    prisma.practice.count({ where }),
  ]);

  return {
    items: items.map((p) => ({
      ...p,
      estimatedValue: decimalToNumber(p.estimatedValue),
    })),
    total,
    skip,
    take,
  };
}

export async function getPractice(id: string) {
  const practice = await prisma.practice.findFirst({
    where: { id, deletedAt: null },
    include: {
      folder: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      awardedCompany: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      contracts: {
        where: { deletedAt: null },
        select: {
          id: true,
          contractNumber: true,
          title: true,
          status: true,
          company: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!practice) throw new NotFoundError("الممارسة غير موجودة");
  return {
    ...practice,
    estimatedValue: decimalToNumber(practice.estimatedValue),
  };
}

async function assertRefUnique(ref: string, excludeId?: string) {
  const existing = await prisma.practice.findFirst({
    where: { referenceNumber: ref, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  if (existing) throw new ConflictError("يوجد ممارسة أخرى بنفس الرقم المرجعي");
}

export async function createPractice(input: PracticeInput, actorId: string) {
  await assertRefUnique(input.referenceNumber);
  await assertRefs(input);

  const practice = await prisma.practice.create({
    data: {
      referenceNumber: input.referenceNumber,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      estimatedValue: input.estimatedValue,
      projectId: input.projectId ?? null,
      awardedCompanyId: input.awardedCompanyId ?? null,
      openDate: input.openDate,
      closeDate: input.closeDate,
      createdById: actorId,
    },
  });

  const folderId = await provisionEntityFolder(
    ENTITY_KINDS.PRACTICE,
    `${practice.referenceNumber} - ${practice.title}`,
    actorId,
  );
  await prisma.practice.update({ where: { id: practice.id }, data: { folderId } });

  await auditRecord("create", ENTITY_KINDS.PRACTICE, practice.id, practice.title, actorId);
  return { ...practice, folderId };
}

export async function updatePractice(
  id: string,
  input: PracticeInput,
  actorId: string,
) {
  const existing = await prisma.practice.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, folderId: true },
  });
  if (!existing) throw new NotFoundError("الممارسة غير موجودة");
  await assertRefUnique(input.referenceNumber, id);
  await assertRefs(input);

  const practice = await prisma.practice.update({
    where: { id },
    data: {
      referenceNumber: input.referenceNumber,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      estimatedValue: input.estimatedValue,
      projectId: input.projectId ?? null,
      awardedCompanyId: input.awardedCompanyId ?? null,
      openDate: input.openDate,
      closeDate: input.closeDate,
    },
  });

  await auditRecord("update", ENTITY_KINDS.PRACTICE, id, practice.title, actorId);
  return practice;
}

export async function softDeletePractice(id: string, actorId: string) {
  const practice = await prisma.practice.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, title: true },
  });
  if (!practice) throw new NotFoundError("الممارسة غير موجودة");

  await prisma.$transaction(async (tx) => {
    await softDeleteContractsCascade(tx, { practiceId: id });
    await tx.practice.update({ where: { id }, data: { deletedAt: new Date() } });
  });

  await auditRecord("delete", ENTITY_KINDS.PRACTICE, id, practice.title, actorId);
}

async function assertRefs(input: PracticeInput) {
  if (input.projectId) {
    const p = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
      select: { id: true },
    });
    if (!p) throw new NotFoundError("المشروع المحدد غير موجود");
  }
  if (input.awardedCompanyId) {
    const c = await prisma.company.findFirst({
      where: { id: input.awardedCompanyId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundError("الشركة المحددة غير موجودة");
  }
}
