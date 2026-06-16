import "server-only";
import { and, asc, eq, ilike, lte, desc, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  recipe,
  recipeIngredient,
  step,
  tag,
  recipeTag,
  canonicalIngredient,
  userProfile,
} from "@/lib/db/schema";
import type { RecipeExtraction } from "@/lib/ai/schema";
import { MEAL_TYPES } from "@/lib/ai/schema";
import type { SourceType } from "@/lib/sources/types";
import { guessAisle } from "@/lib/shopping/aisle";
import { normalizeUnit, type UnitCategory } from "@/lib/shopping/units";

/** All known canonical ingredient names, to keep imports merged over time. */
export async function getKnownCanonicalNames(): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ name: canonicalIngredient.name })
    .from(canonicalIngredient)
    .orderBy(desc(canonicalIngredient.createdAt))
    .limit(300);
  return rows.map((r) => r.name);
}

async function resolveCanonical(
  db: Awaited<ReturnType<typeof getDb>>,
  rawName: string,
): Promise<{ id: string; name: string; aisle: string | null } | null> {
  const name = rawName.trim().toLowerCase();
  if (!name) return null;
  const existing = await db
    .select()
    .from(canonicalIngredient)
    .where(eq(canonicalIngredient.name, name))
    .limit(1);
  if (existing[0]) return existing[0];
  const aisle = guessAisle(name);
  const inserted = await db
    .insert(canonicalIngredient)
    .values({ name, aisle })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];
  const again = await db
    .select()
    .from(canonicalIngredient)
    .where(eq(canonicalIngredient.name, name))
    .limit(1);
  return again[0] ?? null;
}

async function upsertTag(
  db: Awaited<ReturnType<typeof getDb>>,
  name: string,
): Promise<string | null> {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const existing = await db.select().from(tag).where(eq(tag.name, n)).limit(1);
  if (existing[0]) return existing[0].id;
  const inserted = await db
    .insert(tag)
    .values({ name: n })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0].id;
  // Lost a race — fetch the row the other writer created.
  const [row] = await db.select().from(tag).where(eq(tag.name, n)).limit(1);
  return row?.id ?? null;
}

/** Persist an extracted recipe (recipe + ingredients + steps + tags). */
export async function createRecipeFromExtraction(
  ownerEmail: string,
  ex: RecipeExtraction,
  opts: { sourceType: SourceType; sourceUrl?: string | null; imagePath?: string | null },
): Promise<string> {
  const db = await getDb();
  const totalMinutes =
    ex.totalMinutes ?? ((ex.prepMinutes ?? 0) + (ex.cookMinutes ?? 0) || null);

  const [created] = await db
    .insert(recipe)
    .values({
      ownerEmail,
      title: ex.title,
      description: ex.description,
      sourceType: opts.sourceType,
      sourceUrl: opts.sourceUrl ?? null,
      sourceAuthor: ex.sourceAuthor,
      imagePath: opts.imagePath ?? ex.imageUrl ?? null,
      prepMinutes: ex.prepMinutes,
      cookMinutes: ex.cookMinutes,
      totalMinutes,
      servingsDefault: ex.servings && ex.servings > 0 ? Math.round(ex.servings) : 2,
      mealType: ex.mealType,
      difficulty: ex.difficulty,
    })
    .returning();

  // Ingredients with canonical resolution.
  let order = 0;
  for (const ing of ex.ingredients) {
    const canonical = await resolveCanonical(db, ing.canonicalName);
    await db.insert(recipeIngredient).values({
      recipeId: created.id,
      rawText: ing.raw,
      canonicalIngredientId: canonical?.id ?? null,
      canonicalName: canonical?.name ?? (ing.canonicalName.trim().toLowerCase() || null),
      quantity: ing.quantity,
      unit: ing.unit,
      unitCategory: ing.unitCategory,
      note: ing.note,
      optional: ing.optional ?? false,
      sortOrder: order++,
    });
  }

  // Steps.
  await db.insert(step).values(
    ex.steps.map((s, i) => ({
      recipeId: created.id,
      stepNumber: i + 1,
      instruction: s.instruction,
      durationMinutes: s.durationMinutes,
    })),
  );

  // Tags.
  for (const t of ex.tags) {
    const tagId = await upsertTag(db, t);
    if (tagId) {
      await db.insert(recipeTag).values({ recipeId: created.id, tagId }).onConflictDoNothing();
    }
  }

  return created.id;
}

