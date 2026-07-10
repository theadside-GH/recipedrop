import "server-only";
import { and, desc, eq } from "drizzle-orm";
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

export async function deleteRecipeNote(ownerEmail: string, noteId: string): Promise<void> {
  const db = await getDb();
  await db
    .delete(recipeNote)
    .where(and(eq(recipeNote.id, noteId), eq(recipeNote.ownerEmail, ownerEmail)));
}
