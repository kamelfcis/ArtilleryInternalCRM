/**
 * Lightweight script detection and text-quality heuristics for extracted text.
 *
 * The corpus is Arabic government documents, so the key question a PDF page
 * poses is: "is the embedded text layer genuine Arabic, or font-encoding
 * garbage?" (Many Arabic PDFs carry a text layer with no ToUnicode map, so the
 * bytes decode to meaningless Latin/symbol soup.) `isReadableText` answers that
 * conservatively: when in doubt we treat the layer as unusable and let OCR run.
 */

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const ARABIC_G = new RegExp(ARABIC.source, "g");
const LATIN_LETTER_G = /[A-Za-z]/g;

export interface ScriptStats {
  /** Non-whitespace character count. */
  meaningful: number;
  arabicLetters: number;
  latinLetters: number;
  /** arabicLetters / meaningful (0 when empty). */
  arabicRatio: number;
}

export function scriptStats(text: string): ScriptStats {
  const meaningful = text.replace(/\s/g, "").length;
  const arabicLetters = (text.match(ARABIC_G) ?? []).length;
  const latinLetters = (text.match(LATIN_LETTER_G) ?? []).length;
  return {
    meaningful,
    arabicLetters,
    latinLetters,
    arabicRatio: meaningful > 0 ? arabicLetters / meaningful : 0,
  };
}

/** Script label stored on each DocumentText row. */
export function detectLanguage(text: string): string {
  const { arabicLetters, latinLetters } = scriptStats(text);
  if (arabicLetters === 0 && latinLetters === 0) return "und";
  if (arabicLetters > 0 && latinLetters === 0) return "ara";
  if (latinLetters > 0 && arabicLetters === 0) return "eng";
  // Both present — call it mixed unless one side is negligible.
  const total = arabicLetters + latinLetters;
  if (arabicLetters / total >= 0.85) return "ara";
  if (latinLetters / total >= 0.85) return "eng";
  return "ara+eng";
}

/**
 * Decide whether a PDF text layer is trustworthy text (vs. garbage from a
 * fontless encoding). This is an Arabic government corpus, so a genuine text
 * layer is Arabic-dominated; fontless Arabic PDFs decode to Latin/symbol soup
 * with NO Arabic letters (e.g. "i* <ll . ii, Il Y.Y"). We therefore require
 * real Arabic and otherwise fall back to OCR. Conservative on purpose: a false
 * "unreadable" only costs an OCR pass, while a false "readable" stores gibberish
 * — and Latin-letter ratio alone cannot tell that soup from real English text.
 */
export function isReadableText(text: string): boolean {
  const { meaningful, arabicLetters, arabicRatio } = scriptStats(text);
  if (meaningful < 12) return false; // too little to trust
  return arabicLetters >= 12 && arabicRatio >= 0.4;
}
