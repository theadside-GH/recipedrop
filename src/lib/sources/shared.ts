import { detectSourceType } from "./detect";
import type { SourceType } from "./types";

const URL_RE = /https?:\/\/[^\s)>\]"']+/i;

export interface SharedRecipeInput {
  value: string;
  sourceType: SourceType;
}

/**
 * Mobile share sheets are inconsistent: some put links in `url`, others bury
 * them in `text` or `title`. Collapse all shared fields into one importable
 * string, preferring the first URL when one exists.
 */
export function parseSharedRecipeInput(fields: {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}): SharedRecipeInput | null {
  const candidates = [fields.url, fields.text, fields.title]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v);

  for (const candidate of candidates) {
    const match = candidate.match(URL_RE);
    if (match?.[0]) {
      const value = match[0].replace(/[.,]+$/, "");
      return { value, sourceType: detectSourceType(value) };
    }
  }

  const combined = candidates.join("\n\n").trim();
  if (!combined) return null;
  return { value: combined, sourceType: "text" };
}

const ALL_URLS_RE = /https?:\/\/[^\s)>\]"']+/gi;

/**
 * Phones rarely copy a bare link: "Copy" from a share sheet or a message
 * often yields "The Easiest, Fluffiest Pancakes https://…". Treated as text,
 * the model sees only a title and either fails or invents a recipe. When the
 * paste is one link plus a short blurb, import the link. A long paste with a
 * link in it (a full caption) stays text — the recipe is in the words.
 */
export function linkFromPastedText(value: string): string | null {
  const urls = value.match(ALL_URLS_RE) ?? [];
  if (urls.length !== 1) return null;
  const rest = value.replace(ALL_URLS_RE, "").trim();
  if (rest.length > 200) return null;
  return urls[0].replace(/[.,]+$/, "");
}
