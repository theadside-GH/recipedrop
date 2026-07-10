import "server-only";
import {
  and,
  asc,
  countDistinct,
  eq,
  exists,
  ilike,
  isNotNull,
  isNull,
  lt,
  lte,
  desc,
  inArray,
  notExists,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, type DB } from "@/lib/db";
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
import { sourceKeyFor } from "@/lib/source-key";
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
  opts: {
    sourceType: SourceType;
    sourceUrl?: string | null;
    /** Precomputed (short-link-resolved) key; computed from sourceUrl if omitted. */
    sourceKey?: string | null;
    imagePath?: string | null;
  },
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
      sourceKey: opts.sourceKey ?? sourceKeyFor(opts.sourceUrl),
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
  /** "own" = dropped by the owner; "saved" = saved from another cook's drop. */
  origin?: "own" | "saved";
  sort?: "newest" | "oldest" | "favorites" | "quickest" | "title";
}

/**
 * Search condition across title, description, ingredient names/lines, and
 * tags. Plain ILIKE so it works on both Supabase and local PGlite.
 */
function recipeSearchCondition(db: DB, term: string): SQL {
  const q = `%${term.trim()}%`;
  return or(
    ilike(recipe.title, q),
    ilike(recipe.description, q),
    exists(
      db
        .select({ one: sql`1` })
        .from(recipeIngredient)
        .where(
          and(
            eq(recipeIngredient.recipeId, recipe.id),
            or(ilike(recipeIngredient.canonicalName, q), ilike(recipeIngredient.rawText, q)),
          ),
        ),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(recipeTag)
        .innerJoin(tag, eq(tag.id, recipeTag.tagId))
        .where(and(eq(recipeTag.recipeId, recipe.id), ilike(tag.name, q))),
    ),
  )!;
}

