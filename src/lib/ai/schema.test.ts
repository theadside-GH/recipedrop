import { describe, expect, it } from "vitest";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { recipeExtractionSchema } from "./schema";

const base = {
  title: "Soda Bread",
  description: null,
  mealType: "dinner",
  difficulty: null,
  prepMinutes: null,
  cookMinutes: 40,
  totalMinutes: null,
  servings: 8,
  imageUrl: null,
  sourceAuthor: null,
  tags: [],
  ingredients: [
    {
      raw: "4 c. flour",
      canonicalName: "flour",
      quantity: 4,
      unit: "cup",
      unitCategory: "volume",
      note: null,
      optional: false,
    },
  ],
  steps: [{ instruction: "Bake.", durationMinutes: 40 }],
};

describe("recipeExtractionSchema", () => {
  it("still builds a structured-output format for the SDK", () => {
    expect(() => zodOutputFormat(recipeExtractionSchema)).not.toThrow();
  });

  it("maps or defaults labels outside the enums instead of failing the import", () => {
    const parsed = recipeExtractionSchema.parse({
      ...base,
      mealType: "Bread",
      difficulty: "moderate",
      ingredients: [{ ...base.ingredients[0], unitCategory: "weight" }],
    });
    expect(parsed.mealType).toBe("side");
    expect(parsed.difficulty).toBe("medium");
    expect(parsed.ingredients[0].unitCategory).toBe("mass");

    const unknown = recipeExtractionSchema.parse({
      ...base,
      mealType: "holiday feast",
      difficulty: "fiddly",
      ingredients: [{ ...base.ingredients[0], unitCategory: "bunch" }],
    });
    expect(unknown.mealType).toBe("dinner");
    expect(unknown.difficulty).toBeNull();
    expect(unknown.ingredients[0].unitCategory).toBe("unknown");
  });
});
