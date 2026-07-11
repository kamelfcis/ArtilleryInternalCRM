import "server-only";
import { hasRoleAtLeast, type Role } from "@/lib/constants";
import { levenshtein, normalize, tokenize } from "./normalize";
import { SEARCH_PROVIDERS, type Candidate, type SearchProvider } from "./providers";
import { DEFAULT_PER_GROUP, MAX_PAGE_LIMIT, SCAN_CAP } from "./config";
import {
  SEARCH_ENTITY_META,
  type SearchEntityType,
  type SearchGroup,
  type SearchResponse,
  type SearchResult,
} from "./types";

/**
 * The generic search engine. It is the ONLY place that matches, scores, ranks,
 * limits and groups — providers merely supply candidates. Everything runs on a
 * bounded in-memory scan of SQLite rows (no external engine, no FTS extension),
 * which lets us apply full Arabic folding + typo tolerance that raw SQL LIKE
 * cannot express. Tuning limits live in ./config (client-safe).
 */

interface Actor {
  role: Role;
}

/**
 * Score one field against the query. Tiered so intent ranks intuitively:
 * exact > prefix > word-prefix > contains > all-tokens > fuzzy (Levenshtein).
 * Typo tolerance only kicks in for queries of length ≥ 3, with a tight bound.
 */
function scoreField(q: string, qTokens: string[], fieldRaw: string): number {
  const f = normalize(fieldRaw);
  if (!f) return 0;
  if (f === q) return 100;
  if (f.startsWith(q)) return 80;

  const words = f.split(/\s+/).filter(Boolean);
  if (words.some((w) => w.startsWith(q))) return 60;
  if (f.includes(q)) return 45;
  if (qTokens.length > 1 && qTokens.every((t) => f.includes(t))) return 40;

  if (q.length >= 3) {
    const thr = q.length <= 4 ? 1 : 2;
    let best = 0;
    for (const w of words) {
      if (Math.abs(w.length - q.length) <= thr) {
        const d = levenshtein(q, w, thr);
        if (d <= thr) best = Math.max(best, 30 - d * 8);
      }
    }
    if (best > 0) return best;
  }
  return 0;
}

/** Best score across a candidate's haystack; the title (index 0) ranks higher. */
function scoreCandidate(q: string, qTokens: string[], c: Candidate): number {
  let best = 0;
  for (let i = 0; i < c.haystack.length; i++) {
    const weight = i === 0 ? 1 : 0.6;
    const s = scoreField(q, qTokens, c.haystack[i]!) * weight;
    if (s > best) best = s;
  }
  return best;
}

function toResult(
  provider: SearchProvider,
  c: Candidate,
  score: number,
): SearchResult {
  return {
    key: `${provider.entityType}:${c.id}`,
    id: c.id,
    entityType: provider.entityType,
    title: c.title,
    subtitle: c.subtitle,
    breadcrumb: c.breadcrumb,
    status: c.status,
    href: c.href,
    updatedAt: c.updatedAt ? c.updatedAt.toISOString() : null,
    score,
  };
}

/** Descending by score, then most-recently-updated. */
function rank(a: SearchResult, b: SearchResult): number {
  if (b.score !== a.score) return b.score - a.score;
  return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
}

/** Run one provider end-to-end: load → score → filter → rank. */
async function runProvider(
  provider: SearchProvider,
  q: string,
  qTokens: string[],
): Promise<SearchResult[]> {
  const candidates = await provider.load(SCAN_CAP);
  const scored: SearchResult[] = [];
  for (const c of candidates) {
    const score = scoreCandidate(q, qTokens, c);
    if (score > 0) scored.push(toResult(provider, c, score));
  }
  scored.sort(rank);
  return scored;
}

/** Providers visible to this actor (RBAC gate). */
function visibleProviders(actor: Actor): SearchProvider[] {
  return SEARCH_PROVIDERS.filter(
    (p) => !p.minRole || hasRoleAtLeast(actor.role, p.minRole),
  );
}

function prepareQuery(query: string): { q: string; tokens: string[] } | null {
  const q = normalize(query).trim();
  if (q.length === 0) return null;
  return { q, tokens: tokenize(q) };
}

/**
 * Search every visible entity at once (the command palette). Returns groups in
 * the registry's display order, each sliced to `perGroup` with a `total` for
 * the "view all" affordance.
 */
export async function searchAll(
  query: string,
  actor: Actor,
  perGroup: number = DEFAULT_PER_GROUP,
): Promise<SearchResponse> {
  const prepared = prepareQuery(query);
  if (!prepared) return { query, groups: [], total: 0 };
  const { q, tokens } = prepared;

  const providers = visibleProviders(actor);
  const perProvider = await Promise.all(
    providers.map(async (p) => ({ provider: p, results: await runProvider(p, q, tokens) })),
  );

  const groups: SearchGroup[] = [];
  let total = 0;
  for (const { provider, results } of perProvider) {
    if (results.length === 0) continue;
    total += results.length;
    groups.push({
      entityType: provider.entityType,
      label: SEARCH_ENTITY_META[provider.entityType].label,
      items: results.slice(0, Math.max(1, perGroup)),
      total: results.length,
    });
  }
  groups.sort(
    (a, b) =>
      SEARCH_ENTITY_META[a.entityType].order -
      SEARCH_ENTITY_META[b.entityType].order,
  );

  return { query, groups, total };
}

/**
 * Paginated search within a single entity (the full results page "load more").
 * RBAC-gated; returns the page window plus the overall match count.
 */
export async function searchEntity(
  entityType: SearchEntityType,
  query: string,
  actor: Actor,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: SearchResult[]; total: number }> {
  const provider = visibleProviders(actor).find((p) => p.entityType === entityType);
  if (!provider) return { items: [], total: 0 };

  const prepared = prepareQuery(query);
  if (!prepared) return { items: [], total: 0 };

  const results = await runProvider(provider, prepared.q, prepared.tokens);
  const limit = Math.min(Math.max(1, opts.limit ?? MAX_PAGE_LIMIT), MAX_PAGE_LIMIT);
  const offset = Math.max(0, opts.offset ?? 0);
  return { items: results.slice(offset, offset + limit), total: results.length };
}
