import { describe, expect, it } from "vitest";
import { formatPurchaseAmount } from "./purchase";

describe("formatPurchaseAmount", () => {
  it("rounds eggs to grocery carton language", () => {
    expect(
      formatPurchaseAmount({
        canonicalName: "egg",
        displayText: "2",
        totalQuantity: 2,
        baseUnit: "count",
        unitCategory: "count",
        isSummable: true,
      }),
    ).toBe("buy 6 eggs");
  });

  it("rounds meat to human-friendly pounds", () => {
    expect(
      formatPurchaseAmount({
        canonicalName: "chicken breast",
        displayText: "500 g",
        totalQuantity: 500,
        baseUnit: "g",
        unitCategory: "mass",
        isSummable: true,
      }),
    ).toBe("buy about 1.25 lb chicken breast");
  });

  it("keeps incompatible ingredient groups exact", () => {
    expect(
      formatPurchaseAmount({
        canonicalName: "chicken breast",
        displayText: "200 g + 2",
        totalQuantity: null,
        baseUnit: null,
        unitCategory: "mass",
        isSummable: false,
      }),
    ).toBe("200 g + 2");
  });

  it("says check-pantry for true staples", () => {
    expect(
      formatPurchaseAmount({
        canonicalName: "black pepper",
        displayText: "5 g",
        totalQuantity: 5,
        baseUnit: "g",
        unitCategory: "mass",
        isSummable: true,
      }),
    ).toBe("check pantry");
    expect(
      formatPurchaseAmount({
        canonicalName: "kosher salt",
        displayText: "10 g",
        totalQuantity: 10,
        baseUnit: "g",
        unitCategory: "mass",
        isSummable: true,
      }),
    ).toBe("check pantry");
  });

  it("never hides amounts for groceries that merely contain a staple word", () => {
    expect(
      formatPurchaseAmount({
        canonicalName: "red pepper",
        displayText: "300 g",
        totalQuantity: 300,
        baseUnit: "g",
        unitCategory: "mass",
        isSummable: true,
      }),
    ).toBe("buy about 300 g");
    expect(
      formatPurchaseAmount({
        canonicalName: "coconut water",
        displayText: "500 ml",
        totalQuantity: 500,
        baseUnit: "ml",
        unitCategory: "volume",
        isSummable: true,
      }),
    ).toBe("buy about 500 ml");
  });
});
