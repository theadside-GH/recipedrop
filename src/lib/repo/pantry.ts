import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pantryItem, recipe, recipeIngredient } from "@/lib/db/schema";

export interface PantryToggleInput {
  ownerEmail: string;
  canonicalName: string;
  aisle: string | null;
  checked: boolean;
}

export async function listPantryItems(ownerEmail: string) {
  const db = await getDb();
  return db
    .select()
    .from(pantryItem)
    .where(eq(pantryItem.ownerEmail, ownerEmail))
    .orderBy(desc(pantryItem.hasLeftover), pantryItem.canonicalName);
}

export async function setPantryItem(input: PantryToggleInput): Promise<void> {
  await upsertPantryFlag(input, "inPantry");
}

export async function setLeftoverItem(input: PantryToggleInput): Promise<void> {
  await upsertPantryFlag(input, "hasLeftover");
}

async function upsertPantryFlag(
  input: PantryToggleInput,
  flag: "inPantry" | "hasLeftover",
): Promise<void> {
  const db = await getDb();
  const name = cleanName(input.canonicalName);
  if (!name) return;
  const existing = await db
    .select()
    .from(pantryItem)
    .where(and(eq(pantryItem.ownerEmail, input.ownerEmail), eq(pantryItem.canonicalName, name)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(pantryItem)
      .set({
        [flag]: input.checked,
        aisle: input.aisle ?? existing[0].aisle,
        updatedAt: new Date(),
      })
      .where(eq(pantryItem.id, existing[0].id));
    return;
  }

  await db.insert(pantryItem).values({
    ownerEmail: input.ownerEmail,
    canonicalName: name,
    aisle: input.aisle,
    inPantry: flag === "inPantry" ? input.checked : false,
    hasLeftover: flag === "hasLeftover" ? input.checked : false,
  });
}

export interface PantryRecipeSuggestion {
  recipe: typeof recipe.$inferSelect;
  matchCount: number;
  totalCount: number;
  matchedNames: string[];
  missingNames: string[];
}

export async function listPantryRecipeSuggestions(
  ownerEmail: string,
  limit = 12,
): Promise<PantryRecipeSuggestion[]> {
  const db = await getDb();
  const pantry = await listPantryItems(ownerEmail);
  const available = pantry
    .filter((item) => item.inPantry || item.hasLeftover)
    .map((item) => item.canonicalName);
  if (available.length === 0) return [];

  const recipes = await db
    .select()
    .from(recipe)
    .where(eq(recipe.ownerEmail, ownerEmail))
    .orderBy(desc(recipe.createdAt))
    .limit(80);
  if (recipes.length === 0) return [];

  const ingredients = await db
    .select({
      recipeId: recipeIngredient.recipeId,
      canonicalName: recipeIngredient.canonicalName,
      rawText: recipeIngredient.rawText,
    })
    .from(recipeIngredient)
    .where(
      inArray(
        recipeIngredient.recipeId,
        recipes.map((item) => item.id),
      ),
    );

  const availableSet = new Set(available.map(cleanName).filter(Boolean));
  const byRecipe = new Map<string, Set<string>>();
  for (const ingredient of ingredients) {
    const name = cleanName(ingredient.canonicalName ?? ingredient.rawText);
    if (!name) continue;
    if (!byRecipe.has(ingredient.recipeId)) byRecipe.set(ingredient.recipeId, new Set());
    byRecipe.get(ingredient.recipeId)!.add(name);
  }

  return recipes
    .map((r) => {
      const names = [...(byRecipe.get(r.id) ?? new Set<string>())];
      const matchedNames = names.filter((name) => availableSet.has(name));
      const missingNames = names.filter((name) => !availableSet.has(name));
      return {
        recipe: r,
        matchCount: matchedNames.length,
        totalCount: names.length,
        matchedNames,
        missingNames,
      };
    })
    .filter((item) => item.matchCount > 0 && item.totalCount > 0)
    .sort((a, b) => {
      const aScore = a.matchCount / a.totalCount;
      const bScore = b.matchCount / b.totalCount;
      return bScore - aScore || a.missingNames.length - b.missingNames.length;
    })
    .slice(0, limit);
}

export async function pantryCounts(ownerEmail: string) {
  const db = await getDb();
  const [row] = await db
    .select({
      pantry: sql<number>`count(*) filter (where ${pantryItem.inPantry})::int`,
      leftovers: sql<number>`count(*) filter (where ${pantryItem.hasLeftover})::int`,
    })
    .from(pantryItem)
    .where(eq(pantryItem.ownerEmail, ownerEmail));
  return { pantry: row?.pantry ?? 0, leftovers: row?.leftovers ?? 0 };
}

function cleanName(value: string | null | undefined) {
  return value?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
}
