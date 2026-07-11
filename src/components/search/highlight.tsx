import type { ReactNode } from "react";
import { normalize, normalizeWithMap } from "@/lib/search/normalize";

/**
 * Highlight the matched portion of a title/breadcrumb. Because matching is
 * Arabic-folded (أ≈ا, ة≈ه, diacritics stripped), we highlight against the
 * normalized text and use the index map to wrap the ORIGINAL (un-folded) slice,
 * so the visible text keeps its diacritics. Falls back to the longest matching
 * token; a pure typo (fuzzy) match highlights nothing rather than mislead.
 */
export function Highlight({
  text,
  query,
}: {
  text: string;
  query: string;
}): ReactNode {
  const nq = normalize(query).trim();
  if (!nq) return text;

  const { normalized, map } = normalizeWithMap(text);

  let idx = normalized.indexOf(nq);
  let len = nq.length;

  if (idx < 0) {
    const tokens = nq
      .split(/\s+/)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    for (const t of tokens) {
      const i = normalized.indexOf(t);
      if (i >= 0) {
        idx = i;
        len = t.length;
        break;
      }
    }
  }

  if (idx < 0) return text;

  const rawStart = map[idx]!;
  const rawEnd = (map[idx + len - 1] ?? map[map.length - 1]!) + 1;

  return (
    <>
      {text.slice(0, rawStart)}
      <mark className="rounded bg-amber-200/70 px-0.5 text-brand-900">
        {text.slice(rawStart, rawEnd)}
      </mark>
      {text.slice(rawEnd)}
    </>
  );
}
