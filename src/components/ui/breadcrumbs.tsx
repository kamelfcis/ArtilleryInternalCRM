import Link from "next/link";
import { ChevronLeft, Home } from "lucide-react";

export interface Crumb {
  id: string | null; // null → root
  name: string;
}

/**
 * RTL breadcrumb trail. The separator points left (natural "next" direction in
 * Arabic). The last crumb is rendered as the current, non-clickable location.
 */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="مسار التنقل">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        <li className="flex items-center">
          <Link
            href="/folders"
            className="flex items-center gap-1.5 rounded px-1.5 py-1 text-slate-500 hover:bg-surface-muted hover:text-brand-700"
          >
            <Home className="h-4 w-4" aria-hidden />
            <span>الرئيسية</span>
          </Link>
        </li>
        {trail.map((crumb, idx) => {
          const isLast = idx === trail.length - 1;
          return (
            <li key={crumb.id ?? idx} className="flex items-center">
              <ChevronLeft className="h-4 w-4 text-slate-300" aria-hidden />
              {isLast || !crumb.id ? (
                <span
                  className="px-1.5 py-1 font-medium text-brand-900"
                  aria-current="page"
                >
                  {crumb.name}
                </span>
              ) : (
                <Link
                  href={`/folders/${crumb.id}`}
                  className="rounded px-1.5 py-1 text-slate-500 hover:bg-surface-muted hover:text-brand-700"
                >
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
