/**
 * Arabic-aware text normalization for global search. Client-safe (used by both
 * the server matcher/ranker and the client highlighter) — no server-only
 * imports. SQLite has no Arabic collation or trigram support, so all folding,
 * partial/prefix matching and typo tolerance happen here in plain JS over a
 * bounded candidate set (see src/lib/search/engine.ts). No external engine.
 *
 * Folding rules (recall-oriented, orthography-insensitive):
 *   • strip tashkīl (harakāt) and taṭwīl (ـ)
 *   • أ إ آ ٱ → ا   ·   ة → ه   ·   ى → ي   ·   ؤ → و   ·   ئ → ي
 *   • Arabic-Indic and extended digits → ASCII 0-9
 *   • lowercase ASCII, trim
 * These absorb the most common Arabic "typos" (hamza/alef, ta-marbuta/ha,
 * alef-maqsura/ya) for free, before Levenshtein is ever needed.
 */

/** Combining marks + tatweel that carry no lexical meaning for matching. */
const STRIP = new Set<string>([
  "ـ", // tatweel
]);

function isCombiningMark(code: number): boolean {
  return (
    (code >= 0x0610 && code <= 0x061a) || // Arabic signs
    (code >= 0x064b && code <= 0x065f) || // harakat + extensions
    code === 0x0670 || // superscript alef
    (code >= 0x06d6 && code <= 0x06dc) ||
    (code >= 0x06df && code <= 0x06e4) ||
    (code >= 0x06e7 && code <= 0x06e8) ||
    (code >= 0x06ea && code <= 0x06ed)
  );
}

/** Fold a single character to its canonical form (always length 0 or 1). */
function foldChar(ch: string): string {
  const code = ch.charCodeAt(0);
  if (STRIP.has(ch) || isCombiningMark(code)) return "";

  switch (ch) {
    case "أ":
    case "إ":
    case "آ":
    case "ٱ":
      return "ا";
    case "ة":
      return "ه";
    case "ى":
      return "ي";
    case "ؤ":
      return "و";
    case "ئ":
      return "ي";
    default:
      break;
  }

  // Arabic-Indic (٠-٩ = U+0660-0669) and extended (۰-۹ = U+06F0-06F9) digits.
  if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
  if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);

  return ch.toLowerCase();
}

/**
 * Normalize while retaining a map from each normalized-string index back to the
 * original-string index. The client highlighter uses the map to wrap the raw
 * (un-folded) matched slice, so diacritics inside a match stay visible.
 */
export function normalizeWithMap(input: string): {
  normalized: string;
  map: number[];
} {
  const out: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const folded = foldChar(input[i]!);
    if (folded === "") continue;
    for (const c of folded) {
      out.push(c);
      map.push(i);
    }
  }
  return { normalized: out.join(""), map };
}

/** Normalize a string for comparison (folding only, index map discarded). */
export function normalize(input: string): string {
  return normalizeWithMap(input).normalized;
}

/** Split a normalized query into non-empty whitespace-delimited tokens. */
export function tokenize(normalized: string): string[] {
  return normalized.split(/\s+/).filter(Boolean);
}

/**
 * Bounded Levenshtein edit distance. Returns `max + 1` as soon as the distance
 * provably exceeds `max`, so typo scoring stays O(n·m) with a tiny constant.
 */
export function levenshtein(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0]!;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + cost,
      );
      if (curr[j]! < rowMin) rowMin = curr[j]!;
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}