async function replaceRecipeParts(
  db: Awaited<ReturnType<typeof getDb>>,
  recipeId: string,
  ex: RecipeExtraction,
): Promise<void> {
  await db.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, recipeId));
  await db.delete(step).where(eq(step.recipeId, recipeId));
  await db.delete(recipeTag).where(eq(recipeTag.recipeId, recipeId));

  let order = 0;
  for (const ing of ex.ingredients) {
    const canonical = await resolveCanonical(db, ing.canonicalName);
    await db.insert(recipeIngredient).values({
      recipeId,
      rawText: ing.raw,
      canonicalIngredientId: canonical?.id ?? null,
      canonicalName: canonical?.name ?? (ing.canonicalName.trim().toLowerCase() || null),
      quantity: ing.quantity,
      unit: ing.unit,
      unitCategory: ing.unitCategory,
      note: ing.note,
      optional: ing.optional ?? false,
      sortOrder: order++,
    });
  }

  if (ex.steps.length > 0) {
    await db.insert(step).values(
      ex.steps.map((s, i) => ({
        recipeId,
        stepNumber: i + 1,
        instruction: s.instruction,
        durationMinutes: s.durationMinutes,
      })),
    );
  }

  for (const t of ex.tags) {
    const tagId = await upsertTag(db, t);
    if (tagId) {
      await db.insert(recipeTag).values({ recipeId, tagId }).onConflictDoNothing();
    }
  }
}

export async function replaceRecipeFromExtraction(input: {
  ownerEmail: string;
  id: string;
  extraction: RecipeExtraction;
  imagePath?: string | null;
}): Promise<void> {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(recipe)
    .where(and(eq(recipe.id, input.id), eq(recipe.ownerEmail, input.ownerEmail)))
    .limit(1);
  if (!existing) throw new Error("Recipe not found.");

  const ex = input.extraction;
  const totalMinutes =
    ex.totalMinutes ?? ((ex.prepMinutes ?? 0) + (ex.cookMinutes ?? 0) || null);

  await db
    .update(recipe)
    .set({
      title: ex.title.trim() || existing.title,
      description: ex.description ?? existing.description,
      sourceAuthor: ex.sourceAuthor ?? existing.sourceAuthor,
      imagePath: input.imagePath ?? ex.imageUrl ?? existing.imagePath,
      prepMinutes: ex.prepMinutes,
      cookMinutes: ex.cookMinutes,
      totalMinutes,
      servingsDefault: ex.servings && ex.servings > 0 ? Math.round(ex.servings) : existing.servingsDefault,
      mealType: ex.mealType,
      difficulty: ex.difficulty,
    })
    .where(eq(recipe.id, input.id));

  await replaceRecipeParts(db, input.id, ex);
}

export async function setRecipeImage(input: {
  ownerEmail: string;
  id: string;
  imagePath: string;
}): Promise<void> {
  const db = await getDb();
  const [updated] = await db
    .update(recipe)
    .set({ imagePath: input.imagePath })
    .where(and(eq(recipe.id, input.id), eq(recipe.ownerEmail, input.ownerEmail)))
    .returning({ id: recipe.id });
  if (!updated) throw new Error("Recipe not found.");
}

export interface RecipeFilters {
  mealType?: string;
  maxMinutes?: number;
  search?: string;
  tag?: string;
  favorite?: boolean;
  sort?: "newest" | "oldest" | "favorites" | "quickest" | "title";
}

