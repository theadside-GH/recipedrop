import { describe, expect, it } from "vitest";
import { ingredientMatchKey } from "./normalize";

describe("ingredientMatchKey", () => {
  it("matches plural pantry entries to singular canonicals", () => {
    expect(ingredientMatchKey("eggs")).toBe(ingredientMatchKey("egg"));
    expect(ingredientMatchKey("beans")).toBe(ingredientMatchKey("bean"));
    expect(ingredientMatchKey("lentils")).toBe(ingredientMatchKey("lentil"));
    expect(ingredientMatchKey("noodles")).toBe(ingredientMatchKey("noodle"));
    expect(ingredientMatchKey("chicken breasts")).toBe(ingredientMatchKey("chicken breast"));
    expect(ingredientMatchKey("canned tomatoes")).toBe(ingredientMatchKey("canned tomato"));
  });

  it("handles -ies and -oes plurals", () => {
    expect(ingredientMatchKey("cherries")).toBe("cherry");
    expect(ingredientMatchKey("tomatoes")).toBe("tomato");
    expect(ingredientMatchKey("potatoes")).toBe("potato");
  });

  it("leaves non-plural s-endings alone", () => {
    expect(ingredientMatchKey("hummus")).toBe("hummus");
    expect(ingredientMatchKey("molasses")).toBe("molasses");
    expect(ingredientMatchKey("asparagus")).toBe("asparagus");
    expect(ingredientMatchKey("couscous")).toBe("couscous");
  });

  it("only singularizes the last word", () => {
    expect(ingredientMatchKey("swiss cheese")).toBe("swiss cheese");
    expect(ingredientMatchKey("brussels sprouts")).toBe("brussels sprout");
  });

  it("normalizes case and whitespace", () => {
    expect(ingredientMatchKey("  Chicken   Breasts ")).toBe("chicken breast");
    expect(ingredientMatchKey(null)).toBe("");
    expect(ingredientMatchKey(undefined)).toBe("");
  });

  it("never bridges genuinely different ingredients", () => {
    expect(ingredientMatchKey("chicken breast")).not.toBe(ingredientMatchKey("chicken thigh"));
    expect(ingredientMatchKey("red pepper")).not.toBe(ingredientMatchKey("black pepper"));
  });
});
