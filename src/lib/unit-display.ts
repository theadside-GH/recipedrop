/**
 * Display-time US ⇄ metric conversion for ingredient amounts. Reuses the
 * shopping-list normalization tables (mass→g, volume→ml); counts, pinches,
 * and unparseable units are always shown as written.
 */
import { normalizeUnit, pluralize } from "@/lib/shopping/units";

export type UnitSystem = "original" | "us" | "metric";

const GRAMS_PER_OZ = 28.3495;
const GRAMS_PER_LB = 453.592;
const ML_PER_TSP = 4.92892;
const ML_PER_TBSP = 14.7868;
const ML_PER_CUP = 236.588;

/** Nearest sensible kitchen fraction (quarters and thirds), as a string. */
export function kitchenFraction(value: number): string {
  const whole = Math.floor(value);
  const rest = value - whole;
  const steps: Array<[number, string]> = [
    [0, ""],
    [1 / 4, "1/4"],
    [1 / 3, "1/3"],
    [1 / 2, "1/2"],
    [2 / 3, "2/3"],
    [3 / 4, "3/4"],
    [1, ""],
  ];
  let best: [number, string] = steps[0];
  for (const step of steps) {
    if (Math.abs(rest - step[0]) < Math.abs(rest - best[0])) best = step;
  }
  const carried = whole + (best[0] === 1 ? 1 : 0);
  if (!best[1] || best[0] === 1) return String(carried || (rest > 0 ? 1 : 0));
  return carried > 0 ? `${carried} ${best[1]}` : best[1];
}

function trim(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)));
}

/**
 * Convert a scaled quantity + unit into the requested system, returning a
 * ready display string — or null when the amount should stay as written.
 */
export function convertedAmount(
  quantity: number,
  unit: string,
  system: UnitSystem,
): string | null {
  if (system === "original" || quantity <= 0) return null;
  const normalized = normalizeUnit(unit);

  if (normalized.category === "mass") {
    const grams = quantity * normalized.factor;
    if (system === "metric") {
      return grams >= 1000 ? `${trim(grams / 1000, 2)} kg` : `${trim(grams, grams < 10 ? 1 : 0)} g`;
    }
    if (grams >= GRAMS_PER_LB * 0.75) {
      const lb = Math.round((grams / GRAMS_PER_LB) * 4) / 4;
      return `${kitchenFraction(lb)} lb`;
    }
    const oz = Math.max(0.25, Math.round((grams / GRAMS_PER_OZ) * 4) / 4);
    return `${kitchenFraction(oz)} oz`;
  }

  if (normalized.category === "volume") {
    const ml = quantity * normalized.factor;
    if (system === "metric") {
      return ml >= 1000 ? `${trim(ml / 1000, 2)} l` : `${trim(ml, ml < 10 ? 1 : 0)} ml`;
    }
    if (ml >= ML_PER_CUP * 0.25) {
      const cups = Math.round((ml / ML_PER_CUP) * 4) / 4;
      return `${kitchenFraction(cups)} ${cups === 1 ? "cup" : "cups"}`;
    }
    if (ml >= ML_PER_TBSP * 0.75) {
      const tbsp = Math.round((ml / ML_PER_TBSP) * 2) / 2;
      return `${kitchenFraction(tbsp)} tbsp`;
    }
    const tsp = Math.max(0.25, Math.round((ml / ML_PER_TSP) * 4) / 4);
    return `${kitchenFraction(tsp)} tsp`;
  }

  // Counts, pinches, unknown units: no meaningful conversion.
  return null;
}

export { pluralize };
