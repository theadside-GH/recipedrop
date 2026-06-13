import { describe, expect, it } from "vitest";
import { pathWithSearch, safeRedirectPath } from "./auth-redirect";

describe("safeRedirectPath", () => {
  it("keeps an app-relative path with query params", () => {
    expect(safeRedirectPath("/share?text=https%3A%2F%2Fyoutu.be%2Fabc")).toBe(
      "/share?text=https://youtu.be/abc",
    );
  });

  it("falls back for external redirects", () => {
    expect(safeRedirectPath("https://example.com/bad")).toBe("/");
    expect(safeRedirectPath("//example.com/bad")).toBe("/");
  });

  it("does not redirect back into auth pages", () => {
    expect(safeRedirectPath("/login?next=/share")).toBe("/");
    expect(safeRedirectPath("/auth/confirm")).toBe("/");
  });
});

describe("pathWithSearch", () => {
  it("joins path and query string", () => {
    expect(pathWithSearch("/share", "?text=hello")).toBe("/share?text=hello");
  });
});
