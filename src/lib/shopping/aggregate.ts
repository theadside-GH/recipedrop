import { normalizeUnit, pluralize, type UnitCategory } from "./units";
import { tidyNumber } from "@/lib/utils";

/** One ingredient line as it enters aggregation, already scaled by servings. */
export interface PlannedIngredient {
  canonicalName: string;
  quantity: number | null;
  unit: string | null;
  /** Optional hint from import time; the unit string takes precedence. */
  unitCategory?: UnitCategory | null;
  aisle?: string | null;
  recipeTitle?: string;
}

/** A consolidated shopping-list line for one canonical ingredient. */
export interface AggregatedItem {
  canonicalName: string;
  aisle: string | null;
  /** Human-readable amount, e.g. "1.2 kg" or "4 cloves". */
  displayText: string;
  /** Set only when the whole item collapses to a single summable quantity. */
  totalQuantity: number | null;
  baseUnit: string | null;
  unitCategory: UnitCategory;
  isSummable: boolean;
}

interface SubGroup {
  category: UnitCategory;
  countLabel: string;
  /** Accumulated amount in the category base unit: g, ml, or count. */
  base: number;
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
  if (line.unit && line.unit.trim() !== "") {
    const n = normalizeUnit(line.unit);
    const base = line.quantity == null ? null : line.quantity * n.factor;
    return { category: n.category, countLabel: n.countLabel, base };
  }
  if (line.quantity != null) {
    return { category: "count", countLabel: "", base: line.quantity };
  }
  const cat = (line.unitCategory as UnitCategory) ?? "unknown";
  return { category: cat === "count" ? "unknown" : cat, countLabel: "", base: null };
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
      const label = g.countLabel || "amount not specified";
      return g.occurrences > 1 ? `${label} (${g.occurrences} recipes)` : label;
    }
  }
}

function mergeFriendlyCountGroups(name: string, groups: SubGroup[]): SubGroup[] {
  if (name !== "garlic") return groups;
  const plain = groups.find((g) => g.category === "count" && g.countLabel === "" && g.numeric);
  const cloves = groups.find((g) => g.category === "count" && g.countLabel === "clove" && g.numeric);
  if (!plain || !cloves) return groups;

  return groups.filter((g) => g !== plain && g !== cloves).concat({
    category: "count",
    countLabel: "clove",
    base: plain.base + cloves.base,
    occurrences: plain.occurrences + cloves.occurrences,
    numeric: true,
  });
}

/**
 * Consolidate planned ingredient lines into one shopping-list line per item.
 * Same category sums; incompatible units stay visible rather than being guessed.
 */
export function aggregateIngredients(lines: PlannedIngredient[]): AggregatedItem[] {
  const byItem = new Map<string, { aisle: string | null; groups: Map<string, SubGroup> }>();

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
    let group = item.groups.get(key);
    if (!group) {
      group = { category, countLabel, base: 0, occurrences: 0, numeric: true };
      item.groups.set(key, group);
    }
    group.occurrences += 1;
    if (base == null) group.numeric = false;
    else group.base += base;
  }

  const result: AggregatedItem[] = [];
  for (const [name, item] of byItem) {
    const groups = mergeFriendlyCountGroups(name, [...item.groups.values()]);
    const order: UnitCategory[] = ["mass", "volume", "count", "unknown", "pinch"];
    groups.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));

    const summableGroups = groups.filter(
      (g) => g.category === "mass" || g.category === "volume" || (g.category === "count" && g.numeric),
    );
    const isSummable = groups.length === 1 && summableGroups.length === 1;

    let totalQuantity: number | null = null;
    let baseUnit: string | null = null;
    if (isSummable) {
      const group = groups[0];
      totalQuantity = tidyNumber(group.base);
      baseUnit = group.category === "mass" ? "g" : group.category === "volume" ? "ml" : group.countLabel || "count";
    }

    result.push({
      canonicalName: name,
      aisle: item.aisle,
      displayText: groups.map(formatSubGroup).join(" + "),
      totalQuantity,
      baseUnit,
      unitCategory: groups[0]?.category ?? "unknown",
      isSummable,
    });
  }

  result.sort((a, b) => {
    const aa = a.aisle ?? "~";
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
