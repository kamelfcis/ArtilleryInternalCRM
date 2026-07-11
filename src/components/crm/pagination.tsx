import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { toArabicDigits } from "@/lib/utils";

interface PaginationProps {
  basePath: string;
  page: number;
  totalPages: number;
  /** Current query params (e.g. search, status) to preserve across pages. */
  params?: Record<string, string | undefined>;
}

function hrefFor(
  basePath: string,
  page: number,
  params?: Record<string, string | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v) sp.set(k, v);
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({ basePath, page, totalPages, params }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      className="mt-4 flex items-center justify-between"
      aria-label="ترقيم الصفحات"
    >
      {page > 1 ? (
        <Link href={hrefFor(basePath, page - 1, params)} className="btn-secondary">
          <ChevronRight className="h-4 w-4" aria-hidden />
          السابق
        </Link>
      ) : (
        <span className="btn-secondary pointer-events-none opacity-50">
          <ChevronRight className="h-4 w-4" aria-hidden />
          السابق
        </span>
      )}

      <span className="text-sm text-slate-500">
        صفحة {toArabicDigits(String(page))} من {toArabicDigits(String(totalPages))}
      </span>

      {page < totalPages ? (
        <Link href={hrefFor(basePath, page + 1, params)} className="btn-secondary">
          التالي
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <span className="btn-secondary pointer-events-none opacity-50">
          التالي
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </span>
      )}
    </nav>
  );
}