/** List recipes for the library grid with optional filters. */
export async function listRecipes(ownerEmail: string, filters: RecipeFilters = {}) {
  const db = await getDb();
  const conds = [eq(recipe.ownerEmail, ownerEmail)];
  if (filters.mealType) conds.push(eq(recipe.mealType, filters.mealType as never));
  if (filters.maxMinutes) conds.push(lte(recipe.totalMinutes, filters.maxMinutes));
  if (filters.search?.trim()) conds.push(recipeSearchCondition(db, filters.search));
  if (filters.favorite) conds.push(eq(recipe.isFavorite, true));
  if (filters.origin === "own") conds.push(isNull(recipe.savedFromEmail));
  if (filters.origin === "saved") conds.push(isNotNull(recipe.savedFromEmail));

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

export async function setRecipeFavorite(
  ownerEmail: string,
  id: string,
  isFavorite: boolean,
): Promise<void> {
  const db = await getDb();
  await db
    .update(recipe)
    .set({ isFavorite })
    .where(and(eq(recipe.id, id), eq(recipe.ownerEmail, ownerEmail)));
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
  /** People who dropped this dish (distinct owners of the same source link). */
  dropperCount: number;
}

export interface PublicRecipeFilters {
  q?: string;
  mealType?: string;
}

/**
 * Only list a source link once: keep the earliest public drop (the original
 * dropper gets the byline) and hide later re-drops of the same sourceKey.
 */
function isEarliestPublicDrop(db: DB): SQL {
  const earlier = alias(recipe, "earlier_drop");
  const earlierProfile = alias(userProfile, "earlier_profile");
  return notExists(
    db
      .select({ one: sql`1` })
      .from(earlier)
      .innerJoin(earlierProfile, eq(earlierProfile.email, earlier.ownerEmail))
      .where(
        and(
          isNotNull(recipe.sourceKey),
          eq(earlier.sourceKey, recipe.sourceKey),
          eq(earlier.isPublic, true),
          eq(earlierProfile.publicFeedOptIn, true),
          or(
            lt(earlier.createdAt, recipe.createdAt),
            and(eq(earlier.createdAt, recipe.createdAt), lt(earlier.id, recipe.id)),
          ),
        ),
      ),
  ) as SQL;
}

/**
 * How many distinct cooks hold each source link (independent imports and
 * saved copies both keep the link). Keyless recipes (typed in by hand or from
 * photos) fall back to dropCount, which tracks their saved copies directly.
 */
export async function attachDropperCounts(
  rows: Omit<PublicRecipeRow, "dropperCount">[],
): Promise<PublicRecipeRow[]> {
  const keys = [...new Set(rows.map((row) => row.recipe.sourceKey).filter((k): k is string => !!k))];
  if (keys.length === 0) {
    return rows.map((row) => ({ ...row, dropperCount: row.recipe.dropCount }));
  }
  const db = await getDb();
  const counts = await db
    .select({ key: recipe.sourceKey, n: countDistinct(recipe.ownerEmail) })
    .from(recipe)
    .where(inArray(recipe.sourceKey, keys))
    .groupBy(recipe.sourceKey);
  const byKey = new Map(counts.map((c) => [c.key as string, Number(c.n)]));
  return rows.map((row) => ({
    ...row,
    dropperCount: row.recipe.sourceKey
      ? (byKey.get(row.recipe.sourceKey) ?? 1)
      : row.recipe.dropCount,
  }));
}

/** Dropper count for a single recipe (public detail page). */
export async function dropperCountForRecipe(r: {
  sourceKey: string | null;
  dropCount: number;
}): Promise<number> {
  if (!r.sourceKey) return r.dropCount;
  const db = await getDb();
  const [row] = await db
    .select({ n: countDistinct(recipe.ownerEmail) })
    .from(recipe)
    .where(eq(recipe.sourceKey, r.sourceKey));
  return Number(row?.n ?? 1);
}

export async function listPublicRecipes(
  sort: "newest" | "popular" = "newest",
  limit = 12,
  filters: PublicRecipeFilters = {},
): Promise<PublicRecipeRow[]> {
  const db = await getDb();
  const conds = [
    eq(recipe.isPublic, true),
    eq(userProfile.publicFeedOptIn, true),
    isEarliestPublicDrop(db),
  ];
  if (filters.mealType) conds.push(eq(recipe.mealType, filters.mealType as never));
  if (filters.q?.trim()) conds.push(recipeSearchCondition(db, filters.q));
  const rows = await db
    .select({
      recipe,
      displayName: userProfile.displayName,
      handle: userProfile.handle,
      avatarUrl: userProfile.avatarUrl,
    })
    .from(recipe)
    .innerJoin(userProfile, eq(userProfile.email, recipe.ownerEmail))
    .where(and(...conds))
    .orderBy(
      sort === "popular" ? desc(recipe.dropCount) : desc(recipe.createdAt),
      desc(recipe.createdAt),
    )
    .limit(limit);
  return attachDropperCounts(rows);
}

export interface DuplicateRecipe {
  id: string;
  title: string;
  reason: "source" | "title";
}

export async function findDuplicateRecipeBySource(input: {
  ownerEmail: string;
  sourceUrl: string;
  /** Precomputed (short-link-resolved) key; computed from sourceUrl if omitted. */
  sourceKey?: string | null;
}): Promise<DuplicateRecipe | null> {
  const db = await getDb();
  // Match on the normalized key so re-sharing the same page with different
  // tracking params still counts as a duplicate; fall back to the exact URL
  // for rows whose key can't be computed.
  const key = input.sourceKey ?? sourceKeyFor(input.sourceUrl);
  const [bySource] = await db
    .select({ id: recipe.id, title: recipe.title })
    .from(recipe)
    .where(
      and(
        eq(recipe.ownerEmail, input.ownerEmail),
        key
          ? or(eq(recipe.sourceKey, key), eq(recipe.sourceUrl, input.sourceUrl.trim()))
          : eq(recipe.sourceUrl, input.sourceUrl.trim()),
      ),
    )
    .limit(1);
  return bySource ? { ...bySource, reason: "source" } : null;
}

export async function findDuplicateRecipe(input: {
  ownerEmail: string;
  sourceUrl?: string | null;
  sourceKey?: string | null;
  title: string;
}): Promise<DuplicateRecipe | null> {
  const db = await getDb();
  const sourceUrl = input.sourceUrl?.trim();
  if (sourceUrl) {
    const bySource = await findDuplicateRecipeBySource({
      ownerEmail: input.ownerEmail,
      sourceUrl,
      sourceKey: input.sourceKey,
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

/** Validate/normalize the editable recipe fields shared by create and update. */
function normalizeEditedFields(input: Omit<RecipeEditInput, "id" | "ownerEmail">) {
  const prepMinutes = positiveIntOrNull(input.prepMinutes);
  const cookMinutes = positiveIntOrNull(input.cookMinutes);
  const sourceUrl = cleanOptional(input.sourceUrl);
  return {
    title: input.title.trim() || "Untitled Recipe",
    description: cleanOptional(input.description),
    sourceUrl,
    sourceKey: sourceKeyFor(sourceUrl),
    sourceAuthor: cleanOptional(input.sourceAuthor),
    imagePath: cleanOptional(input.imagePath),
    prepMinutes,
    cookMinutes,
    totalMinutes:
      positiveIntOrNull(input.totalMinutes) ?? ((prepMinutes ?? 0) + (cookMinutes ?? 0) || null),
    servingsDefault: Math.max(1, Math.round(input.servingsDefault || 1)),
    mealType: (MEAL_TYPES.includes(input.mealType as (typeof MEAL_TYPES)[number])
      ? input.mealType
      : "dinner") as never,
    difficulty: ["easy", "medium", "hard"].includes(input.difficulty ?? "")
      ? input.difficulty
      : null,
  };
}

/** Replace a recipe's ingredients/steps/tags from hand-edited text lines. */
async function writeEditedParts(
  db: DB,
  recipeId: string,
  input: Pick<RecipeEditInput, "ingredients" | "steps" | "tags">,
): Promise<void> {
  await db.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, recipeId));
  await db.delete(step).where(eq(step.recipeId, recipeId));
  await db.delete(recipeTag).where(eq(recipeTag.recipeId, recipeId));

  const ingredientLines = input.ingredients.map((line) => line.trim()).filter(Boolean);
  let order = 0;
  for (const line of ingredientLines) {
    const parsed = parseEditedIngredient(line);
    const canonical = await resolveCanonical(db, parsed.canonicalName);
    await db.insert(recipeIngredient).values({
      recipeId,
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
        recipeId,
        stepNumber: i + 1,
        instruction,
        durationMinutes: null,
      })),
    );
  }

  for (const t of input.tags.map((tagName) => tagName.trim()).filter(Boolean)) {
    const tagId = await upsertTag(db, t);
    if (tagId) {
      await db.insert(recipeTag).values({ recipeId, tagId }).onConflictDoNothing();
    }
  }
}

export async function updateRecipe(input: RecipeEditInput): Promise<void> {
  const db = await getDb();
  const [updated] = await db
    .update(recipe)
    .set(normalizeEditedFields(input))
    .where(and(eq(recipe.id, input.id), eq(recipe.ownerEmail, input.ownerEmail)))
    .returning({ id: recipe.id });

  if (!updated) throw new Error("Recipe not found.");
  await writeEditedParts(db, input.id, input);
}

/** Create a recipe the user typed in by hand — no import, no AI required. */
export async function createRecipeManual(
  ownerEmail: string,
  input: Omit<RecipeEditInput, "id" | "ownerEmail">,
): Promise<string> {
  const db = await getDb();
  const [created] = await db
    .insert(recipe)
    .values({ ownerEmail, sourceType: "text", ...normalizeEditedFields(input) })
    .returning({ id: recipe.id });
  await writeEditedParts(db, created.id, input);
  return created.id;
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
  if (!isUuid(id)) return null;
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
  const [dropper] = await db
    .select({
      displayName: userProfile.displayName,
      handle: userProfile.handle,
      avatarUrl: userProfile.avatarUrl,
    })
    .from(userProfile)
    .where(eq(userProfile.email, r.ownerEmail))
    .limit(1);
  return { recipe: r, ingredients, steps, tags: tags.map((t) => t.name), dropper };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function deleteRecipe(ownerEmail: string, id: string): Promise<void> {
  const db = await getDb();
  await db
    .delete(recipe)
    .where(and(eq(recipe.id, id), eq(recipe.ownerEmail, ownerEmail)));
}

/** Random recipe id for the "Surprise me" button; null when the library is empty. */
export async function getRandomRecipeId(ownerEmail: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ id: recipe.id })
    .from(recipe)
    .where(eq(recipe.ownerEmail, ownerEmail))
    .orderBy(sql`random()`)
    .limit(1);
  return row?.id ?? null;
}

