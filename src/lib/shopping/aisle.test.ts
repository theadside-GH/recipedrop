import { describe, expect, it } from "vitest";
import { guessAisle, aisleRank } from "./aisle";

describe("guessAisle — specific keyword wins over look-alikes", () => {
  it("routes spice/pantry forms to Pantry, not Produce/Dairy/Meat", () => {
    expect(guessAisle("black pepper")).toBe("Pantry");
    expect(guessAisle("ground cumin")).toBe("Pantry");
    expect(guessAisle("ground cinnamon")).toBe("Pantry");
    expect(guessAisle("peanut butter")).toBe("Pantry");
    expect(guessAisle("tomato paste")).toBe("Pantry");
    expect(guessAisle("corn syrup")).toBe("Pantry");
  });

  it("still routes the fresh forms to Produce", () => {
    expect(guessAisle("bell pepper")).toBe("Produce");
    expect(guessAisle("tomato")).toBe("Produce");
    expect(guessAisle("corn")).toBe("Produce");
    expect(guessAisle("garlic")).toBe("Produce");
  });

  it("keeps meat and dairy correct", () => {
    expect(guessAisle("ground beef")).toBe("Meat & Seafood");
    expect(guessAisle("chicken breast")).toBe("Meat & Seafood");
    expect(guessAisle("butter")).toBe("Dairy & Eggs");
    expect(guessAisle("whole milk")).toBe("Dairy & Eggs");
  });

  it("returns null for genuinely unknown items", () => {
    expect(guessAisle("dragon fruit powder")).toBeNull();
  });
});

describe("aisleRank — store-walk order", () => {
  it("orders produce before pantry before other", () => {
    expect(aisleRank("Produce")).toBeLessThan(aisleRank("Pantry"));
    expect(aisleRank("Pantry")).toBeLessThan(aisleRank("Other"));
    expect(aisleRank(null)).toBe(aisleRank("Other"));
  });
});
