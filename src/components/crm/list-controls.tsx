"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Search, X } from "lucide-react";

interface ListControlsProps {
  searchPlaceholder?: string;
  statusOptions?: { value: string; label: string }[];
}

/**
 * Server-driven list controls. Search and status filter are reflected in the
 * URL query string; the server page reads them and re-queries. Changing a
 * filter resets pagination to page 1.
 */
export function ListControls({
  searchPlaceholder = "بحث…",
  statusOptions,
}: ListControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(searchParams.get("search") ?? "");

  const pushWith = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          pushWith((p) => {
            if (term.trim()) p.set("search", term.trim());
            else p.delete("search");
          });
        }}
        className="relative flex-1"
      >
        <Search
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 start-3"
          aria-hidden
        />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={searchPlaceholder}
          className="field-input ps-9 pe-9"
          aria-label="بحث"
        />
        {term && (
          <button
            type="button"
            onClick={() => {
              setTerm("");
              pushWith((p) => p.delete("search"));
            }}
            className="absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 end-3"
            aria-label="مسح البحث"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </form>

      {statusOptions && statusOptions.length > 0 && (
        <select
          value={searchParams.get("status") ?? ""}
          onChange={(e) =>
            pushWith((p) => {
              if (e.target.value) p.set("status", e.target.value);
              else p.delete("status");
            })
          }
          className="field-input sm:w-52"
          aria-label="تصفية حسب الحالة"
        >
          <option value="">كل الحالات</option>
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
