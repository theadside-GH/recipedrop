import { describe, expect, it } from "vitest";
import { parseSharedRecipeInput } from "./shared";

describe("parseSharedRecipeInput", () => {
  it("prefers a shared url field when present", () => {
    expect(
      parseSharedRecipeInput({
        title: "Dinner idea",
        text: "Check this out",
        url: "https://www.youtube.com/watch?v=abc123",
      }),
    ).toEqual({
      value: "https://www.youtube.com/watch?v=abc123",
      sourceType: "youtube",
    });
  });

  it("extracts links buried in shared text", () => {
    expect(
      parseSharedRecipeInput({
        text: "This pasta looks good https://www.tiktok.com/@cook/video/12345",
      }),
    ).toEqual({
      value: "https://www.tiktok.com/@cook/video/12345",
      sourceType: "url",
    });
  });

  it("falls back to text when no link is present", () => {
    expect(
      parseSharedRecipeInput({
        title: "Grandma cake",
        text: "2 cups flour\n1 cup sugar\nBake until done.",
      }),
    ).toEqual({
      value: "2 cups flour\n1 cup sugar\nBake until done.\n\nGrandma cake",
      sourceType: "text",
    });
  });
});
