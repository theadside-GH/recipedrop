import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { recipe, recipeNote, type RecipeNote } from "@/lib/db/schema";

/**
 * The owner's private recipe journal: freeform notes ("used thighs, double
 * the chipotle") and dated "cooked it" entries. Reads swallow Postgres 42P01
 * (migration 0008 not applied yet) and return empty; writes surface a
 * friendly error instead.
 */

export type RecipeNoteKind = "note" | "cooked";

function isMissingTable(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "42P01";
}

export async function listRecipeNotes(
  ownerEmail: string,
  recipeId: string,
): Promise<RecipeNote[]> {
  try {
    const db = await getDb();
    return await db
      .select()
      .from(recipeNote)
      .where(and(eq(recipeNote.recipeId, recipeId), eq(recipeNote.ownerEmail, ownerEmail)))
      .orderBy(desc(recipeNote.createdAt));
  } catch (err) {
    if (isMissingTable(err)) {
      console.warn("recipe_note table missing — run `npm run db:migrate` (0008).");
      return [];
    }
    throw err;
  }
}

export async function addRecipeNote(
  ownerEmail: string,
  recipeId: string,
  kind: RecipeNoteKind,
  body: string | null,
): Promise<void> {
  const db = await getDb();
  const [owned] = await db
    .select({ id: recipe.id })
    .from(recipe)
    .where(and(eq(recipe.id, recipeId), eq(recipe.ownerEmail, ownerEmail)))
    .limit(1);
  if (!owned) throw new Error("Recipe not found.");
  const trimmed = body?.trim() || null;
  if (kind === "note" && !trimmed) throw new Error("Write something first.");
  try {
    await db.insert(recipeNote).values({ recipeId, ownerEmail, kind, body: trimmed });
  } catch (err) {
    if (isMissingTable(err)) {
      throw new Error("Notes are being set up — try again in a little while.");
    }
    throw err;
  }
}

/**
 * Cooked-log counts per recipe for the owner's own cards — powers the
 * "I made it" toggle state on library thumbnails.
 */
export async function cookedCountsForOwner(
  ownerEmail: string,
  recipeIds: string[],
): Promise<Map<string, number>> {
  if (recipeIds.length === 0) return new Map();
  try {
    const db = await getDb();
    const rows = await db
      .select({ recipeId: recipeNote.recipeId, n: sql<number>`count(*)::int` })
      .from(recipeNote)
      .where(
        and(
          eq(recipeNote.ownerEmail, ownerEmail),
          eq(recipeNote.kind, "cooked"),
          inArray(recipeNote.recipeId, recipeIds),
        ),
      )
      .groupBy(recipeNote.recipeId);
    return new Map(rows.map((r) => [r.recipeId, r.n]));
  } catch (err) {
    if (isMissingTable(err)) {
      console.warn("recipe_note table missing — run `npm run db:migrate` (0008).");
      return new Map();
    }
    throw err;
  }
}

/**
 * Undo for a mis-tapped "I made it": remove only the newest cooked entry,
 * leaving older cooks (and their notes) intact.
 */
export async function removeLatestCooked(ownerEmail: string, recipeId: string): Promise<void> {
  const db = await getDb();
  const [latest] = await db
    .select({ id: recipeNote.id })
    .from(recipeNote)
    .where(
      and(
        eq(recipeNote.recipeId, recipeId),
        eq(recipeNote.ownerEmail, ownerEmail),
        eq(recipeNote.kind, "cooked"),
      ),
    )
    .orderBy(desc(recipeNote.createdAt))
    .limit(1);
  if (!latest) return;
  await db.delete(recipeNote).where(eq(recipeNote.id, latest.id));
}

export async function deleteRecipeNote(ownerEmail: string, noteId: string): Promise<void> {
  const db = await getDb();
  await db
    .delete(recipeNote)
    .where(and(eq(recipeNote.id, noteId), eq(recipeNote.ownerEmail, ownerEmail)));
}
