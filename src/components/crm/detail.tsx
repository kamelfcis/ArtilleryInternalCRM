import Link from "next/link";
import { FolderOpen, ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

/** Card section with a heading. */
export function DetailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-card border border-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold text-brand-900">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Definition-list grid of label/value pairs. Empty values show a dash. */
export function InfoGrid({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item, i) => (
        <div key={i}>
          <dt className="text-xs text-slate-400">{item.label}</dt>
          <dd className="mt-0.5 text-sm text-brand-900">
            {item.value === null || item.value === undefined || item.value === ""
              ? "—"
              : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface RelatedItem {
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}

/** Compact list of related records linking to their detail pages. */
export function RelatedList({
  items,
  emptyLabel,
}: {
  items: RelatedItem[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="py-2 text-sm text-slate-400">{emptyLabel}</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-muted"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-brand-900">
                {item.title}
              </p>
              {item.subtitle && (
                <p className="truncate text-xs text-slate-500">
                  {item.subtitle}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.trailing}
              <ChevronLeft className="h-4 w-4 text-slate-300" aria-hidden />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Button linking to a record's dedicated document folder. */
export function DocumentsFolderButton({ folderId }: { folderId: string | null }) {
  if (!folderId) return null;
  return (
    <Link href={`/folders/${folderId}`} className="btn-secondary">
      <FolderOpen className="h-4 w-4" aria-hidden />
      المستندات
    </Link>
  );
}
