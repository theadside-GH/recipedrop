import "server-only";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { recipe, recipeComment, userProfile } from "@/lib/db/schema";

/**
 * Comments on public dishcoveries. Anyone signed in can comment; the author
 * and the recipe's owner can delete. Reads swallow Postgres 42P01 (migration
 * 0013 not applied yet) and return empty; writes surface a friendly error.
 */

/** What ships to the client — no email addresses, ever. */
export interface CommentView {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string;
  authorHandle: string | null;
  authorAvatar: string | null;
  /** The viewer wrote it (may delete it). */
  mine: boolean;
}

const MAX_COMMENT_LENGTH = 2000;

// Coarse flood guard: plenty for a conversation, a wall for a script.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 5;

function isMissingTable(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "42P01";
}

export async function listRecipeComments(
  recipeId: string,
  viewerEmail: string | null,
): Promise<CommentView[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select({
        id: recipeComment.id,
        body: recipeComment.body,
        createdAt: recipeComment.createdAt,
        authorEmail: recipeComment.authorEmail,
        displayName: userProfile.displayName,
        handle: userProfile.handle,
        avatarUrl: userProfile.avatarUrl,
      })
      .from(recipeComment)
      .leftJoin(userProfile, eq(userProfile.email, recipeComment.authorEmail))
      .where(and(eq(recipeComment.recipeId, recipeId), eq(recipeComment.isHidden, false)))
      .orderBy(asc(recipeComment.createdAt));
    return rows.map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt,
      authorName: row.displayName ?? "A dishcoverer",
      authorHandle: row.handle,
      authorAvatar: row.avatarUrl,
      mine: !!viewerEmail && row.authorEmail === viewerEmail,
    }));
  } catch (err) {
    if (isMissingTable(err)) {
      console.warn("recipe_comment table missing — run `npm run db:migrate` (0013).");
      return [];
    }
    throw err;
  }
}

export async function addRecipeComment(
  authorEmail: string,
  recipeId: string,
  body: string,
): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Write something first.");
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Keep comments under ${MAX_COMMENT_LENGTH} characters.`);
  }
  const db = await getDb();
  const [target] = await db
    .select({ ownerEmail: recipe.ownerEmail, isPublic: recipe.isPublic, isHidden: recipe.isHidden })
    .from(recipe)
    .where(eq(recipe.id, recipeId))
    .limit(1);
  if (!target) throw new Error("Recipe not found.");
  // Comments live on shared dishes: public ones, or your own (pre-publish).
  const canComment = (target.isPublic && !target.isHidden) || target.ownerEmail === authorEmail;
  if (!canComment) throw new Error("Comments are only open on shared recipes.");
  try {
    const since = new Date(Date.now() - RATE_WINDOW_MS);
    const [recent] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(recipeComment)
      .where(and(eq(recipeComment.authorEmail, authorEmail), gte(recipeComment.createdAt, since)));
    if ((recent?.n ?? 0) >= RATE_MAX_PER_WINDOW) {
      throw new Error("You're commenting quickly — give it a minute and try again.");
    }
    await db.insert(recipeComment).values({ recipeId, authorEmail, body: trimmed });
  } catch (err) {
    if (isMissingTable(err)) {
      throw new Error("Comments are being set up — try again in a little while.");
    }
    throw err;
  }
}

/** Author deletes their own comment; the recipe's owner can remove any comment on their dish. */
export async function deleteRecipeComment(
  viewerEmail: string,
  recipeId: string,
  commentId: string,
): Promise<void> {
  const db = await getDb();
  const onThisRecipe = and(eq(recipeComment.id, commentId), eq(recipeComment.recipeId, recipeId));
  const [row] = await db
    .select({ authorEmail: recipeComment.authorEmail, recipeOwner: recipe.ownerEmail })
    .from(recipeComment)
    .innerJoin(recipe, eq(recipe.id, recipeComment.recipeId))
    .where(onThisRecipe)
    .limit(1);
  if (!row) return;
  if (row.authorEmail !== viewerEmail && row.recipeOwner !== viewerEmail) {
    throw new Error("You can only delete your own comments.");
  }
  await db.delete(recipeComment).where(onThisRecipe);
}
