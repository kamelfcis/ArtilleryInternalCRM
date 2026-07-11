"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toArabicDigits } from "@/lib/utils";
import { MAX_PAGE_LIMIT } from "@/lib/search/config";
import type { SearchGroup, SearchResult } from "@/lib/search/types";
import { ResultRowContent } from "./result-row";

interface GroupState extends SearchGroup {
  loading: boolean;
}

/**
 * Full search results with per-entity pagination (lazy "load more"). Seeded by
 * the server's first page, then appends additional windows from the search API
 * on demand — one request per group, bounded by MAX_PAGE_LIMIT.
 */
export function SearchResults({
  query,
  initialGroups,
}: {
  query: string;
  initialGroups: SearchGroup[];
}) {
  const [groups, setGroups] = useState<GroupState[]>(
    initialGroups.map((g) => ({ ...g, loading: false })),
  );

  async function loadMore(entityType: string) {
    setGroups((prev) =>
      prev.map((g) => (g.entityType === entityType ? { ...g, loading: true } : g)),
    );

    const current = groups.find((g) => g.entityType === entityType);
    const offset = current?.items.length ?? 0;

    try {
      const res = await fetch(
        `/api/search?scope=${entityType}&q=${encodeURIComponent(query)}&offset=${offset}&limit=${MAX_PAGE_LIMIT}`,
      );
      const data: { items: SearchResult[]; total: number } = await res.json();
      setGroups((prev) =>
        prev.map((g) =>
          g.entityType === entityType
            ? {
                ...g,
                items: [...g.items, ...data.items],
                total: data.total,
                loading: false,
              }
            : g,
        ),
      );
    } catch {
      setGroups((prev) =>
        prev.map((g) =>
          g.entityType === entityType ? { ...g, loading: false } : g,
        ),
      );
    }
  }

  if (!query.trim()) {
    return (
      <p className="rounded-card border border-line bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-card">
        استخدم شريط البحث أو اضغط <kbd className="rounded border border-line bg-surface-muted px-1.5">Ctrl K</kbd> لبدء البحث
      </p>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="rounded-card border border-line bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-card">
        لا توجد نتائج مطابقة لبحثك
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.entityType}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-900">
            {group.label}
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-normal text-slate-500">
              {toArabicDigits(String(group.total))}
            </span>
          </h2>
          <div className="rounded-card border border-line bg-white p-2 shadow-card">
            <ul className="divide-y divide-line">
              {group.items.map((result) => (
                <li key={result.key}>
                  <Link
                    href={result.href}
                    className="-mx-1 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-muted"
                  >
                    <ResultRowContent result={result} query={query} />
                  </Link>
                </li>
              ))}
            </ul>

            {group.items.length < group.total && (
              <div className="border-t border-line pt-2">
                <button
                  type="button"
                  onClick={() => loadMore(group.entityType)}
                  disabled={group.loading}
                  className="btn-ghost w-full justify-center py-2 text-sm text-brand-600"
                >
                  {group.loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  تحميل المزيد ({toArabicDigits(String(group.total - group.items.length))})
                </button>
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