export interface SaveDropResult {
  id: string;
  alreadySaved: boolean;
}

/**
 * Copy a public recipe (a "drop") into the viewer's own library so they can
 * cook, edit, and plan with it. Credits the original by bumping its dropCount.
 * Saving twice (or saving your own recipe) returns the existing copy instead.
 */
export async function saveDropForOwner(
  ownerEmail: string,
  sourceRecipeId: string,
): Promise<SaveDropResult> {
  const source = await getRecipeFull(sourceRecipeId);
  if (!source || (!source.recipe.isPublic && source.recipe.ownerEmail !== ownerEmail)) {
    throw new Error("Recipe not found.");
  }
  if (source.recipe.ownerEmail === ownerEmail) {
    return { id: source.recipe.id, alreadySaved: true };
  }

  const duplicate = await findDuplicateRecipe({
    ownerEmail,
    sourceUrl: source.recipe.sourceUrl,
    title: source.recipe.title,
  });
  if (duplicate) return { id: duplicate.id, alreadySaved: true };

  const db = await getDb();
  const [created] = await db
    .insert(recipe)
    .values({
      ownerEmail,
      title: source.recipe.title,
      description: source.recipe.description,
      sourceType: source.recipe.sourceType,
      sourceUrl: source.recipe.sourceUrl,
      // Reuse the original's key — it may be short-link-resolved, which a
      // plain recompute from the URL would lose.
      sourceKey: source.recipe.sourceKey ?? sourceKeyFor(source.recipe.sourceUrl),
      savedFromEmail: source.recipe.ownerEmail,
      sourceAuthor: source.recipe.sourceAuthor,
      imagePath: source.recipe.imagePath,
      prepMinutes: source.recipe.prepMinutes,
      cookMinutes: source.recipe.cookMinutes,
      totalMinutes: source.recipe.totalMinutes,
      servingsDefault: source.recipe.servingsDefault,
      mealType: source.recipe.mealType,
      difficulty: source.recipe.difficulty,
    })
    .returning();

  if (source.ingredients.length > 0) {
    await db.insert(recipeIngredient).values(
      source.ingredients.map((ing, i) => ({
        recipeId: created.id,
        rawText: ing.rawText,
        canonicalIngredientId: ing.canonicalIngredientId,
        canonicalName: ing.canonicalName,
        quantity: ing.quantity,
        unit: ing.unit,
        unitCategory: ing.unitCategory,
        note: ing.note,
        optional: ing.optional,
        sortOrder: i,
      })),
    );
  }
  if (source.steps.length > 0) {
    await db.insert(step).values(
      source.steps.map((s) => ({
        recipeId: created.id,
        stepNumber: s.stepNumber,
        instruction: s.instruction,
        durationMinutes: s.durationMinutes,
      })),
    );
  }
  for (const t of source.tags) {
    const tagId = await upsertTag(db, t);
    if (tagId) {
      await db.insert(recipeTag).values({ recipeId: created.id, tagId }).onConflictDoNothing();
    }
  }

  await db
    .update(recipe)
    .set({ dropCount: sql`${recipe.dropCount} + 1` })
    .where(eq(recipe.id, sourceRecipeId));

  return { id: created.id, alreadySaved: false };
}

/** Canonical ingredient names per recipe (capped), for the AI weekly planner. */
export async function listIngredientNames(
  ownerEmail: string,
  recipeIds: string[],
): Promise<Map<string, string[]>> {
  if (recipeIds.length === 0) return new Map();
  const db = await getDb();
  const rows = await db
    .select({ recipeId: recipeIngredient.recipeId, name: recipeIngredient.canonicalName })
    .from(recipeIngredient)
    .innerJoin(recipe, eq(recipe.id, recipeIngredient.recipeId))
    .where(and(eq(recipe.ownerEmail, ownerEmail), inArray(recipeIngredient.recipeId, recipeIds)));
  const map = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.name) continue;
    const list = map.get(row.recipeId) ?? [];
    if (list.length < 10 && !list.includes(row.name)) list.push(row.name);
    map.set(row.recipeId, list);
  }
  return map;
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
