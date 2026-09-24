import { describe, expect, it } from "vitest";
import { linkFromPastedText, parseSharedRecipeInput } from "./shared";

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

describe("linkFromPastedText", () => {
  it("pulls the link out of a phone-copied title + link", () => {
    expect(
      linkFromPastedText(
        "The Easiest, Fluffiest Pancakes\nhttps://www.seriouseats.com/fluffy-pancakes-11729596",
      ),
    ).toBe("https://www.seriouseats.com/fluffy-pancakes-11729596");
  });

  it("keeps a long caption that happens to contain a link as text", () => {
    const caption = `Garlic butter pasta 🍝 ${"2 cups pasta, 3 cloves garlic, 4 tbsp butter. Boil, toss, serve. ".repeat(5)} https://example.com/more`;
    expect(linkFromPastedText(caption)).toBeNull();
  });

  it("ignores pastes with several links or none", () => {
    expect(linkFromPastedText("a https://a.com b https://b.com")).toBeNull();
    expect(linkFromPastedText("2 cups flour, 1 egg")).toBeNull();
  });
});
