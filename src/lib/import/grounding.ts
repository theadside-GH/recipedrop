import type { RecipeExtraction } from "@/lib/ai/schema";

/**
 * Share of extracted ingredients that are actually mentioned in the source
 * text. A title-only source ("The fluffiest pancakes!") or a short social
 * caption gives the model just enough to write a plausible recipe from
 * general knowledge — which the user then trusts as the linked recipe. Real
 * extractions name their ingredients in the source; invented ones mostly
 * don't. Returns 1 when there's nothing to check.
 */
export function ingredientGrounding(extraction: RecipeExtraction, sourceText: string): number {
  const haystack = normalize(sourceText);
  const ingredients = extraction.ingredients.filter((ingredient) =>
    ingredient.canonicalName.trim(),
  );
  if (!ingredients.length || !haystack) return 1;
  const grounded = ingredients.filter(
    (ingredient) =>
      mentioned(ingredient.canonicalName, haystack) ||
      // canonicalName is English; the verbatim line keeps non-English sources honest.
      verbatim(ingredient.raw, haystack),
  ).length;
  return grounded / ingredients.length;
}

/** Below this share of source-mentioned ingredients, the recipe was invented. */
export const MIN_GROUNDING = 0.5;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ");
}

function verbatim(raw: string, haystack: string): boolean {
  const line = normalize(raw).trim();
  return line.length >= 6 && haystack.includes(line);
}

/** True when any meaningful word of the ingredient name appears in the source. */
function mentioned(name: string, haystack: string): boolean {
  const words = normalize(name)
    .split(" ")
    .filter((word) => word.length >= 3);
  // Very short names ("egg", "oil") are all we have — check them whole.
  if (!words.length) return haystack.includes(normalize(name).trim());
  return words.some((word) => {
    // Tolerate singular/plural drift: "tomato" vs "tomatoes", "egg" vs "eggs".
    const stem = word.replace(/(?:es|s)$/, "");
    return haystack.includes(stem.length >= 3 ? stem : word);
  });
}
