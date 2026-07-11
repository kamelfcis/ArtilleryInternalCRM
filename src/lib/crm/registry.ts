import "server-only";
import type { ZodType } from "zod";
import type { EntityKind } from "@/lib/crm/constants";
import type { ListParams } from "@/lib/crm/services/shared";

import {
  siteSchema,
  companySchema,
  projectSchema,
  practiceSchema,
  contractSchema,
  purchaseSchema,
} from "@/lib/crm/validators";

import * as company from "@/lib/crm/services/company";
import * as site from "@/lib/crm/services/site";
import * as project from "@/lib/crm/services/project";
import * as practice from "@/lib/crm/services/practice";
import * as contract from "@/lib/crm/services/contract";
import * as purchase from "@/lib/crm/services/purchase";

/**
 * Per-entity configuration binding a validation schema and the CRUD service
 * functions. Both the UI server actions and the REST API handlers are thin
 * wrappers over this single registry, so business rules live in exactly one
 * place (the services).
 */
export interface CrmEntityConfig<I = unknown> {
  kind: EntityKind;
  route: string;
  schema: ZodType<I>;
  list: (params: ListParams) => Promise<{
    items: unknown[];
    total: number;
    skip: number;
    take: number;
  }>;
  get: (id: string) => Promise<unknown>;
  create: (input: I, actorId: string) => Promise<{ id: string }>;
  update: (id: string, input: I, actorId: string) => Promise<{ id: string }>;
  remove: (id: string, actorId: string) => Promise<void>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const CRM_REGISTRY: Record<EntityKind, CrmEntityConfig<any>> = {
  COMPANY: {
    kind: "COMPANY",
    route: "companies",
    schema: companySchema,
    list: company.listCompanies,
    get: company.getCompany,
    create: company.createCompany,
    update: company.updateCompany,
    remove: company.softDeleteCompany,
  },
  SITE: {
    kind: "SITE",
    route: "sites",
    schema: siteSchema,
    list: site.listSites,
    get: site.getSite,
    create: site.createSite,
    update: site.updateSite,
    remove: site.softDeleteSite,
  },
  PROJECT: {
    kind: "PROJECT",
    route: "projects",
    schema: projectSchema,
    list: project.listProjects,
    get: project.getProject,
    create: project.createProject,
    update: project.updateProject,
    remove: project.softDeleteProject,
  },
  PRACTICE: {
    kind: "PRACTICE",
    route: "practices",
    schema: practiceSchema,
    list: practice.listPractices,
    get: practice.getPractice,
    create: practice.createPractice,
    update: practice.updatePractice,
    remove: practice.softDeletePractice,
  },
  CONTRACT: {
    kind: "CONTRACT",
    route: "contracts",
    schema: contractSchema,
    list: contract.listContracts,
    get: contract.getContract,
    create: contract.createContract,
    update: contract.updateContract,
    remove: contract.softDeleteContract,
  },
  PURCHASE: {
    kind: "PURCHASE",
    route: "purchases",
    schema: purchaseSchema,
    list: purchase.listPurchases,
    get: purchase.getPurchase,
    create: purchase.createPurchase,
    update: purchase.updatePurchase,
    remove: purchase.softDeletePurchase,
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */
