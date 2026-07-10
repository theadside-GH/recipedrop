import { describe, expect, it } from "vitest";
import { sourceKeyFor } from "./source-key";

describe("sourceKeyFor", () => {
  it("returns null for empty or non-URL values", () => {
    expect(sourceKeyFor(null)).toBeNull();
    expect(sourceKeyFor("")).toBeNull();
    expect(sourceKeyFor("  ")).toBeNull();
    expect(sourceKeyFor("just pasted recipe text")).toBeNull();
    expect(sourceKeyFor("ftp://example.com/x")).toBeNull();
  });

  it("collapses tiktok share links that differ only by share tokens", () => {
    const a = sourceKeyFor("https://www.tiktok.com/@cook/video/7123?_t=8abc&_r=1");
    const b = sourceKeyFor("https://www.tiktok.com/@cook/video/7123?_t=9zzz&_r=1&is_from_webapp=1");
    expect(a).toBe("tiktok.com/@cook/video/7123");
    expect(b).toBe(a);
  });

  it("keeps content-identifying params like youtube's v", () => {
    const a = sourceKeyFor("https://www.youtube.com/watch?v=abc123&si=SHARE1");
    const b = sourceKeyFor("https://youtube.com/watch?si=OTHER&v=abc123");
    expect(a).toBe("youtube.com/watch?v=abc123");
    expect(b).toBe(a);
    expect(sourceKeyFor("https://www.youtube.com/watch?v=other999")).not.toBe(a);
  });

  it("ignores protocol, www/mobile host prefixes, hash, and trailing slash", () => {
    const key = "example.com/recipes/pad-see-ew";
    expect(sourceKeyFor("http://example.com/recipes/pad-see-ew")).toBe(key);
    expect(sourceKeyFor("https://www.example.com/recipes/pad-see-ew/")).toBe(key);
    expect(sourceKeyFor("https://m.example.com/recipes/pad-see-ew#steps")).toBe(key);
  });

  it("strips instagram and campaign tracking params", () => {
    expect(sourceKeyFor("https://www.instagram.com/reel/XYZ/?igsh=aaa&utm_source=ig")).toBe(
      "instagram.com/reel/XYZ",
    );
  });

  it("sorts surviving params so ordering does not split groups", () => {
    expect(sourceKeyFor("https://example.com/r?b=2&a=1")).toBe(
      sourceKeyFor("https://example.com/r?a=1&b=2"),
    );
  });
});
