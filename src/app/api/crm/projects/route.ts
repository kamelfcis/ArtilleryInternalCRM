import { listCreateHandlers } from "@/lib/crm/rest";
import { CRM_REGISTRY } from "@/lib/crm/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = listCreateHandlers(CRM_REGISTRY.PROJECT);
export const GET = handlers.GET;
export const POST = handlers.POST;
