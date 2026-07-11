import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Lightweight option lists ({ value, label }) for relation <select> inputs in
 * the entity forms. Only active (non-deleted) records are offered.
 */

export type Option = { value: string; label: string };

export async function companyOptions(): Promise<Option[]> {
  const rows = await prisma.company.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

export async function siteOptions(): Promise<Option[]> {
  const rows = await prisma.site.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

export async function projectOptions(): Promise<Option[]> {
  const rows = await prisma.project.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
  return rows.map((r) => ({
    value: r.id,
    label: r.code ? `${r.name} (${r.code})` : r.name,
  }));
}

export async function practiceOptions(): Promise<Option[]> {
  const rows = await prisma.practice.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, referenceNumber: true, title: true },
  });
  return rows.map((r) => ({
    value: r.id,
    label: `${r.referenceNumber} — ${r.title}`,
  }));
}

export async function contractOptions(): Promise<Option[]> {
  const rows = await prisma.contract.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, contractNumber: true, title: true },
  });
  return rows.map((r) => ({
    value: r.id,
    label: `${r.contractNumber} — ${r.title}`,
  }));
}
