import { FIELD_KEYS, type Extractor, type FieldCandidate, type FieldKey } from "./types";

/**
 * Deterministic, offline rule extractor. Pulls the well-structured fields —
 * dates, phones, Egyptian national IDs, tax IDs, monetary amounts + currency,
 * and contract/purchase/practice numbers — out of Arabic OCR text with regex
 * and labeled-number heuristics. No network, fully testable. Free-form entities
 * (company, engineer, …) are left to the LLM pass (see llm.ts).
 */

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const ARABIC_INDIC_EXT = "۰۱۲۳۴۵۶۷۸۹";

/** Fold Arabic-Indic digits to ASCII so numeric patterns match uniformly. */
function foldDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => {
    const a = ARABIC_INDIC.indexOf(d);
    if (a !== -1) return String(a);
    return String(ARABIC_INDIC_EXT.indexOf(d));
  });
}

interface Accumulator {
  push(key: FieldKey, value: string, confidence: number, normalized?: string | null): void;
}

/** Collects candidates, de-duplicating by key + normalized/raw value. */
function createAccumulator(): { out: FieldCandidate[] } & Accumulator {
  const out: FieldCandidate[] = [];
  const seen = new Set<string>();
  return {
    out,
    push(key, value, confidence, normalized) {
      const v = value.trim();
      if (!v) return;
      const dedupeKey = `${key}::${(normalized ?? v).toLowerCase()}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      out.push({ key, value: v, normalizedValue: normalized ?? null, confidence, source: "rule" });
    },
  };
}

/** Egyptian national ID — exactly 14 digits, not part of a longer number. */
function extractNationalIds(text: string, acc: Accumulator): void {
  for (const m of text.matchAll(/(?<!\d)\d{14}(?!\d)/g)) {
    acc.push(FIELD_KEYS.NATIONAL_ID, m[0], 0.8, m[0]);
  }
}

/** Egyptian mobile numbers: 01[0125] + 8 digits, tolerant of spaces/dashes. */
function extractPhones(text: string, acc: Accumulator): void {
  for (const m of text.matchAll(/(?<!\d)01[0125](?:[\s-]?\d){8}(?!\d)/g)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length === 11) acc.push(FIELD_KEYS.PHONE, m[0].trim(), 0.85, digits);
  }
}

/**
 * Tax registration numbers. Egyptian tax IDs are exactly 9 digits, usually
 * written 3-3-3. Matched either after a tax-card label (separators limited to
 * spaces/dashes — a slash means it's really two numbers / OCR noise), or as a
 * bare 3-3-3 group. Requiring exactly 9 digits avoids the false positives that
 * a looser 8–12-digit, slash-tolerant pattern produced on noisy OCR.
 */
function extractTaxIds(text: string, acc: Accumulator): void {
  const labeled =
    /(?:بطاقة\s*ضريبية|الرقم\s*الضريبي|رقم\s*ضريبي|تسجيل\s*ضريبي|مأمورية\s*ضرائب)[^\d]{0,15}(\d[\d\s-]{7,11}\d)/g;
  for (const m of text.matchAll(labeled)) {
    if (!m[1]) continue;
    const digits = m[1].replace(/\D/g, "");
    if (digits.length === 9) acc.push(FIELD_KEYS.TAX_ID, m[1].trim(), 0.9, digits);
  }
  for (const m of text.matchAll(/(?<!\d)\d{3}-\d{3}-\d{3}(?!\d)/g)) {
    acc.push(FIELD_KEYS.TAX_ID, m[0], 0.6, m[0].replace(/\D/g, ""));
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Numeric dates (d/m/y or y/m/d) → ISO yyyy-mm-dd when the parts are valid. */
function extractDates(text: string, acc: Accumulator): void {
  for (const m of text.matchAll(/(?<!\d)(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})(?!\d)/g)) {
    if (!m[1] || !m[2] || !m[3]) continue;
    const a = Number(m[1]);
    const mid = Number(m[2]);
    const c = Number(m[3]);
    let year: number;
    let month: number;
    let day: number;
    if (m[1].length === 4) {
      year = a; month = mid; day = c; // y/m/d
    } else {
      day = a; month = mid; year = c < 100 ? 2000 + c : c; // d/m/y
    }
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) continue;
    acc.push(FIELD_KEYS.DATE, m[0], 0.8, `${year}-${pad2(month)}-${pad2(day)}`);
  }
}

const CURRENCY_CODES: Array<{ re: RegExp; code: string }> = [
  { re: /جنيه\w*|ج\.?\s?م\.?|EGP|LE\b/gi, code: "EGP" },
  { re: /ريال|ر\.?\s?س\.?|SAR/gi, code: "SAR" },
  { re: /دولار|USD|\$/gi, code: "USD" },
  { re: /يورو|EUR|€/gi, code: "EUR" },
];

/** Amounts followed by a currency token, plus the currency itself. */
function extractAmounts(text: string, acc: Accumulator): void {
  const currencyAlt =
    "جنيه\\w*|ج\\.?\\s?م\\.?|EGP|LE|ريال|ر\\.?\\s?س\\.?|SAR|دولار|USD|\\$|يورو|EUR|€";
  const re = new RegExp(`(\\d[\\d.,،\\s]*\\d|\\d)\\s*(${currencyAlt})`, "gi");
  for (const m of text.matchAll(re)) {
    if (!m[1] || !m[2]) continue;
    const numeric = m[1].replace(/[,،\s]/g, "");
    if (!/^\d+(?:\.\d+)?$/.test(numeric)) continue;
    acc.push(FIELD_KEYS.AMOUNT, m[0].trim(), 0.85, numeric);
    const token = m[2];
    const code = CURRENCY_CODES.find((c) => {
      c.re.lastIndex = 0;
      return c.re.test(token);
    })?.code;
    if (code) acc.push(FIELD_KEYS.CURRENCY, token.trim(), 0.85, code);
  }
}

/** Clean a matched reference number: fold spaces around slashes, trim. */
function cleanRef(raw: string): string {
  return raw.replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();
}

/** Find "<label> [رقم] : <number>" style references for a labeled field. */
function extractLabeledNumbers(
  text: string,
  key: FieldKey,
  labelAlt: string,
  acc: Accumulator,
): void {
  const re = new RegExp(
    `(?:${labelAlt})\\s*(?:رقم|رقـم|no\\.?|#)?\\s*[:\\-]?\\s*(\\d+(?:\\s*/\\s*\\d+)*)`,
    "gi",
  );
  for (const m of text.matchAll(re)) {
    if (!m[1]) continue;
    const ref = cleanRef(m[1]);
    if (ref) acc.push(key, ref, 0.88, ref);
  }
}

class RuleExtractor implements Extractor {
  readonly name = "rules";

  extract(text: string): Promise<FieldCandidate[]> {
    const folded = foldDigits(text);
    const acc = createAccumulator();

    extractNationalIds(folded, acc);
    extractPhones(folded, acc);
    extractTaxIds(folded, acc);
    extractDates(folded, acc);
    extractAmounts(folded, acc);
    extractLabeledNumbers(folded, FIELD_KEYS.CONTRACT_NUMBER, "عقد|العقد|التعاقد|تعاقد", acc);
    extractLabeledNumbers(
      folded,
      FIELD_KEYS.PURCHASE_NUMBER,
      "أمر\\s*شراء|امر\\s*شراء|أمر\\s*توريد|امر\\s*توريد|مشتريات|الشراء|التوريد",
      acc,
    );
    extractLabeledNumbers(folded, FIELD_KEYS.PRACTICE_NUMBER, "ممارسة|الممارسة", acc);

    return Promise.resolve(acc.out);
  }
}

export const ruleExtractor = new RuleExtractor();
/** Exposed for unit tests. */
export { foldDigits };
