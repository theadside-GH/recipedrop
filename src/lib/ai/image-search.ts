import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "./client";
import { MODELS } from "@/lib/env";
import { fetchPageImages } from "@/lib/sources/website";
import { pickWorkingImage } from "@/lib/import/images";

const SEARCH_SYSTEM = `You find recipe pages for a dish so a recipe app can borrow a representative photo.

Use web search (once or twice at most) to find well-known recipe pages for the dish the user names. Prefer popular recipe sites with big hero photos of the finished dish.

Reply with ONLY a JSON array of 2-4 page URLs as strings, best match first — no prose, no markdown fences. If nothing fits, reply with [].`;

/** Recipe-page URLs for a dish, via the web-search server tool on the cheap text model. */
async function searchRecipePages(title: string): Promise<string[]> {
  const client = getAnthropic();
  const params = {
    model: MODELS.text,
    max_tokens: 1500,
    system: [{ type: "text" as const, text: SEARCH_SYSTEM }],
    tools: [
      { type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 3 },
    ],
  };
  let messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Dish: ${title}` },
  ];
  let response = await client.messages.create({ ...params, messages });
  // Server-tool turns can pause mid-loop; resume a bounded number of times.
  for (let i = 0; i < 3 && response.stop_reason === "pause_turn"; i++) {
    messages = [...messages, { role: "assistant", content: response.content }];
    response = await client.messages.create({ ...params, messages });
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return [];
  try {
    const parsed: unknown = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u))
      .slice(0, 4);
  } catch {
    return [];
  }
}

/**
 * Last-resort recipe photo: search the web for the dish by title, harvest the
 * hero images from the top recipe pages, and return the first one that
 * actually loads. Used so no imported recipe ever lands without a picture —
 * the owner can always replace it from the edit page. Returns null (never
 * throws) when AI is unconfigured or nothing usable is found.
 */
export async function findStandInImage(title: string): Promise<string | null> {
  const cleaned = title.trim();
  if (!cleaned) return null;
  try {
    const pages = await searchRecipePages(cleaned);
    const candidates: string[] = [];
    for (const url of pages.slice(0, 3)) {
      try {
        candidates.push(...(await fetchPageImages(url)));
      } catch {
        // Dead page — try the next one.
      }
      if (candidates.length >= 8) break;
    }
    return await pickWorkingImage(candidates);
  } catch (err) {
    console.warn("Stand-in image search failed", err);
    return null;
  }
}
