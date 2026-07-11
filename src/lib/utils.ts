import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a byte count into a human-readable Arabic-friendly string. */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "٠ بايت";
  const units = ["بايت", "ك.ب", "م.ب", "ج.ب", "ت.ب"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  const rounded = i === 0 ? value : Math.round(value * 10) / 10;
  return `${toArabicDigits(rounded.toString())} ${units[i]}`;
}

/** Convert Western digits in a string to Arabic-Indic digits. */
export function toArabicDigits(input: string): string {
  const map = "٠١٢٣٤٥٦٧٨٩";
  return input.replace(/[0-9]/g, (d) => map[Number(d)] ?? d);
}

const dateFormatter = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Format a date as an Arabic long date (e.g. ٥ يوليو ٢٠٢٦). */
export function formatDate(date: Date | string): string {
  return dateFormatter.format(new Date(date));
}

/** Format a date with time. */
export function formatDateTime(date: Date | string): string {
  return dateTimeFormatter.format(new Date(date));
}

/** Relative "time ago" in Arabic for recent activity feeds. */
export function timeAgo(date: Date | string): string {
  const then = new Date(date).getTime();
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return "الآن";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `منذ ${toArabicDigits(String(minutes))} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${toArabicDigits(String(hours))} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${toArabicDigits(String(days))} يوم`;
  return formatDate(date);
}

/** Format a monetary amount in Arabic with a currency label (default EGP). */
export function formatCurrency(
  amount: number | null | undefined,
  currency = "EGP",
): string {
  if (amount == null) return "—";
  const currencyLabels: Record<string, string> = {
    EGP: "ج.م",
    USD: "$",
    EUR: "€",
    SAR: "ر.س",
  };
  const formatted = new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${currencyLabels[currency] ?? currency}`;
}

/** Format a Date as an ISO date input value (yyyy-mm-dd) or empty string. */
export function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Derive a lowercase file extension (without dot) from a filename. */
export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx < 0 || idx === filename.length - 1) return "";
  return filename.slice(idx + 1).toLowerCase();
}

/**
 * Sanitize a user-supplied name by removing filesystem-unsafe characters
 * (< > : " / \ | ? *) and collapsing whitespace. Arabic letters, digits and
 * safe punctuation such as "." and "-" are preserved.
 */
export function sanitizeName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
