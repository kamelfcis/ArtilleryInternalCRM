import "server-only";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { ENTITY_KINDS } from "@/lib/crm/constants";
import {
  provisionEntityFolder,
  syncEntityFolderName,
} from "@/lib/crm/entity-folder";
import type { SiteInput } from "@/lib/crm/validators";
import { softDeleteProjectsCascade } from "./cascade-soft-delete";
import { auditRecord, paginate, type ListParams } from "./shared";

export async function listSites(params: ListParams = {}) {
  const { take, skip } = paginate(params);
  const search = params.search?.trim();
  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { code: { contains: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.site.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        address: true,
        _count: { select: { projects: true } },
      },
    }),
    prisma.site.count({ where }),
  ]);
  return { items, total, skip, take };
}

export async function getSite(id: string) {
  const site = await prisma.site.findFirst({
    where: { id, deletedAt: null },
    include: {
      folder: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      projects: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, code: true, status: true },
      },
    },
  });
  if (!site) throw new NotFoundError("الموقع غير موجود");
  return site;
}

export async function createSite(input: SiteInput, actorId: string) {
  const site = await prisma.site.create({
    data: {
      name: input.name,
      code: input.code ?? null,
      description: input.description ?? null,
      address: input.address ?? null,
      createdById: actorId,
    },
  });

  const folderId = await provisionEntityFolder(
    ENTITY_KINDS.SITE,
    site.name,
    actorId,
  );
  await prisma.site.update({ where: { id: site.id }, data: { folderId } });

  await auditRecord("create", ENTITY_KINDS.SITE, site.id, site.name, actorId);
  return { ...site, folderId };
}

export async function updateSite(id: string, input: SiteInput, actorId: string) {
  const existing = await prisma.site.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, folderId: true },
  });
  if (!existing) throw new NotFoundError("الموقع غير موجود");

  const site = await prisma.site.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code ?? null,
      description: input.description ?? null,
      address: input.address ?? null,
    },
  });

  await syncEntityFolderName(existing.folderId, site.name, actorId);
  await auditRecord("update", ENTITY_KINDS.SITE, id, site.name, actorId);
  return site;
}

export async function softDeleteSite(id: string, actorId: string) {
  const site = await prisma.site.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!site) throw new NotFoundError("الموقع غير موجود");

  await prisma.$transaction(async (tx) => {
    await softDeleteProjectsCascade(tx, { siteId: id });
    await tx.site.update({ where: { id }, data: { deletedAt: new Date() } });
  });

  await auditRecord("delete", ENTITY_KINDS.SITE, id, site.name, actorId);
}
