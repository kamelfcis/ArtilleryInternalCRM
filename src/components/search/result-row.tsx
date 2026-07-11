import { ChevronLeft } from "lucide-react";
import { StatusBadge } from "@/components/crm/status-badge";
import { timeAgo } from "@/lib/utils";
import type { SearchResult } from "@/lib/search/types";
import { EntityIcon } from "./entity-icon";
import { Highlight } from "./highlight";

/**
 * The inner content of one search hit — icon, highlighted Arabic title,
 * breadcrumb, status and last-update. Shared by the command palette rows and
 * the full results page so the presentation never diverges.
 */
export function ResultRowContent({
  result,
  query,
}: {
  result: SearchResult;
  query: string;
}) {
  return (
    <>
      <EntityIcon entityType={result.entityType} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-brand-900">
            <Highlight text={result.title} query={query} />
          </p>
          {result.subtitle && (
            <span className="shrink-0 text-xs text-slate-400">
              {result.subtitle}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
          <span className="truncate">{result.breadcrumb.join(" ‹ ")}</span>
          {result.updatedAt && (
            <>
              <span aria-hidden>·</span>
              <span className="shrink-0">{timeAgo(result.updatedAt)}</span>
            </>
          )}
        </div>
      </div>

      {result.status && (
        <StatusBadge
          label={result.status.label}
          tone={result.status.tone}
          className="shrink-0"
        />
      )}
      <ChevronLeft className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
    </>
  );
}