/** List recipes for the library grid with optional filters. */
export async function listRecipes(ownerEmail: string, filters: RecipeFilters = {}) {
  const db = await getDb();
  const conds = [eq(recipe.ownerEmail, ownerEmail)];
  if (filters.mealType) conds.push(eq(recipe.mealType, filters.mealType as never));
  if (filters.maxMinutes) conds.push(lte(recipe.totalMinutes, filters.maxMinutes));
  if (filters.search) conds.push(ilike(recipe.title, `%${filters.search}%`));
  if (filters.favorite) conds.push(eq(recipe.isFavorite, true));

  let ids: string[] | null = null;
  if (filters.tag) {
    const tagged = await db
      .select({ recipeId: recipeTag.recipeId })
      .from(recipeTag)
      .innerJoin(tag, eq(tag.id, recipeTag.tagId))
      .where(eq(tag.name, filters.tag.toLowerCase()));
    ids = tagged.map((r) => r.recipeId);
    if (ids.length === 0) return [];
    conds.push(inArray(recipe.id, ids));
  }

  return db
    .select()
    .from(recipe)
    .where(and(...conds))
    .orderBy(...recipeOrder(filters.sort));
}

function recipeOrder(sort: RecipeFilters["sort"] = "newest") {
  if (sort === "oldest") return [asc(recipe.createdAt)];
  if (sort === "favorites") return [desc(recipe.isFavorite), desc(recipe.createdAt)];
  if (sort === "quickest") return [asc(sql`coalesce(${recipe.totalMinutes}, 99999)`), desc(recipe.createdAt)];
  if (sort === "title") return [asc(recipe.title)];
  return [desc(recipe.createdAt)];
}

export async function setRecipeFavorite(id: string, isFavorite: boolean): Promise<void> {
  const db = await getDb();
  await db.update(recipe).set({ isFavorite }).where(eq(recipe.id, id));
}

export async function setRecipePublic(input: {
  ownerEmail: string;
  id: string;
  isPublic: boolean;
}): Promise<void> {
  const db = await getDb();
  const [updated] = await db
    .update(recipe)
    .set({ isPublic: input.isPublic })
    .where(and(eq(recipe.id, input.id), eq(recipe.ownerEmail, input.ownerEmail)))
    .returning({ id: recipe.id });
  if (!updated) throw new Error("Recipe not found.");
}

export interface PublicRecipeRow {
  recipe: typeof recipe.$inferSelect;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
}

export async function listPublicRecipes(
  sort: "newest" | "popular" = "newest",
  limit = 12,
): Promise<PublicRecipeRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      recipe,
      displayName: userProfile.displayName,
      handle: userProfile.handle,
      avatarUrl: userProfile.avatarUrl,
    })
    .from(recipe)
    .innerJoin(userProfile, eq(userProfile.email, recipe.ownerEmail))
    .where(and(eq(recipe.isPublic, true), eq(userProfile.publicFeedOptIn, true)))
    .orderBy(
      sort === "popular" ? desc(recipe.dropCount) : desc(recipe.createdAt),
      desc(recipe.createdAt),
    )
    .limit(limit);
  return rows;
}

export interface DuplicateRecipe {
  id: string;
  title: string;
  reason: "source" | "title";
}

export async function findDuplicateRecipeBySource(input: {
  ownerEmail: string;
  sourceUrl: string;
}): Promise<DuplicateRecipe | null> {
  const db = await getDb();
  const [bySource] = await db
    .select({ id: recipe.id, title: recipe.title })
    .from(recipe)
    .where(and(eq(recipe.ownerEmail, input.ownerEmail), eq(recipe.sourceUrl, input.sourceUrl.trim())))
    .limit(1);
  return bySource ? { ...bySource, reason: "source" } : null;
}

export async function findDuplicateRecipe(input: {
  ownerEmail: string;
  sourceUrl?: string | null;
  title: string;
}): Promise<DuplicateRecipe | null> {
  const db = await getDb();
  const sourceUrl = input.sourceUrl?.trim();
  if (sourceUrl) {
    const bySource = await findDuplicateRecipeBySource({
      ownerEmail: input.ownerEmail,
      sourceUrl,
    });
    if (bySource) return bySource;
  }

  const normalizedTitle = normalizeTitle(input.title);
  if (isGenericTitle(normalizedTitle)) return null;
  const rows = await db
    .select({ id: recipe.id, title: recipe.title })
    .from(recipe)
    .where(and(eq(recipe.ownerEmail, input.ownerEmail), ilike(recipe.title, `%${input.title.slice(0, 40)}%`)))
    .limit(20);

  const byTitle = rows.find((row) => normalizeTitle(row.title) === normalizedTitle);
  return byTitle ? { ...byTitle, reason: "title" } : null;
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|recipe)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericTitle(normalizedTitle: string) {
  return [
    "",
    "recipe",
    "tiktok",
    "instagram",
    "reel",
    "unknown",
    "untitled",
    "video",
    "social post",
  ].includes(normalizedTitle);
}

