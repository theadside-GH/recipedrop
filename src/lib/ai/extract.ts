import "server-only";
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic } from "./client";
import { recipeExtractionSchema, type RecipeExtraction } from "./schema";
import { EXTRACTION_SYSTEM, canonicalHint, SEGMENT_SYSTEM } from "./prompts";
import { MODELS } from "@/lib/env";

export interface ImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  /** Base64-encoded image data (no data: prefix). */
  data: string;
}

interface ExtractArgs {
  /** Cleaned text to extract from (web text, transcript, pasted recipe). */
  text?: string;
  /** One or more images (photos/screenshots of a recipe). */
  images?: ImageInput[];
  /** Existing canonical ingredient names, to keep the shopping list merged. */
  knownCanonical?: string[];
  /** Optional context like the source URL. */
  context?: string;
}

type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: ImageInput["mediaType"]; data: string };
    };

/**
 * Extract a structured recipe from text and/or images. Routes to a cheap text
 * model for text-only input and a vision model when images are present. The
 * stable system prompt is prompt-cached across imports.
 */
export async function extractRecipe(args: ExtractArgs): Promise<RecipeExtraction> {
  const client = getAnthropic();
  const hasImages = !!args.images?.length;
  const model = hasImages ? MODELS.vision : MODELS.text;

  const content: ContentBlock[] = [];
  for (const img of args.images ?? []) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.data },
    });
  }
  const userText = [
    args.context ? `Source: ${args.context}` : "",
    args.text ? `Recipe content:\n${args.text}` : "",
    hasImages ? "Extract the recipe shown in the image(s)." : "",
    canonicalHint(args.knownCanonical ?? []),
  ]
    .filter(Boolean)
    .join("\n\n");
  content.push({ type: "text", text: userText });

  const message = await client.messages.parse({
    model,
    max_tokens: 8000,
    system: [
      { type: "text", text: EXTRACTION_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content }],
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
