import { describe, expect, it } from "vitest";
import type { RecipeExtraction } from "@/lib/ai/schema";
import { ingredientGrounding, MIN_GROUNDING } from "./grounding";

function withIngredients(names: string[]): RecipeExtraction {
  return {
    title: "Test",
    description: null,
    mealType: "breakfast",
    difficulty: null,
    prepMinutes: null,
    cookMinutes: null,
    totalMinutes: null,
    servings: 4,
    imageUrl: null,
    sourceAuthor: null,
    tags: [],
    ingredients: names.map((canonicalName) => ({
      raw: canonicalName,
      canonicalName,
      quantity: null,
      unit: null,
      unitCategory: "unknown" as const,
      note: null,
      optional: false,
    })),
    steps: [],
  };
}

describe("ingredientGrounding", () => {
  it("accepts a recipe whose ingredients are listed in the source", () => {
    const source =
      "Ingredients: 2 cups all-purpose flour, 1/4 cup sugar, 3 1/2 teaspoons baking powder, 2 large eggs, 1 1/3 cups whole milk";
    const score = ingredientGrounding(
      withIngredients(["all-purpose flour", "sugar", "baking powder", "egg", "whole milk"]),
      source,
    );
    expect(score).toBe(1);
  });

  it("flags a full recipe invented from a title-only caption", () => {
    const source = "The easiest, fluffiest pancakes from a pro who's flipped thousands of them 🥞 #breakfast";
    const score = ingredientGrounding(
      withIngredients(["flour", "sugar", "baking powder", "salt", "egg", "milk", "butter", "pancake syrup"]),
      source,
    );
    expect(score).toBeLessThan(MIN_GROUNDING);
  });

  it("tolerates plural and accent drift", () => {
    const source = "3 ripe tomatoes, 1 jalapeño, crème fraîche";
    expect(ingredientGrounding(withIngredients(["tomato", "jalapeno", "creme fraiche"]), source)).toBe(1);
  });

  it("has nothing to judge when there are no ingredients", () => {
    expect(ingredientGrounding(withIngredients([]), "anything")).toBe(1);
  });
});

describe("ingredientGrounding with non-English sources", () => {
  it("counts verbatim ingredient lines even when canonical names are English", () => {
    const extraction = withIngredients(["flour", "sugar"]);
    extraction.ingredients[0].raw = "2 tazas de harina";
    extraction.ingredients[1].raw = "1/4 taza de azúcar";
    expect(ingredientGrounding(extraction, "Ingredientes: 2 tazas de harina, 1/4 taza de azúcar")).toBe(1);
  });
});
