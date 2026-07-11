import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/ui/page-header";
import { searchAll } from "@/lib/search/engine";
import { SearchResults } from "@/components/search/search-results";

export const dynamic = "force-dynamic";

/** Initial page size per entity group (subsequent pages load lazily). */
const INITIAL_PER_GROUP = 8;

/**
 * Full global-search results page. Renders the first page of grouped results
 * server-side (RBAC via the engine's actor role); the client component then
 * paginates each group on demand. Reached from the palette's "view all" and by
 * direct navigation to /search?q=…
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const user = await requireUser();
  const query = (searchParams.q ?? "").toString();

  const response = query.trim()
    ? await searchAll(query, { role: user.role }, INITIAL_PER_GROUP)
    : { query, groups: [], total: 0 };

  return (
    <>
      <PageHeader
        title="نتائج البحث"
        description={
          query.trim()
            ? `${response.total} نتيجة لبحثك عن «${query.trim()}»`
            : "ابحث في جميع أنحاء النظام"
        }
      />
      <SearchResults query={query} initialGroups={response.groups} />
    </>
  );
}
