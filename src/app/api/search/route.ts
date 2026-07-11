import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { searchAll, searchEntity } from "@/lib/search/engine";
import { DEFAULT_PER_GROUP, MAX_PAGE_LIMIT } from "@/lib/search/config";
import {
  SEARCH_ENTITY_META,
  type SearchEntityType,
} from "@/lib/search/types";

export const dynamic = "force-dynamic";

/**
 * Global search endpoint powering the command palette and the results page.
 * `scope=all` returns grouped results (per-group slice); `scope=<ENTITY>`
 * returns a paginated window for one entity (lazy "load more"). Auth-gated;
 * results are never cached (RBAC + freshness).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const query = (params.get("q") ?? "").slice(0, 200);
  const scope = params.get("scope") ?? "all";
  const actor = { role: user.role };

  const headers = { "Cache-Control": "no-store" };

  if (scope === "all") {
    const perGroup = clampInt(params.get("perGroup"), DEFAULT_PER_GROUP, 1, 10);
    const response = await searchAll(query, actor, perGroup);
    return NextResponse.json(response, { headers });
  }

  if (isSearchEntityType(scope)) {
    const limit = clampInt(params.get("limit"), MAX_PAGE_LIMIT, 1, MAX_PAGE_LIMIT);
    const offset = clampInt(params.get("offset"), 0, 0, 10_000);
    const result = await searchEntity(scope, query, actor, { limit, offset });
    return NextResponse.json(result, { headers });
  }

  return NextResponse.json({ error: "invalid scope" }, { status: 400 });
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function isSearchEntityType(value: string): value is SearchEntityType {
  return value in SEARCH_ENTITY_META;
}