export interface RecipeEditInput {
  ownerEmail: string;
  id: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  sourceAuthor: string | null;
  imagePath: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  servingsDefault: number;
  mealType: string;
  difficulty: string | null;
  tags: string[];
  ingredients: string[];
  steps: string[];
}

export async function updateRecipe(input: RecipeEditInput): Promise<void> {
  const db = await getDb();
  const title = input.title.trim() || "Untitled Recipe";
  const prepMinutes = positiveIntOrNull(input.prepMinutes);
  const cookMinutes = positiveIntOrNull(input.cookMinutes);
  const totalMinutes =
    positiveIntOrNull(input.totalMinutes) ?? ((prepMinutes ?? 0) + (cookMinutes ?? 0) || null);
  const mealType = MEAL_TYPES.includes(input.mealType as (typeof MEAL_TYPES)[number])
    ? input.mealType
    : "dinner";
  const difficulty = ["easy", "medium", "hard"].includes(input.difficulty ?? "")
    ? input.difficulty
    : null;

  const [updated] = await db
    .update(recipe)
    .set({
      title,
      description: cleanOptional(input.description),
      sourceUrl: cleanOptional(input.sourceUrl),
      sourceAuthor: cleanOptional(input.sourceAuthor),
      imagePath: cleanOptional(input.imagePath),
      prepMinutes,
      cookMinutes,
      totalMinutes,
      servingsDefault: Math.max(1, Math.round(input.servingsDefault || 1)),
      mealType: mealType as never,
      difficulty,
    })
    .where(and(eq(recipe.id, input.id), eq(recipe.ownerEmail, input.ownerEmail)))
    .returning({ id: recipe.id });

  if (!updated) throw new Error("Recipe not found.");

  await db.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, input.id));
  await db.delete(step).where(eq(step.recipeId, input.id));
  await db.delete(recipeTag).where(eq(recipeTag.recipeId, input.id));

  const ingredientLines = input.ingredients.map((line) => line.trim()).filter(Boolean);
  let order = 0;
  for (const line of ingredientLines) {
    const parsed = parseEditedIngredient(line);
    const canonical = await resolveCanonical(db, parsed.canonicalName);
    await db.insert(recipeIngredient).values({
      recipeId: input.id,
      rawText: line,
      canonicalIngredientId: canonical?.id ?? null,
      canonicalName: canonical?.name ?? parsed.canonicalName,
      quantity: parsed.quantity,
      unit: parsed.unit,
      unitCategory: parsed.unitCategory,
      note: parsed.note,
      optional: parsed.optional,
      sortOrder: order++,
    });
  }

  const stepLines = input.steps.map((line) => line.trim()).filter(Boolean);
  if (stepLines.length > 0) {
    await db.insert(step).values(
      stepLines.map((instruction, i) => ({
        recipeId: input.id,
        stepNumber: i + 1,
        instruction,
        durationMinutes: null,
      })),
    );
  }

  for (const t of input.tags.map((tagName) => tagName.trim()).filter(Boolean)) {
    const tagId = await upsertTag(db, t);
    if (tagId) {
      await db.insert(recipeTag).values({ recipeId: input.id, tagId }).onConflictDoNothing();
    }
  }
}

function cleanOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function positiveIntOrNull(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value) || value <= 0) return null;
  return Math.round(value);
}

