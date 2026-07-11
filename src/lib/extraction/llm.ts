import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { FIELD_KEYS, type Extractor, type FieldCandidate, type FieldKey } from "./types";

/**
 * LLM extractor for free-form entities that regex can't reliably pull from
 * messy Arabic OCR — company, government entity, site, project, address,
 * engineer, representative, status, notes. Uses structured outputs (a
 * JSON-schema constrained response) so the reply is schema-validated JSON.
 *
 * Two providers are supported behind one interface:
 *   - Anthropic (Claude) — preferred when ANTHROPIC_API_KEY is set.
 *   - Google Gemini      — used when only GEMINI_API_KEY/GOOGLE_API_KEY is set.
 *
 * Optional by design: when no provider key is configured the extractor reports
 * itself unavailable and the pipeline runs rules-only. Per-document failures
 * degrade to an empty result rather than aborting the batch.
 */

const MAX_INPUT_CHARS = 12_000;
const MAX_OUTPUT_TOKENS = 2048;
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Free-form fields the model extracts, in a stable order. */
const LLM_PROPS = [
  "company",
  "governmentEntity",
  "site",
  "project",
  "address",
  "engineer",
  "representative",
  "status",
  "notes",
] as const;

type LlmProp = (typeof LLM_PROPS)[number];

const KEY_BY_PROP: Record<LlmProp, FieldKey> = {
  company: FIELD_KEYS.COMPANY,
  governmentEntity: FIELD_KEYS.GOVERNMENT_ENTITY,
  site: FIELD_KEYS.SITE,
  project: FIELD_KEYS.PROJECT,
  address: FIELD_KEYS.ADDRESS,
  engineer: FIELD_KEYS.ENGINEER,
  representative: FIELD_KEYS.REPRESENTATIVE,
  status: FIELD_KEYS.STATUS,
  notes: FIELD_KEYS.NOTES,
};

/**
 * JSON schema for structured outputs: each field is an array of
 * {value, confidence}. Anthropic's `output_config` requires strict schemas
 * (`additionalProperties: false`); Gemini's `responseSchema` rejects
 * `additionalProperties`, so it's emitted only when `strict` is set.
 */
function buildSchema(strict: boolean): Record<string, unknown> {
  const itemSchema = {
    type: "object",
    properties: {
      value: { type: "string" },
      confidence: { type: "number" },
    },
    required: ["value", "confidence"],
    ...(strict ? { additionalProperties: false } : {}),
  };
  const properties: Record<string, unknown> = {};
  for (const prop of LLM_PROPS) {
    properties[prop] = { type: "array", items: itemSchema };
  }
  return {
    type: "object",
    properties,
    required: [...LLM_PROPS],
    ...(strict ? { additionalProperties: false } : {}),
  };
}

const ANTHROPIC_SCHEMA = buildSchema(true);
const GEMINI_SCHEMA = buildSchema(false);

// Prompt tuned for extraction quality + confidence calibration (Phase 4.3
// validation): (1) calibrated confidence anchors, (2) buyer-vs-supplier rule so
// إدارة المدفعية is never mislabeled as a company, (3) full company name + dedup
// for cleaner CRM linking, (4) explicit OCR-noise / no-hallucination guard.
const SYSTEM_PROMPT = `You extract structured information from Arabic government/military procurement documents (contracts "عقود", practices "ممارسات", purchase orders "مشتريات") belonging to the Egyptian Artillery Requirements Department (إدارة المدفعية / قسم الاحتياجات). The input is raw, noisy OCR text.

Extract ONLY these free-form entities, using the text's own Arabic wording for values:
- company (الشركة / المورد / المقاول): the EXTERNAL supplier or contractor. Give the full name including its شركة/مؤسسة prefix. The Artillery Requirements Department itself is the buyer — never label it as company.
- governmentEntity (الجهة الحكومية / الإدارة): the government/military body (e.g. إدارة المدفعية، الهيئة الهندسية). The buying department belongs here, not in company.
- site (الموقع): the physical place the work concerns — WHERE (e.g. ملعب الحديقة، الفندق).
- project (المشروع): the named scope of work — WHAT (e.g. رفع القمامة، دهان الفندق).
- address (العنوان): postal/street addresses.
- engineer (المهندس): named engineers.
- representative (الممثل / المندوب): representatives or delegates.
- status (الحالة): explicit status wording (e.g. تحت التنفيذ، تم التنفيذ، ساري).
- notes (ملاحظات): short noteworthy remarks not captured by another field.

Rules:
- Return an empty array for any field not present. Never guess, invent, or reconstruct unreadable OCR text.
- List each distinct entity once (no duplicates).
- Do NOT extract dates, phone numbers, national IDs, tax IDs, amounts, currencies, or contract/purchase/practice reference numbers — those are handled separately.
- confidence is a number 0..1: use 0.9+ only when the value directly follows an explicit Arabic label; 0.6–0.8 when inferred from surrounding context; below 0.5 when the OCR is degraded or ambiguous.`;

