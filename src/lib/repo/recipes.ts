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
} from "@/lib/db/schema";
import type { RecipeExtraction } from "@/lib/ai/schema";
import type { SourceType } from "@/lib/sources/types";
import { guessAisle } from "@/lib/shopping/aisle";

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