function parseEditedIngredient(raw: string): {
  canonicalName: string;
  quantity: number | null;
  unit: string | null;
  unitCategory: UnitCategory;
  note: string | null;
  optional: boolean;
} {
  const optional = /\boptional\b/i.test(raw);
  const withoutOptional = raw.replace(/\(?\boptional\b\)?/gi, "").trim();
  const [main, ...noteParts] = withoutOptional.split(",");
  const tokens = main.trim().split(/\s+/).filter(Boolean);
  const quantityInfo = parseLeadingQuantity(tokens);
  let unit: string | null = null;
  let nameStart = quantityInfo.used;

  if (quantityInfo.quantity != null && tokens[nameStart]) {
    const candidate = tokens[nameStart].toLowerCase().replace(/\.$/, "");
    const normalized = normalizeUnit(candidate);
    if (normalized.category !== "unknown" || likelyCountNoun(candidate)) {
      unit = candidate;
      nameStart += 1;
    }
  }

  const name = tokens.slice(nameStart).join(" ") || main.trim() || raw.trim();
  const normalizedUnit = normalizeUnit(unit);
  const unitCategory =
    unit == null && quantityInfo.quantity != null ? "count" : normalizedUnit.category;
  const canonicalName = cleanIngredientName(name);

  return {
    canonicalName,
    quantity: quantityInfo.quantity,
    unit,
    unitCategory,
    note: cleanOptional(noteParts.join(", ")),
    optional,
  };
}

function parseLeadingQuantity(tokens: string[]): { quantity: number | null; used: number } {
  const first = tokens[0];
  if (!first) return { quantity: null, used: 0 };
  const firstValue = parseNumberToken(first);
  if (firstValue == null) return { quantity: null, used: 0 };

  const secondValue = parseFraction(tokens[1]);
  if (/^\d+$/.test(first) && secondValue != null) {
    return { quantity: firstValue + secondValue, used: 2 };
  }
  return { quantity: firstValue, used: 1 };
}

function parseNumberToken(token: string): number | null {
  const cleaned = token.trim().replace(/[~+]/g, "");
  const fraction = parseFraction(cleaned);
  if (fraction != null) return fraction;
  if (/^\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
  return null;
}

function parseFraction(token: string | undefined): number | null {
  if (!token || !/^\d+\/\d+$/.test(token)) return null;
  const [top, bottom] = token.split("/").map(Number);
  if (!bottom) return null;
  return top / bottom;
}

function likelyCountNoun(unit: string) {
  return [
    "clove",
    "cloves",
    "can",
    "cans",
    "slice",
    "slices",
    "bunch",
    "bunches",
    "package",
    "packages",
    "jar",
    "jars",
    "bag",
    "bags",
  ].includes(unit);
}

function cleanIngredientName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(chopped|diced|minced|sliced|crushed|fresh|freshly|large|small|medium)\b/g, " ")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "ingredient";
}

/** Full recipe detail: recipe + ingredients + steps + tag names. */
export async function getRecipeFull(id: string) {
  const db = await getDb();
  const [r] = await db.select().from(recipe).where(eq(recipe.id, id)).limit(1);
  if (!r) return null;
  const ingredients = await db
    .select()
    .from(recipeIngredient)
    .where(eq(recipeIngredient.recipeId, id))
    .orderBy(recipeIngredient.sortOrder);
  const steps = await db
    .select()
    .from(step)
    .where(eq(step.recipeId, id))
    .orderBy(step.stepNumber);
  const tags = await db
    .select({ name: tag.name })
    .from(recipeTag)
    .innerJoin(tag, eq(tag.id, recipeTag.tagId))
    .where(eq(recipeTag.recipeId, id));
  return { recipe: r, ingredients, steps, tags: tags.map((t) => t.name) };
}

export async function deleteRecipe(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(recipe).where(eq(recipe.id, id));
}

/** Distinct tag names in use, for filter chips. */
export async function listTags(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select({ name: tag.name }).from(tag).orderBy(tag.name);
  return rows.map((r) => r.name);
}

/** Lightweight count for empty-state detection. */
export async function recipeCount(ownerEmail: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(recipe)
    .where(eq(recipe.ownerEmail, ownerEmail));
  return row?.n ?? 0;
}
