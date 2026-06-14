import { describe, expect, it } from "vitest";
import { splitBulkInput } from "./detect";

describe("splitBulkInput", () => {
  it("creates a separate item for each pasted link", () => {
    expect(
      splitBulkInput(
        "https://example.com/one\nhttps://www.youtube.com/watch?v=abc123\nhttps://example.com/two",
      ),
    ).toEqual([
      { type: "url", value: "https://example.com/one" },
      { type: "youtube", value: "https://www.youtube.com/watch?v=abc123" },
      { type: "url", value: "https://example.com/two" },
    ]);
  });

  it("keeps blank-line-separated pasted recipes as separate text items", () => {
    const items = splitBulkInput(
      [
        "Pasta",
        "1 cup noodles",
        "Boil and sauce until ready.",
        "",
        "Cake",
        "2 cups flour",
        "Bake until the center springs back.",
      ].join("\n"),
    );

    expect(items).toEqual([
      {
        type: "text",
        value: "Pasta\n1 cup noodles\nBoil and sauce until ready.",
      },
      {
        type: "text",
        value: "Cake\n2 cups flour\nBake until the center springs back.",
      },
    ]);
  });
});
