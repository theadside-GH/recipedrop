import { describe, it, expect } from "vitest";
import { aggregateIngredients, scaleQuantity, type PlannedIngredient } from "./aggregate";

function find(items: ReturnType<typeof aggregateIngredients>, name: string) {
  return items.find((i) => i.canonicalName === name);
}

describe("aggregateIngredients", () => {
  it("sums the same count ingredient across recipes (1 apple + 2 apples = 3 apples)", () => {
    const lines: PlannedIngredient[] = [
      { canonicalName: "apple", quantity: 1, unit: null },
      { canonicalName: "apple", quantity: 2, unit: null },
    ];
    const apple = find(aggregateIngredients(lines), "apple");
    expect(apple?.totalQuantity).toBe(3);
    expect(apple?.isSummable).toBe(true);
    expect(apple?.displayText).toBe("3");
  });

  it("sums compatible mass units and presents a friendly total", () => {
    const lines: PlannedIngredient[] = [
      { canonicalName: "chicken breast", quantity: 200, unit: "g" },
      { canonicalName: "chicken breast", quantity: 1, unit: "kg" },
    ];
    const chicken = find(aggregateIngredients(lines), "chicken breast");
    expect(chicken?.isSummable).toBe(true);
    expect(chicken?.displayText).toBe("1.2 kg"); // 200 g + 1000 g
    expect(chicken?.totalQuantity).toBe(1200);
    expect(chicken?.baseUnit).toBe("g");
  });

  it("does NOT force a sum across incompatible categories (mass + count)", () => {
    const lines: PlannedIngredient[] = [
      { canonicalName: "chicken breast", quantity: 200, unit: "g" },
      { canonicalName: "chicken breast", quantity: 2, unit: "whole" },
    ];
    const chicken = find(aggregateIngredients(lines), "chicken breast");
    expect(chicken?.isSummable).toBe(false);
    expect(chicken?.displayText).toBe("200 g + 2");
    expect(chicken?.totalQuantity).toBeNull();
  });

  it("sums volume units (tsp + tbsp + cup) into a single friendly amount", () => {
    const lines: PlannedIngredient[] = [
      { canonicalName: "milk", quantity: 1, unit: "cup" }, // 236.588 ml
      { canonicalName: "milk", quantity: 2, unit: "tbsp" }, // 29.57 ml
    ];
    const milk = find(aggregateIngredients(lines), "milk");
    expect(milk?.isSummable).toBe(true);
    expect(milk?.unitCategory).toBe("volume");
    expect(milk?.totalQuantity).toBeCloseTo(266.16, 1);
  });

  it("keeps 'to taste' / pinch items separate and never sums them", () => {
    const lines: PlannedIngredient[] = [
      { canonicalName: "salt", quantity: null, unit: "to taste" },
      { canonicalName: "salt", quantity: null, unit: "pinch" },
    ];
    const salt = find(aggregateIngredients(lines), "salt");
    expect(salt?.isSummable).toBe(false);
    // two different vague units → listed separately
    expect(salt?.displayText).toContain("to taste");
    expect(salt?.displayText).toContain("pinch");
  });

  it("sums matching count nouns (cloves) but keeps different nouns separate", () => {
    const lines: PlannedIngredient[] = [
      { canonicalName: "garlic", quantity: 2, unit: "cloves" },
      { canonicalName: "garlic", quantity: 3, unit: "clove" },
      { canonicalName: "garlic", quantity: 1, unit: "bulb" }, // unknown noun
    ];
    const garlic = find(aggregateIngredients(lines), "garlic");
    expect(garlic?.displayText).toContain("5 cloves");
    expect(garlic?.isSummable).toBe(false); // because of the stray "bulb"
  });

  it("groups items by aisle then name", () => {
    const lines: PlannedIngredient[] = [
      { canonicalName: "apple", quantity: 1, unit: null, aisle: "Produce" },
      { canonicalName: "milk", quantity: 1, unit: "cup", aisle: "Dairy" },
    ];
    const items = aggregateIngredients(lines);
    expect(items[0].aisle).toBe("Dairy"); // Dairy < Produce alphabetically
    expect(items[0].canonicalName).toBe("milk");
  });
});

describe("scaleQuantity", () => {
  it("scales by planned/recipe servings (recipe for 2, plan for 4 → doubles)", () => {
    expect(scaleQuantity(3, 2, 4)).toBe(6);
  });
  it("returns the quantity unchanged when servings are unknown", () => {
    expect(scaleQuantity(3, 0, 4)).toBe(3);
  });
  it("passes through null quantities", () => {
    expect(scaleQuantity(null, 2, 4)).toBeNull();
  });
});
