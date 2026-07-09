import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type DB } from "@/lib/db";
import { collection, collectionRecipe, recipe, userProfile } from "@/lib/db/schema";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function collectionIsOwned(db: DB, id: string, ownerEmail: string): Promise<boolean> {
  const [row] = await db
    .select({ id: collection.id })
    .from(collection)
    .where(and(eq(collection.id, id), eq(collection.ownerEmail, ownerEmail)))
    .limit(1);
  return !!row;
}

export async function createCollection(
  ownerEmail: string,
  name: string,
  description?: string | null,
) {
  const db = await getDb();
  const [row] = await db
    .insert(collection)
    .values({
      ownerEmail,
      name: name.trim() || "New collection",
      description: description?.trim() || null,
    })
    .returning();
  return row;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  recipeCount: number;
  /** Up to 4 recipe images for the cover mosaic. */
  coverImages: (string | null)[];
}

export async function listCollections(ownerEmail: string): Promise<CollectionSummary[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      isPublic: collection.isPublic,
      recipeCount: sql<number>`count(${collectionRecipe.recipeId})::int`,
    })
    .from(collection)
    .leftJoin(collectionRecipe, eq(collectionRecipe.collectionId, collection.id))
    .where(eq(collection.ownerEmail, ownerEmail))
    .groupBy(collection.id)
    .orderBy(desc(collection.createdAt));
  if (rows.length === 0) return [];

  const covers = await db
    .select({
      collectionId: collectionRecipe.collectionId,
      imagePath: recipe.imagePath,
      sortOrder: collectionRecipe.sortOrder,
    })
    .from(collectionRecipe)
    .innerJoin(recipe, eq(recipe.id, collectionRecipe.recipeId))
    .where(
      inArray(
        collectionRecipe.collectionId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(collectionRecipe.sortOrder));

  const byCollection = new Map<string, (string | null)[]>();
  for (const c of covers) {
    const list = byCollection.get(c.collectionId) ?? [];
    if (list.length < 4) list.push(c.imagePath);
    byCollection.set(c.collectionId, list);
  }
  return rows.map((r) => ({ ...r, coverImages: byCollection.get(r.id) ?? [] }));
}

/**
 * Collection + its recipes + the owner's public profile. Unscoped like
 * getRecipeFull — callers must check ownership or isPublic before rendering.
 */
export async function getCollectionFull(id: string) {
  if (!isUuid(id)) return null;
  const db = await getDb();
  const [c] = await db.select().from(collection).where(eq(collection.id, id)).limit(1);
  if (!c) return null;
  const recipes = await db
    .select({ recipe })
    .from(collectionRecipe)
    .innerJoin(recipe, eq(recipe.id, collectionRecipe.recipeId))
    .where(eq(collectionRecipe.collectionId, id))
    .orderBy(asc(collectionRecipe.sortOrder));
  const [owner] = await db
    .select({
      displayName: userProfile.displayName,
      handle: userProfile.handle,
      avatarUrl: userProfile.avatarUrl,
    })
    .from(userProfile)
    .where(eq(userProfile.email, c.ownerEmail))
    .limit(1);
  return { collection: c, recipes: recipes.map((r) => r.recipe), owner };
}

/** Add one of the owner's own recipes to one of their collections. */
export async function addRecipeToCollection(
  ownerEmail: string,
  collectionId: string,
  recipeId: string,
): Promise<void> {
  const db = await getDb();
  if (!(await collectionIsOwned(db, collectionId, ownerEmail))) {
    throw new Error("Collection not found.");
  }
  const [r] = await db
    .select({ id: recipe.id })
    .from(recipe)
    .where(and(eq(recipe.id, recipeId), eq(recipe.ownerEmail, ownerEmail)))
    .limit(1);
  if (!r) throw new Error("Recipe not found.");
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(collectionRecipe)
    .where(eq(collectionRecipe.collectionId, collectionId));
  await db
    .insert(collectionRecipe)
    .values({ collectionId, recipeId, sortOrder: n })
    .onConflictDoNothing();
}

export async function removeRecipeFromCollection(
  ownerEmail: string,
  collectionId: string,
  recipeId: string,
): Promise<void> {
  const db = await getDb();
  if (!(await collectionIsOwned(db, collectionId, ownerEmail))) {
    throw new Error("Collection not found.");
  }
  await db
    .delete(collectionRecipe)
    .where(
      and(
        eq(collectionRecipe.collectionId, collectionId),
        eq(collectionRecipe.recipeId, recipeId),
      ),
    );
}

export async function setCollectionPublic(
  ownerEmail: string,
  id: string,
  isPublic: boolean,
): Promise<void> {
  const db = await getDb();
  const [updated] = await db
    .update(collection)
    .set({ isPublic })
    .where(and(eq(collection.id, id), eq(collection.ownerEmail, ownerEmail)))
    .returning({ id: collection.id });
  if (!updated) throw new Error("Collection not found.");
}

export async function renameCollection(
  ownerEmail: string,
  id: string,
  name: string,
): Promise<void> {
  const db = await getDb();
  await db
    .update(collection)
    .set({ name: name.trim() || "Untitled collection" })
    .where(and(eq(collection.id, id), eq(collection.ownerEmail, ownerEmail)));
}

export async function deleteCollection(ownerEmail: string, id: string): Promise<void> {
  const db = await getDb();
  await db
    .delete(collection)
    .where(and(eq(collection.id, id), eq(collection.ownerEmail, ownerEmail)));
}

/** Ids of the owner's collections that already contain the recipe (for the picker). */
export async function listCollectionIdsForRecipe(
  ownerEmail: string,
  recipeId: string,
): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: collectionRecipe.collectionId })
    .from(collectionRecipe)
    .innerJoin(collection, eq(collection.id, collectionRecipe.collectionId))
    .where(and(eq(collectionRecipe.recipeId, recipeId), eq(collection.ownerEmail, ownerEmail)));
  return rows.map((r) => r.id);
}
