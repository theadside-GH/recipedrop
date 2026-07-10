import { describe, expect, it } from "vitest";
import { convertedAmount, kitchenFraction } from "./unit-display";

describe("kitchenFraction", () => {
  it("renders quarters, thirds, and mixed numbers", () => {
    expect(kitchenFraction(0.25)).toBe("1/4");
    expect(kitchenFraction(1 / 3)).toBe("1/3");
    expect(kitchenFraction(1.5)).toBe("1 1/2");
    expect(kitchenFraction(2)).toBe("2");
    expect(kitchenFraction(0.99)).toBe("1");
  });
});

describe("convertedAmount", () => {
  it("returns null for 'as written' and for unconvertible units", () => {
    expect(convertedAmount(2, "cups", "original")).toBeNull();
    expect(convertedAmount(2, "cloves", "metric")).toBeNull();
    expect(convertedAmount(1, "pinch", "us")).toBeNull();
    expect(convertedAmount(3, "weird-unit", "metric")).toBeNull();
  });

  it("converts US volume to metric", () => {
    expect(convertedAmount(1, "cup", "metric")).toBe("237 ml");
    expect(convertedAmount(2, "tbsp", "metric")).toBe("30 ml");
    expect(convertedAmount(6, "cups", "metric")).toBe("1.42 l");
  });

  it("converts metric volume to US", () => {
    expect(convertedAmount(250, "ml", "us")).toBe("1 cup");
    expect(convertedAmount(15, "ml", "us")).toBe("1 tbsp");
    expect(convertedAmount(5, "ml", "us")).toBe("1 tsp");
  });

  it("converts mass both ways", () => {
    expect(convertedAmount(1, "lb", "metric")).toBe("454 g");
    expect(convertedAmount(2.2, "kg", "us")).toBe("4 3/4 lb");
    expect(convertedAmount(100, "g", "us")).toBe("3 1/2 oz");
    expect(convertedAmount(4, "oz", "metric")).toBe("113 g");
  });

  it("keeps already-target-system units stable", () => {
    expect(convertedAmount(200, "g", "metric")).toBe("200 g");
    expect(convertedAmount(1, "cup", "us")).toBe("1 cup");
  });
});
