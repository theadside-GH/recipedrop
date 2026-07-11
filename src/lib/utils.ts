import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, resolving conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a minute count as a friendly duration, e.g. 95 -> "1h 35m". */
export function formatMinutes(total: number | null | undefined): string {
  if (!total || total <= 0) return "—";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Round a quantity to at most 2 decimals and drop trailing zeros. */
export function tidyNumber(n: number): number {
  return Math.round(n * 100) / 100;
}

const COOKING_FRACTIONS: [number, string][] = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
];

/**
 * Recipe-style quantity: 0.5 → "½", 1.5 → "1½", 0.33 → "⅓". Scaling servings
 * must read like a cookbook, not a calculator ("0.5× egg"). Falls back to
 * tidy decimals for amounts that aren't close to a kitchen fraction.
 */
export function formatQuantity(value: number): string {
  const whole = Math.floor(value + 1e-9);
  const frac = value - whole;
  if (frac <= 0.01) return String(whole);
  for (const [v, glyph] of COOKING_FRACTIONS) {
    if (Math.abs(frac - v) < 0.05) return whole > 0 ? `${whole}${glyph}` : glyph;
  }
  return String(tidyNumber(value));
}
