import { itemHandlers } from "@/lib/crm/rest";
import { CRM_REGISTRY } from "@/lib/crm/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = itemHandlers(CRM_REGISTRY.CONTRACT);
export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
