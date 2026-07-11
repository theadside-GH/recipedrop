import { pluralize } from "./units";
import { tidyNumber } from "@/lib/utils";

export interface PurchaseAmountInput {
  canonicalName: string;
  displayText: string;
  totalQuantity: number | null;
  baseUnit: string | null;
  unitCategory: "mass" | "volume" | "count" | "pinch" | "unknown";
  isSummable: boolean;
}

/**
 * Staples nobody buys per-recipe — matched precisely, never by substring:
 * "red peppers" and "coconut water" are real groceries whose names merely
 * contain a staple word, and their amounts must stay visible.
 */
const STAPLE_EXACT = [
  "water",
  "pepper",
  "black pepper",
  "white pepper",
  "ground pepper",
  "cracked pepper",
  "cayenne pepper",
  "peppercorn",
  "peppercorns",
];
const STAPLE_SUFFIXES = ["salt", "spice", "seasoning", "baking powder", "baking soda"];

function isPantryStaple(name: string): boolean {
  return (
    STAPLE_EXACT.includes(name) ||
    STAPLE_SUFFIXES.some((s) => name === s || name.endsWith(` ${s}`))
  );
}

const MEAT_WORDS = [
  "beef",
  "chicken",
  "pork",
  "turkey",
  "fish",
  "salmon",
  "shrimp",
  "steak",
  "sausage",
  "bacon",
];

const BAG_WORDS = ["flour", "sugar", "rice", "oats"];
const BOTTLE_WORDS = ["oil", "vinegar", "sauce", "dressing"];

function hasAny(name: string, words: string[]) {
  return words.some((word) => name.includes(word));
}

function roundUp(value: number, step: number) {
  return tidyNumber(Math.ceil(value / step) * step);
}

function formatCount(name: string, quantity: number, baseUnit: string | null): string {
  const q = Math.ceil(quantity);
  if (name === "egg" || name.endsWith(" egg")) {
    if (q <= 6) return "buy 6 eggs";
    if (q <= 12) return "buy 1 dozen eggs";
    if (q <= 18) return "buy 18 eggs";
    return `buy ${Math.ceil(q / 12)} dozen eggs`;
  }
  if (name === "garlic" && baseUnit === "clove") {
    return q <= 10 ? "buy 1 bulb garlic" : `buy ${Math.ceil(q / 10)} bulbs garlic`;
  }
  if (baseUnit && baseUnit !== "count") {
    return `buy ${q} ${pluralize(baseUnit, q)}`;
  }
  return `buy ${q}`;
}

function formatMass(name: string, grams: number): string {
  if (hasAny(name, BAG_WORDS)) {
    if (grams <= 1000) return `buy 1 bag ${name}`;
    return `buy about ${roundUp(grams / 1000, 0.5)} kg ${name}`;
  }
  if (hasAny(name, MEAT_WORDS)) {
    const pounds = roundUp(grams / 453.592, 0.25);
    return `buy about ${pounds} lb ${name}`;
  }
  if (grams < 1000) return `buy about ${roundUp(grams, 25)} g`;
  return `buy about ${roundUp(grams / 1000, 0.25)} kg`;
}

function formatVolume(name: string, ml: number): string {
  if (hasAny(name, BOTTLE_WORDS)) return `buy 1 bottle ${name}`;
  if (name.includes("milk") || name.includes("cream") || name.includes("stock")) {
    if (ml <= 500) return `buy about ${roundUp(ml, 50)} ml`;
    return `buy about ${roundUp(ml / 1000, 0.25)} L`;
  }
  if (ml < 250) return `buy about ${roundUp(ml, 25)} ml`;
  if (ml < 1000) return `buy about ${roundUp(ml, 50)} ml`;
  return `buy about ${roundUp(ml / 1000, 0.25)} L`;
}

export function formatPurchaseAmount(item: PurchaseAmountInput): string {
  const name = item.canonicalName.toLowerCase();
  if (!item.isSummable || item.totalQuantity == null) return item.displayText;
  if (isPantryStaple(name) && item.unitCategory !== "count") return "check pantry";

  switch (item.unitCategory) {
    case "count":
      return formatCount(name, item.totalQuantity, item.baseUnit);
    case "mass":
      return formatMass(name, item.totalQuantity);
    case "volume":
      return formatVolume(name, item.totalQuantity);
    default:
      return item.displayText;
  }
}
