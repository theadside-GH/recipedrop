import "server-only";
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic } from "./client";
import { recipeExtractionSchema, type RecipeExtraction } from "./schema";
import { EXTRACTION_SYSTEM, canonicalHint, SEGMENT_SYSTEM } from "./prompts";
import { MODELS } from "@/lib/env";
import { dropContradictedDietaryTags } from "@/lib/import/dietary";

export interface ImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  /** Base64-encoded image data (no data: prefix). */
  data: string;
}

interface ExtractArgs {
  /** Cleaned text to extract from (web text, transcript, pasted recipe, photo transcription). */
  text: string;
  /** Existing canonical ingredient names, to keep the shopping list merged. */
  knownCanonical?: string[];
  /** Optional context like the source URL. */
  context?: string;
}

/**
 * Extract a structured recipe from text with the cheap text model. Photos get
 * here too, via transcribeRecipeImages — so every source shares one extraction
 * path and one grounding check. The stable system prompt is prompt-cached.
 */
export async function extractRecipe(args: ExtractArgs): Promise<RecipeExtraction> {
  const client = getAnthropic();
  const userText = [
    args.context ? `Source: ${args.context}` : "",
    `Recipe content:\n${args.text}`,
    canonicalHint(args.knownCanonical ?? []),
  ]
    .filter(Boolean)
    .join("\n\n");

  const message = await client.messages.parse({
    model: MODELS.text,
    max_tokens: 8000,
    system: [
      { type: "text", text: EXTRACTION_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userText }],
    output_config: { format: zodOutputFormat(recipeExtractionSchema) },
  });

  if (!message.parsed_output) {
    throw new Error(
      "The model could not extract a recipe from this source. Try pasting the recipe text directly.",
    );
  }
  return roundMinuteFields(message.parsed_output);
}

/**
 * The model sometimes returns fractional minutes ("2-3 minutes" -> 2.5), but
 * every minutes column is a Postgres integer — unrounded values made the
 * recipe insert fail after a successful extraction.
 */
function roundMinuteFields(ex: RecipeExtraction): RecipeExtraction {
  const round = (v: number | null) => (v == null ? null : Math.round(v));
  return {
    ...ex,
    prepMinutes: round(ex.prepMinutes),
    cookMinutes: round(ex.cookMinutes),
    totalMinutes: round(ex.totalMinutes),
    steps: ex.steps.map((s) => ({ ...s, durationMinutes: round(s.durationMinutes) })),
    tags: dropContradictedDietaryTags(
      ex.tags,
      ex.ingredients.map((i) => i.canonicalName || i.raw),
    ),
  };
}

const segmentSchema = z.object({ items: z.array(z.string()) });

/**
 * Split a bulk paste of mixed recipes/links into individual item strings using
 * the cheap text model. Falls back to returning the whole blob as one item.
 */
export async function segmentBulk(blob: string): Promise<string[]> {
  const client = getAnthropic();
  const message = await client.messages.parse({
    model: MODELS.text,
    max_tokens: 4000,
    system: [{ type: "text", text: SEGMENT_SYSTEM }],
    messages: [{ role: "user", content: blob }],
    output_config: { format: zodOutputFormat(segmentSchema) },
  });
  const items = message.parsed_output?.items ?? [];
  return items.filter((s: string) => s.trim().length > 0);
}

const transcriptionSchema = z.object({
  /** False when the images show no written recipe (a plated dish, a menu, a blank page). */
  hasRecipeText: z.boolean(),
  /** One short phrase for what the images show, used in the error when hasRecipeText is false. */
  shows: z.string(),
  /** The recipe title exactly as written, or null if none is visible. */
  title: z.string().nullable(),
  /** Every piece of recipe text, verbatim, in reading order. */
  text: z.string(),
});

export type RecipeTranscription = z.infer<typeof transcriptionSchema>;

/**
 * Read recipe photos/screenshots into plain text — the vision half of a photo
 * import. Transcription (not extraction) is deliberate: the model only has to
 * copy what's on the page, and the result then goes through the same text
 * extraction + grounding check as a pasted recipe, so a photo can never yield
 * ingredients that aren't actually written in it. Images arrive in page order;
 * tiles of one long screenshot overlap slightly.
 */
export async function transcribeRecipeImages(images: ImageInput[]): Promise<RecipeTranscription> {
  const client = getAnthropic();
  const message = await client.messages.parse({
    model: MODELS.vision,
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(transcriptionSchema) },
    system: [{ type: "text", text: TRANSCRIBE_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mediaType, data: img.data },
          })),
          {
            type: "text",
            text:
              images.length > 1
                ? `These ${images.length} images are consecutive parts of the same recipe, in order. Transcribe them as one recipe.`
                : "Transcribe the recipe in this image.",
          },
        ],
      },
    ],
  });
  if (!message.parsed_output) {
    throw new Error("DishCovered couldn't read that photo. Try again, or try a sharper photo.");
  }
  return message.parsed_output;
}

const TRANSCRIBE_SYSTEM = `You transcribe recipes from photos and screenshots: cookbook pages, handwritten cards, magazine clippings, and phone screenshots of websites or social posts.

Copy the recipe text exactly as written — title, servings/yield, times, every ingredient line, every step, and any notes that change how it's cooked (substitutions, oven temperatures, make-ahead). Keep the author's words, numbers, fractions, units, and ranges ("15-18 minutes") exactly. Do not rewrite, summarize, convert, reorder, or correct anything.

- Skip what isn't the recipe: ads, navigation, comments, like counts, life stories, and other recipes on the same page.
- Consecutive images may overlap (tiles of one long screenshot, or two photos of the same page). Include overlapping lines once.
- Handwriting: transcribe your best reading. If a word or number is genuinely illegible, write [illegible] — never guess a quantity.
- Use plain text with "Ingredients" and "Instructions" headings and one ingredient or step per line.
- If there is no written recipe at all (a photo of food, a menu, a blank or unrelated page), set hasRecipeText to false and leave text empty. A caption that only names the dish is not a recipe.
- "shows": at most six words naming what the image shows, e.g. "a handwritten recipe card" or "a photo of a plated curry".`;
