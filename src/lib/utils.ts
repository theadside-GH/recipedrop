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
