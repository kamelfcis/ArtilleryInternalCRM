import "server-only";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { ENTITY_KINDS } from "@/lib/crm/constants";
import {
  provisionEntityFolder,
  syncEntityFolderName,
} from "@/lib/crm/entity-folder";
import type { ProjectInput } from "@/lib/crm/validators";
import { softDeleteProjectChildren } from "./cascade-soft-delete";
import {
  auditRecord,
  decimalToNumber,
  paginate,
  type ListParams,
} from "./shared";

export async function listProjects(params: ListParams = {}) {
  const { take, skip } = paginate(params);
  const search = params.search?.trim();
  const where = {
    deletedAt: null,
    ...(params.status ? { status: params.status } : {}),
    ...(search
      ? { OR: [{ name: { contains: search } }, { code: { contains: search } }] }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        status: true,
        budget: true,
        siteId: true,
        startDate: true,
        endDate: true,
        site: { select: { id: true, name: true } },
        _count: { select: { contracts: true, purchases: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return {
    items: items.map((p) => ({ ...p, budget: decimalToNumber(p.budget) })),
    total,
    skip,
    take,
  };
}

export async function getProject(id: string) {
  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    include: {
      folder: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
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
          company: { select: { id: true, name: true } },
        },
      },
      practices: {
        where: { deletedAt: null },
        select: { id: true, referenceNumber: true, title: true, status: true },
      },
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
  if (!project) throw new NotFoundError("المشروع غير موجود");

  return {
    ...project,
    budget: decimalToNumber(project.budget),
    contracts: project.contracts.map((c) => ({
      ...c,
      value: decimalToNumber(c.value),
    })),
    purchases: project.purchases.map((p) => ({
      ...p,
      amount: decimalToNumber(p.amount),
    })),
  };
}

export async function createProject(input: ProjectInput, actorId: string) {
  if (input.siteId) await assertSiteExists(input.siteId);

  const project = await prisma.project.create({
    data: {
      name: input.name,
      code: input.code ?? null,
      description: input.description ?? null,
      status: input.status,
      budget: input.budget,
      siteId: input.siteId ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
      createdById: actorId,
    },
  });

  const folderId = await provisionEntityFolder(
    ENTITY_KINDS.PROJECT,
    project.name,
    actorId,
  );
  await prisma.project.update({ where: { id: project.id }, data: { folderId } });

  await auditRecord("create", ENTITY_KINDS.PROJECT, project.id, project.name, actorId);
  return { ...project, folderId };
}

export async function updateProject(
  id: string,
  input: ProjectInput,
  actorId: string,
) {
  const existing = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, folderId: true },
  });
  if (!existing) throw new NotFoundError("المشروع غير موجود");
  if (input.siteId) await assertSiteExists(input.siteId);

  const project = await prisma.project.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code ?? null,
      description: input.description ?? null,
      status: input.status,
      budget: input.budget,
      siteId: input.siteId ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
    },
  });

  await syncEntityFolderName(existing.folderId, project.name, actorId);
  await auditRecord("update", ENTITY_KINDS.PROJECT, id, project.name, actorId);
  return project;
}

export async function softDeleteProject(id: string, actorId: string) {
  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!project) throw new NotFoundError("المشروع غير موجود");

  await prisma.$transaction(async (tx) => {
    await softDeleteProjectChildren(tx, id);
    await tx.project.update({ where: { id }, data: { deletedAt: new Date() } });
  });

  await auditRecord("delete", ENTITY_KINDS.PROJECT, id, project.name, actorId);
}

async function assertSiteExists(siteId: string) {
  const site = await prisma.site.findFirst({
    where: { id: siteId, deletedAt: null },
    select: { id: true },
  });
  if (!site) throw new NotFoundError("الموقع المحدد غير موجود");
}
