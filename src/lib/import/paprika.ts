import "server-only";
import { gunzipSync, unzipSync } from "fflate";
import { createRecipeManual, findDuplicateRecipe, setRecipeRating } from "@/lib/repo/recipes";
import { persistImage } from "@/lib/storage";
import { MEAL_TYPES } from "@/lib/ai/schema";

/**
 * Import a Paprika export (.paprikarecipes) — the highest-intent switcher
 * already has their whole library in one file. The format is a ZIP of
 * .paprikarecipe entries, each a gzipped JSON object. Everything is already
 * structured, so this path costs zero AI quota.
 */

interface PaprikaRecipe {
  name?: string;
  description?: string;
  ingredients?: string;
  directions?: string;
  notes?: string;
  prep_time?: string;
  cook_time?: string;
  total_time?: string;
  servings?: string;
  difficulty?: string;
  source?: string;
  source_url?: string;
  image_url?: string;
  photo_data?: string; // base64 JPEG
  categories?: string[];
  rating?: number; // 0–5, 0 = unrated
}

export interface PaprikaImportResult {
  imported: number;
  skipped: number;
  failed: number;
  total: number;
}

const MAX_RECIPES_PER_FILE = 500;

export async function importPaprikaArchive(
  ownerEmail: string,
  archive: Uint8Array,
): Promise<PaprikaImportResult> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(archive);
  } catch {
    throw new Error(
      "That file doesn't look like a Paprika export. In Paprika: Settings → Export → Paprika Recipe Format (.paprikarecipes).",
    );
  }

  const names = Object.keys(entries)
    .filter((name) => name.toLowerCase().endsWith(".paprikarecipe"))
    .slice(0, MAX_RECIPES_PER_FILE);
  if (names.length === 0) {
    throw new Error("No recipes found in that file — it should be a .paprikarecipes export from Paprika.");
  }

  const result: PaprikaImportResult = { imported: 0, skipped: 0, failed: 0, total: names.length };
  for (const name of names) {
    try {
      const parsed = JSON.parse(
        new TextDecoder().decode(gunzipSync(entries[name])),
      ) as PaprikaRecipe;
      const outcome = await importOne(ownerEmail, parsed);
      result[outcome] += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}

async function importOne(
  ownerEmail: string,
  r: PaprikaRecipe,
): Promise<"imported" | "skipped"> {
  const title = r.name?.trim();
  if (!title) return "skipped";

  const sourceUrl = r.source_url?.trim() || null;
  const duplicate = await findDuplicateRecipe({ ownerEmail, sourceUrl, title });
  if (duplicate) return "skipped";

  const ingredients = splitLines(r.ingredients);
  const steps = splitLines(r.directions);
  const prepMinutes = parseMinutes(r.prep_time);
  const cookMinutes = parseMinutes(r.cook_time);
  const categories = (r.categories ?? []).map((c) => c.trim()).filter(Boolean);

  // Photos upload to Storage (small CDN URL in the row) — embedding hundreds
  // of base64 photos would make the library page megabytes of HTML, at
  // exactly the library size this importer exists for. Degrades to the
  // embedded copy when storage isn't configured.
  const imagePath = r.photo_data
    ? await persistImage(`data:image/jpeg;base64,${r.photo_data.replace(/\s/g, "")}`)
    : r.image_url?.trim() || null;

  const id = await createRecipeManual(ownerEmail, {
    title,
    description: [r.description?.trim(), r.notes?.trim()].filter(Boolean).join("\n\n") || null,
    sourceUrl,
    sourceAuthor: r.source?.trim() || null,
    imagePath,
    prepMinutes,
    cookMinutes,
    totalMinutes: parseMinutes(r.total_time) ?? ((prepMinutes ?? 0) + (cookMinutes ?? 0) || null),
    servingsDefault: parseServings(r.servings),
    mealType: guessMealType(categories),
    difficulty: ["easy", "medium", "hard"].includes(r.difficulty?.toLowerCase() ?? "")
      ? (r.difficulty!.toLowerCase() as string)
      : null,
    tags: categories.map((c) => c.toLowerCase()),
    ingredients,
    steps,
  });

  // Paprika has 1–5 star ratings too — carry them straight over.
  if (r.rating && r.rating >= 1 && r.rating <= 5) {
    await setRecipeRating(ownerEmail, id, r.rating);
  }
  return "imported";
}

function splitLines(value: string | undefined): string[] {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** "1 hr 30 min", "45 minutes", "1:30" → minutes; unparseable → null. */
function parseMinutes(value: string | undefined): number | null {
  const raw = value?.trim().toLowerCase();
  if (!raw) return null;
  const clock = raw.match(/^(\d+):(\d{2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  let minutes = 0;
  const hours = raw.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/);
  if (hours) minutes += Math.round(Number(hours[1]) * 60);
  const mins = raw.match(/(\d+)\s*(?:minutes?|mins?|m\b)/);
  if (mins) minutes += Number(mins[1]);
  if (minutes === 0) {
    const bare = raw.match(/^(\d+)$/);
    if (bare) minutes = Number(bare[1]);
  }
  return minutes > 0 ? minutes : null;
}

function parseServings(value: string | undefined): number {
  const n = Number(value?.match(/\d+/)?.[0]);
  return Number.isFinite(n) && n > 0 ? Math.min(64, n) : 2;
}

function guessMealType(categories: string[]): string {
  const haystack = categories.join(" ").toLowerCase();
  for (const type of MEAL_TYPES) {
    if (haystack.includes(type)) return type;
  }
  if (/salad|soup|sandwich/.test(haystack)) return "lunch";
  if (/cake|cookie|sweet|baking|pie/.test(haystack)) return "dessert";
  if (/cocktail|smoothie|juice/.test(haystack)) return "drink";
  return "dinner";
}
