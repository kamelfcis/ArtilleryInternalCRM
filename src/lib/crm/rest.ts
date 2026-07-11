import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasRoleAtLeast, ROLES } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import type { CrmEntityConfig } from "@/lib/crm/registry";
import { DEFAULT_PAGE_SIZE } from "@/lib/crm/services/shared";

/**
 * REST API handler factories for CRM entities. Each entity's route files simply
 * re-export the produced handlers. All handlers authenticate, enforce RBAC, and
 * delegate to the shared service registry — no business logic lives here.
 *
 *   GET    /api/crm/<entity>        list (?search, ?status, ?page, ?pageSize)
 *   POST   /api/crm/<entity>        create            (EDITOR+)
 *   GET    /api/crm/<entity>/:id    read
 *   PATCH  /api/crm/<entity>/:id    update            (EDITOR+)
 *   DELETE /api/crm/<entity>/:id    soft-delete       (MANAGER+)
 */

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function handleError(error: unknown) {
  if (error instanceof AppError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  console.error("[crm.api] unexpected error", error);
  return json({ error: "حدث خطأ غير متوقع" }, 500);
}

/** Coerce a JSON body's values to strings so string-based schemas validate. */
function coerceBody(body: unknown): Record<string, string> {
  if (!body || typeof body !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (value == null) continue;
    out[key] = typeof value === "string" ? value : String(value);
  }
  return out;
}

export function listCreateHandlers(config: CrmEntityConfig) {
  async function GET(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return json({ error: "غير مصرح" }, 401);

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(sp.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
    );

    try {
      const result = await config.list({
        search: sp.get("search") ?? undefined,
        status: sp.get("status") ?? undefined,
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      return json({
        data: result.items,
        pagination: {
          total: result.total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
        },
      });
    } catch (error) {
      return handleError(error);
    }
  }

  async function POST(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return json({ error: "غير مصرح" }, 401);
    if (!hasRoleAtLeast(user.role, ROLES.EDITOR)) {
      return json({ error: "لا تملك صلاحية الإضافة" }, 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "صيغة الطلب غير صحيحة" }, 400);
    }

    const parsed = config.schema.safeParse(coerceBody(body));
    if (!parsed.success) {
      return json(
        { error: "بيانات غير صحيحة", fieldErrors: parsed.error.flatten().fieldErrors },
        422,
      );
    }

    try {
      const created = await config.create(parsed.data, user.id);
      return json({ data: created }, 201);
    } catch (error) {
      return handleError(error);
    }
  }

  return { GET, POST };
}

export function itemHandlers(config: CrmEntityConfig) {
  async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
    const user = await getCurrentUser();
    if (!user) return json({ error: "غير مصرح" }, 401);
    try {
      const record = await config.get(ctx.params.id);
      return json({ data: record });
    } catch (error) {
      return handleError(error);
    }
  }

  async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
    const user = await getCurrentUser();
    if (!user) return json({ error: "غير مصرح" }, 401);
    if (!hasRoleAtLeast(user.role, ROLES.EDITOR)) {
      return json({ error: "لا تملك صلاحية التعديل" }, 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "صيغة الطلب غير صحيحة" }, 400);
    }

    const parsed = config.schema.safeParse(coerceBody(body));
    if (!parsed.success) {
      return json(
        { error: "بيانات غير صحيحة", fieldErrors: parsed.error.flatten().fieldErrors },
        422,
      );
    }

    try {
      const updated = await config.update(ctx.params.id, parsed.data, user.id);
      return json({ data: updated });
    } catch (error) {
      return handleError(error);
    }
  }

  async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
    const user = await getCurrentUser();
    if (!user) return json({ error: "غير مصرح" }, 401);
    if (!hasRoleAtLeast(user.role, ROLES.MANAGER)) {
      return json({ error: "لا تملك صلاحية الحذف" }, 403);
    }
    try {
      await config.remove(ctx.params.id, user.id);
      return json({ data: { id: ctx.params.id, deleted: true } });
    } catch (error) {
      return handleError(error);
    }
  }

  return { GET, PATCH, DELETE };
}
