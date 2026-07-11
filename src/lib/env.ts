import { z } from "zod";

/**
 * Validated, typed access to environment variables. Fails fast at startup if
 * required configuration is missing or malformed — preventing subtle runtime
 * errors in production.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters"),
  SESSION_MAX_AGE: z
    .string()
    .default("28800")
    .transform((v) => Number.parseInt(v, 10))
    .pipe(z.number().int().positive()),
  STORAGE_ROOT: z.string().default("./storage"),
  MAX_UPLOAD_MB: z
    .string()
    .default("50")
    .transform((v) => Number.parseInt(v, 10))
    .pipe(z.number().int().positive()),
  // AI extraction (Phase 4.3). Optional: when no provider key is present the
  // extractor still runs its local rule-based pass and skips the LLM (free-form)
  // fields. Two providers are supported for the free-form pass — Anthropic
  // (Claude) is preferred when its key is set; otherwise Google Gemini is used.
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-4-8"),
  // Google Gemini fallback. GOOGLE_API_KEY is accepted as an alias for
  // GEMINI_API_KEY (both are set by `gcloud`/AI Studio tooling).
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export const MAX_UPLOAD_BYTES = env.MAX_UPLOAD_MB * 1024 * 1024;
