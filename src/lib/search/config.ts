/**
 * Search tuning constants — client-safe (no server-only), so both the engine
 * and the UI (palette, results page) share one source of truth for limits.
 */

/** Max rows scanned per provider — a safety bound so data growth can't blow up. */
export const SCAN_CAP = 500;

/** Results shown per group in the command palette. */
export const DEFAULT_PER_GROUP = 5;

/** Hard ceiling per page on the full results page (pagination window). */
export const MAX_PAGE_LIMIT = 25;
