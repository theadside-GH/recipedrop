import { describe, expect, it } from "vitest";
import { closestKnownName } from "./spelling";

const KNOWN = [
  "chicken",
  "chicken breast",
  "chicken thigh",
  "tomato",
  "butter",
  "olive oil",
];

describe("closestKnownName", () => {
  it("suggests the fix for a one-letter typo", () => {
    expect(closestKnownName("chiken", KNOWN)).toBe("chicken");
  });

  it("suggests for a transposition", () => {
    expect(closestKnownName("tomaot", KNOWN)).toBe("tomato");
  });

  it("stays quiet when the name is already known", () => {
    expect(closestKnownName("chicken breast", KNOWN)).toBeNull();
    expect(closestKnownName("  Butter ", KNOWN)).toBeNull();
  });

  it("never bridges genuinely different ingredients", () => {
    // "chicken thigh" vs "chicken breast" differ by far more than 2 edits.
    expect(closestKnownName("chicken thigh", KNOWN)).toBeNull();
    expect(closestKnownName("beef", KNOWN)).toBeNull();
  });

  it("ignores very short inputs where guessing is unsafe", () => {
    expect(closestKnownName("oi", KNOWN)).toBeNull();
  });

  it("is stricter on short words", () => {
    // 4 letters: only 1 edit allowed, so a 2-edit miss stays quiet.
    expect(closestKnownName("bstr", KNOWN)).toBeNull();
  });
});
