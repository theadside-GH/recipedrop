/**
 * Unit normalization & conversion for shopping-list aggregation.
 *
 * Strategy (see build plan): every unit is bucketed into a CATEGORY. Quantities
 * only ever sum *within* a category. mass→grams and volume→millilitres convert
 * and sum cleanly; counts sum only when the count noun matches; pinch/“to taste”
 * and anything unparseable are never summed (listed separately instead). This is
 * the rule that prevents nonsense like "200 g chicken + 2 chicken breasts = 202".
 */

export type UnitCategory = "mass" | "volume" | "count" | "pinch" | "unknown";

export interface NormalizedUnit {
  category: UnitCategory;
  /** Factor to the category base unit (g for mass, ml for volume, 1 for count). */
  factor: number;
  /** A normalized label for count nouns ("clove", "can", "") — "" = plain count. */
  countLabel: string;
}

// Mass synonyms → grams
const MASS: Record<string, number> = {
  g: 1, gram: 1, grams: 1, gr: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000, kilo: 1000, kilos: 1000,
  mg: 0.001, milligram: 0.001, milligrams: 0.001,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
};

// Volume synonyms → millilitres
const VOLUME: Record<string, number> = {
  ml: 1, milliliter: 1, milliliters: 1, millilitre: 1, millilitres: 1, cc: 1,
  l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
  tsp: 4.92892, teaspoon: 4.92892, teaspoons: 4.92892,
  tbsp: 14.7868, tablespoon: 14.7868, tablespoons: 14.7868, tbs: 14.7868, tbl: 14.7868,
  cup: 236.588, cups: 236.588,
  "fl oz": 29.5735, "fluid ounce": 29.5735, floz: 29.5735,
  pt: 473.176, pint: 473.176, pints: 473.176,
  qt: 946.353, quart: 946.353, quarts: 946.353,
  gal: 3785.41, gallon: 3785.41, gallons: 3785.41,
};

// Count nouns → singular label. "" means a plain count (e.g. "2 apples").
const COUNT: Record<string, string> = {
  count: "", whole: "", piece: "", pieces: "", pcs: "", pc: "", ea: "", each: "", x: "", unit: "", units: "",
  clove: "clove", cloves: "clove",
  can: "can", cans: "can",
  slice: "slice", slices: "slice",
  bunch: "bunch", bunches: "bunch",
  head: "head", heads: "head",
  stalk: "stalk", stalks: "stalk",
  sprig: "sprig", sprigs: "sprig",
  stick: "stick", sticks: "stick",
  fillet: "fillet", fillets: "fillet",
  breast: "breast", breasts: "breast",
  leaf: "leaf", leaves: "leaf",
  sheet: "sheet", sheets: "sheet",
  package: "package", packages: "package", pkg: "package", pack: "package", packs: "package",
  jar: "jar", jars: "jar",
  bottle: "bottle", bottles: "bottle",
  bag: "bag", bags: "bag",
};

const PINCH = new Set([
  "pinch", "pinches", "dash", "dashes", "handful", "handfuls", "sprinkle",
  "drizzle", "splash", "to taste", "totaste", "as needed", "some", "garnish",
]);

/** Normalize a raw unit string into a category + conversion info. */
export function normalizeUnit(unit: string | null | undefined): NormalizedUnit {
  const u = (unit ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (u === "") return { category: "count", factor: 1, countLabel: "" };
  if (u in MASS) return { category: "mass", factor: MASS[u], countLabel: "" };
  if (u in VOLUME) return { category: "volume", factor: VOLUME[u], countLabel: "" };
  if (u in COUNT) return { category: "count", factor: 1, countLabel: COUNT[u] };
  if (PINCH.has(u)) return { category: "pinch", factor: 1, countLabel: u };
  return { category: "unknown", factor: 1, countLabel: u };
}

/** Naive singular→plural for display ("clove" → "cloves"). */
export function pluralize(label: string, qty: number): string {
  if (!label) return "";
  if (qty === 1) return label;
  if (/(s|x|z|ch|sh)$/.test(label)) return label + "es";
  if (/[^aeiou]y$/.test(label)) return label.slice(0, -1) + "ies";
  if (label === "leaf") return "leaves";
  return label + "s";
}
