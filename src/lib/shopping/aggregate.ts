import { normalizeUnit, pluralize, type UnitCategory } from "./units";
import { tidyNumber } from "@/lib/utils";

/** One ingredient line as it enters aggregation (already scaled by servings). */
export interface PlannedIngredient {
  canonicalName: string;
  quantity: number | null;
  unit: string | null;
  /** Optional hint from import time; the unit string takes precedence. */
  unitCategory?: UnitCategory | null;
  aisle?: string | null;
  /** Where this line came from, for "(×N recipes)" annotations. */
  recipeTitle?: string;
}

/** A consolidated shopping-list line for one canonical ingredient. */
export interface AggregatedItem {
  canonicalName: string;
  aisle: string | null;
  /** Human-readable amount, e.g. "1.2 kg" or "200 g + 2 whole". */
  displayText: string;
  /** Set only when the whole item collapses to a single summable quantity. */
  totalQuantity: number | null;
  baseUnit: string | null;
  unitCategory: UnitCategory;
  isSummable: boolean;
}

interface SubGroup {
  category: UnitCategory;
  countLabel: string; // for count/pinch/unknown
  /** Accumulated amount in the category base unit (g / ml / count). */
  base: number;
  /** Number of contributing lines (for non-summable "(×N)" display). */
  occurrences: number;
  /** True if every contributing line had a usable numeric quantity. */
  numeric: boolean;
}

function subGroupKey(category: UnitCategory, countLabel: string): string {
  if (category === "mass" || category === "volume") return category;
  return `${category}:${countLabel}`;
}

function classify(line: PlannedIngredient): {
  category: UnitCategory;
  countLabel: string;
  base: number | null;
} {
  // The unit string is authoritative; fall back to the import-time hint.
  if (line.unit && line.unit.trim() !== "") {
    const n = normalizeUnit(line.unit);
    const base = line.quantity == null ? null : line.quantity * n.factor;
    return { category: n.category, countLabel: n.countLabel, base };
  }
  if (line.quantity != null) {
    // "2 apples" — no unit but a number → plain count.
    return { category: "count", countLabel: "", base: line.quantity };
  }
  // No quantity and no unit ("salt, to taste") → not summable.
  const cat = (line.unitCategory as UnitCategory) ?? "pinch";
  return { category: cat === "count" ? "pinch" : cat, countLabel: "", base: null };
}

function formatMass(grams: number): string {
  return grams >= 1000 ? `${tidyNumber(grams / 1000)} kg` : `${tidyNumber(grams)} g`;
}
function formatVolume(ml: number): string {
  return ml >= 1000 ? `${tidyNumber(ml / 1000)} L` : `${tidyNumber(ml)} ml`;
}

function formatSubGroup(g: SubGroup): string {
  switch (g.category) {
    case "mass":
      return formatMass(g.base);
    case "volume":
      return formatVolume(g.base);
    case "count": {
      const qty = tidyNumber(g.base);
      return g.countLabel ? `${qty} ${pluralize(g.countLabel, qty)}` : `${qty}`;
    }
    case "pinch":
    case "unknown":
    default: {
      const label = g.countLabel || "to taste";
      return g.occurrences > 1 ? `${label} (×${g.occurrences})` : label;
    }
  }
}

/**
 * Consolidate planned (already-scaled) ingredient lines into one shopping-list
 * line per canonical ingredient. Same category sums; different/incompatible
 * units are grouped under the item but listed separately rather than force-summed.
 */
export function aggregateIngredients(
  lines: PlannedIngredient[],
): AggregatedItem[] {
  // canonicalName -> subGroupKey -> SubGroup
  const byItem = new Map<
    string,
    { aisle: string | null; groups: Map<string, SubGroup> }
  >();

  for (const line of lines) {
    const name = line.canonicalName.trim().toLowerCase();
    if (!name) continue;
    const { category, countLabel, base } = classify(line);

    let item = byItem.get(name);
    if (!item) {
      item = { aisle: line.aisle ?? null, groups: new Map() };
      byItem.set(name, item);
    }
    if (!item.aisle && line.aisle) item.aisle = line.aisle;

    const key = subGroupKey(category, countLabel);
    let g = item.groups.get(key);
    if (!g) {
      g = { category, countLabel, base: 0, occurrences: 0, numeric: true };
      item.groups.set(key, g);
    }
    g.occurrences += 1;
    if (base == null) g.numeric = false;
    else g.base += base;
  }

  const result: AggregatedItem[] = [];
  for (const [name, item] of byItem) {
    const groups = [...item.groups.values()];
    // Stable, readable order: real amounts first, vague amounts last.
    const order: UnitCategory[] = ["mass", "volume", "count", "unknown", "pinch"];
    groups.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));

    const parts = groups.map(formatSubGroup);
    const summableGroups = groups.filter(
      (g) => g.category === "mass" || g.category === "volume" || (g.category === "count" && g.numeric),
    );
    const isSummable = groups.length === 1 && summableGroups.length === 1;

    let totalQuantity: number | null = null;
    let baseUnit: string | null = null;
    if (isSummable) {
      const g = groups[0];
      totalQuantity = tidyNumber(g.base);
      baseUnit = g.category === "mass" ? "g" : g.category === "volume" ? "ml" : g.countLabel || "count";
    }

    result.push({
      canonicalName: name,
      aisle: item.aisle,
      displayText: parts.join(" + "),
      totalQuantity,
      baseUnit,
      unitCategory: groups[0]?.category ?? "unknown",
      isSummable,
    });
  }

  // Group by aisle, then alphabetical within.
  result.sort((a, b) => {
    const aa = a.aisle ?? "~"; // unknown aisle sorts last
    const bb = b.aisle ?? "~";
    if (aa !== bb) return aa.localeCompare(bb);
    return a.canonicalName.localeCompare(b.canonicalName);
  });
  return result;
}

/** Scale a recipe ingredient quantity for a target serving count. */
export function scaleQuantity(
  quantity: number | null,
  recipeServings: number,
  plannedServings: number,
): number | null {
  if (quantity == null) return null;
  if (!recipeServings || recipeServings <= 0) return quantity;
  return (quantity * plannedServings) / recipeServings;
}
