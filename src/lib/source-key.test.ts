import { describe, expect, it } from "vitest";
import { isShortShareLink, sourceKeyFor } from "./source-key";

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
    expect(a).toBe("tiktok.com/video/7123");
    expect(b).toBe(a);
  });

  it("collapses every tiktok video URL form onto the video id", () => {
    const key = "tiktok.com/video/7123";
    expect(sourceKeyFor("https://www.tiktok.com/@/video/7123?share_app_id=1233&share_item_id=7123")).toBe(key);
    expect(sourceKeyFor("https://m.tiktok.com/v/7123.html")).toBe(key);
    expect(sourceKeyFor("https://www.tiktok.com/video/7123")).toBe(key);
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

  it("maps youtu.be share links onto the watch URL", () => {
    expect(sourceKeyFor("https://youtu.be/abc123?si=SHARE")).toBe(
      sourceKeyFor("https://www.youtube.com/watch?v=abc123"),
    );
  });

  it("treats instagram /reels/ and /reel/ as the same post", () => {
    expect(sourceKeyFor("https://www.instagram.com/reels/XYZ/")).toBe(
      sourceKeyFor("https://www.instagram.com/reel/XYZ"),
    );
  });
});

describe("isShortShareLink", () => {
  it("flags per-share tiktok stubs but not canonical video URLs", () => {
    expect(isShortShareLink("https://www.tiktok.com/t/ZTkUEAsaB")).toBe(true);
    expect(isShortShareLink("https://vm.tiktok.com/ZMabc/")).toBe(true);
    expect(isShortShareLink("https://vt.tiktok.com/ZSabc/")).toBe(true);
    expect(isShortShareLink("https://www.tiktok.com/@cook/video/7123")).toBe(false);
    expect(isShortShareLink("https://example.com/t/whatever")).toBe(false);
    expect(isShortShareLink("not a url")).toBe(false);
  });
});
