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
});
