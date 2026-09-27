import { describe, expect, it } from "vitest";
import { dropContradictedDietaryTags } from "./dietary";

const curry = ["olive oil", "onion", "red curry paste", "coconut milk", "chickpea", "fish sauce"];

describe("dropContradictedDietaryTags", () => {
  it("drops vegetarian and vegan when there's fish sauce", () => {
    expect(dropContradictedDietaryTags(["vegetarian", "vegan", "one-pot"], curry)).toEqual([
      "one-pot",
    ]);
  });

  it("keeps vegan when the milk and butter are plant versions", () => {
    const ings = ["coconut milk", "peanut butter", "oat milk", "chickpea", "cream of tartar"];
    expect(dropContradictedDietaryTags(["Vegan", "Dairy-Free"], ings)).toEqual(["Vegan", "Dairy-Free"]);
  });

  it("drops vegan but keeps vegetarian for eggs and honey", () => {
    expect(dropContradictedDietaryTags(["vegan", "vegetarian"], ["egg", "honey", "oat"])).toEqual([
      "vegetarian",
    ]);
  });

  it("does not mistake chickpeas or eggplant for animal products", () => {
    expect(dropContradictedDietaryTags(["vegan"], ["chickpea", "eggplant", "tahini"])).toEqual([
      "vegan",
    ]);
  });

  it("checks gluten-free and dairy-free", () => {
    expect(dropContradictedDietaryTags(["gluten free", "dairy-free"], ["soy sauce", "butter"])).toEqual(
      [],
    );
    expect(dropContradictedDietaryTags(["gluten-free"], ["rice flour", "rice noodle"])).toEqual([
      "gluten-free",
    ]);
  });
});
