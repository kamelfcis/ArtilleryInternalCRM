"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, CornerDownLeft, ArrowUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { toArabicDigits } from "@/lib/utils";
import type { SearchResponse } from "@/lib/search/types";
import { ResultRowContent } from "./result-row";

const DEBOUNCE_MS = 250;

/**
 * Universal search command palette. Opens on Ctrl/⌘-K or the header search
 * button. Type-ahead is debounced and aborts in-flight requests; results come
 * from the server engine (cmdk filtering disabled). Fully keyboard-navigable,
 * Arabic/RTL, grouped by entity with highlighted matches.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  // Global Ctrl/⌘-K toggle.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Debounced, abortable search.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const ticket = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?scope=all&q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        const data: SearchResponse = await res.json();
        if (ticket === seq.current) setResults(data);
      } catch {
        if (!controller.signal.aborted && ticket === seq.current) {
          setResults({ query: q, groups: [], total: 0 });
        }
      } finally {
        if (ticket === seq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults(null);
      setLoading(false);
    }
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const hasQuery = query.trim().length > 0;
  const groups = results?.groups ?? [];
  const showEmpty = hasQuery && !loading && groups.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="بحث شامل"
        className="btn-ghost flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-slate-400 hover:text-slate-600"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="hidden text-sm sm:inline">بحث…</span>
        <kbd className="hidden items-center gap-0.5 rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-slate-400 md:inline-flex">
          Ctrl K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-0" dir="rtl">
          <DialogTitle className="sr-only">بحث شامل في النظام</DialogTitle>
          <DialogDescription className="sr-only">
            ابحث في الشركات والمشروعات والعقود والمستندات والمهام والاعتمادات
          </DialogDescription>

          <Command shouldFilter={false} loop>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="ابحث في كل النظام… (شركات، عقود، مهام، مستندات)"
            />

            <CommandList>
              {!hasQuery && (
                <p className="px-2 py-10 text-center text-sm text-slate-400">
                  ابدأ الكتابة للبحث في جميع أنحاء النظام
                </p>
              )}

              {hasQuery && loading && !results && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  جارٍ البحث…
                </div>
              )}

              {showEmpty && <CommandEmpty>لا توجد نتائج مطابقة</CommandEmpty>}

              {groups.map((group) => (
                <CommandGroup
                  key={group.entityType}
                  heading={`${group.label} (${toArabicDigits(String(group.total))})`}
                >
                  {group.items.map((result) => (
                    <CommandItem
                      key={result.key}
                      value={result.key}
                      onSelect={() => go(result.href)}
                    >
                      <ResultRowContent result={result} query={query} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}

              {hasQuery && groups.length > 0 && (
                <CommandItem
                  key="__view_all__"
                  value="__view_all__"
                  onSelect={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}
                  className="justify-center text-sm text-brand-600"
                >
                  عرض كل النتائج ({toArabicDigits(String(results?.total ?? 0))})
                </CommandItem>
              )}
            </CommandList>

            <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3" aria-hidden />
                للتنقل
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" aria-hidden />
                للفتح · Esc للإغلاق
              </span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