interface Item {
  value: unknown;
  confidence: unknown;
}

type ParsedFields = Record<string, Item[]>;

/** Parse a model's JSON reply defensively into the field map (or null). */
function parseJson(text: string): ParsedFields | null {
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as ParsedFields) : null;
  } catch {
    return null;
  }
}

/** Map the parsed field arrays into typed candidates, clamping confidence. */
function toCandidates(parsed: ParsedFields): FieldCandidate[] {
  const out: FieldCandidate[] = [];
  for (const prop of LLM_PROPS) {
    const items = parsed[prop];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const value = typeof item?.value === "string" ? item.value.trim() : "";
      if (!value) continue;
      const raw = typeof item?.confidence === "number" ? item.confidence : 0.5;
      const confidence = Math.min(1, Math.max(0, raw));
      out.push({ key: KEY_BY_PROP[prop], value, normalizedValue: null, confidence, source: "llm" });
    }
  }
  return out;
}

type Provider = "anthropic" | "gemini";

/** Which provider is active — Anthropic wins when both keys are present. */
function activeProvider(): Provider | null {
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) return "gemini";
  return null;
}

class LlmExtractor implements Extractor {
  readonly name = "llm";
  private anthropic: Anthropic | null = null;

  /** True when a provider key is configured; otherwise the pass is skipped. */
  isAvailable(): boolean {
    return activeProvider() !== null;
  }

  /** The model id the LLM pass uses (for recording on the extraction row). */
  get model(): string {
    return activeProvider() === "gemini" ? env.GEMINI_MODEL : env.ANTHROPIC_MODEL;
  }

  /** Human-readable provider label for logs/validation output. */
  get providerLabel(): string {
    return activeProvider() === "gemini" ? "Gemini" : "Claude";
  }

  private getAnthropic(): Anthropic {
    if (!this.anthropic) this.anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return this.anthropic;
  }

  /** Claude structured-output call → parsed field map. */
  private async callAnthropic(input: string): Promise<ParsedFields | null> {
    const message = await this.getAnthropic().messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: input }],
      output_config: { format: { type: "json_schema", schema: ANTHROPIC_SCHEMA } },
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return parseJson(text);
  }

  /**
   * Gemini structured-output call via REST (no SDK dependency). `thinkingBudget:
   * 0` disables 2.5-flash's reasoning tokens so the whole output budget goes to
   * the JSON answer, and temperature 0 keeps extraction deterministic.
   */
  private async callGemini(input: string): Promise<ParsedFields | null> {
    const key = env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY!;
    const res = await fetch(`${GEMINI_ENDPOINT}/${env.GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: input }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_SCHEMA,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: 0,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");
    return parseJson(text);
  }

  async extract(text: string): Promise<FieldCandidate[]> {
    const provider = activeProvider();
    if (!provider) return [];
    const input = text.slice(0, MAX_INPUT_CHARS).trim();
    if (!input) return [];

    let parsed: ParsedFields | null;
    try {
      parsed = provider === "gemini" ? await this.callGemini(input) : await this.callAnthropic(input);
    } catch (error) {
      console.warn(
        `[extraction:llm] ${provider} request failed: ${error instanceof Error ? error.message : error}`,
      );
      return [];
    }
    if (!parsed) return [];
    return toCandidates(parsed);
  }
}

export const llmExtractor = new LlmExtractor();
