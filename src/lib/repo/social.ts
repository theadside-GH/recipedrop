import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type DB } from "@/lib/db";
import { cookedEvent, follow, recipe, userProfile } from "@/lib/db/schema";
import { attachDropperCounts, type PublicRecipeRow } from "@/lib/repo/recipes";

/**
 * Follows and "I made this" events. All actions are keyed by recipeId — owner
 * emails are resolved server-side and never handed to client components.
 *
 * Reads swallow Postgres 42P01 (tables missing because migration 0007 hasn't
 * run yet) and return empty defaults so public pages keep rendering; writes
 * surface a friendly error instead.
 */

function isMissingTable(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "42P01";
}

async function readSafe<T>(fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isMissingTable(err)) {
      console.warn("Social tables missing — run `npm run db:migrate` (0007).");
      return fallback;
    }
    throw err;
  }
}

function migrationPendingError(): Error {
  return new Error("This feature is being set up — try again in a little while.");
}

/** The owner of a recipe, only if that recipe is public. */
async function publicRecipeOwner(db: DB, recipeId: string): Promise<string | null> {
  const [row] = await db
    .select({ ownerEmail: recipe.ownerEmail, isPublic: recipe.isPublic })
    .from(recipe)
    .where(eq(recipe.id, recipeId))
    .limit(1);
  if (!row || !row.isPublic) return null;
  return row.ownerEmail;
}

export async function setFollowByRecipe(
  viewerEmail: string,
  recipeId: string,
  following: boolean,
): Promise<{ following: boolean }> {
  const db = await getDb();
  const owner = await publicRecipeOwner(db, recipeId);
  if (!owner) throw new Error("Recipe not found.");
  if (owner === viewerEmail) return { following: false };
  try {
    if (following) {
      await db
        .insert(follow)
        .values({ followerEmail: viewerEmail, followeeEmail: owner })
        .onConflictDoNothing();
    } else {
      await db
        .delete(follow)
        .where(and(eq(follow.followerEmail, viewerEmail), eq(follow.followeeEmail, owner)));
    }
  } catch (err) {
    if (isMissingTable(err)) throw migrationPendingError();
    throw err;
  }
  return { following };
}

export async function isFollowingOwnerOfRecipe(
  viewerEmail: string,
  recipeId: string,
): Promise<boolean> {
  return readSafe(false, async () => {
    const db = await getDb();
    const owner = await publicRecipeOwner(db, recipeId);
    if (!owner || owner === viewerEmail) return false;
    const [row] = await db
      .select({ followerEmail: follow.followerEmail })
      .from(follow)
      .where(and(eq(follow.followerEmail, viewerEmail), eq(follow.followeeEmail, owner)))
      .limit(1);
    return !!row;
  });
}

export interface CookedState {
  cookedCount: number;
  viewerCooked: boolean;
}

export async function getCookedState(
  viewerEmail: string,
  recipeId: string,
): Promise<CookedState> {
  return readSafe({ cookedCount: 0, viewerCooked: false }, async () => {
    const db = await getDb();
    const [counts] = await db
      .select({
        cookedCount: sql<number>`count(*)::int`,
        viewerCooked: sql<boolean>`bool_or(${cookedEvent.cookerEmail} = ${viewerEmail})`,
      })
      .from(cookedEvent)
      .where(eq(cookedEvent.recipeId, recipeId));
    return {
      cookedCount: counts?.cookedCount ?? 0,
      viewerCooked: counts?.viewerCooked ?? false,
    };
  });
}

/** "I made this": one per user per recipe; making your own recipe doesn't count. */
export async function markCookedByRecipe(
  viewerEmail: string,
  recipeId: string,
): Promise<CookedState> {
  const db = await getDb();
  const owner = await publicRecipeOwner(db, recipeId);
  if (!owner) throw new Error("Recipe not found.");
  if (owner !== viewerEmail) {
    try {
      await db
        .insert(cookedEvent)
        .values({ recipeId, cookerEmail: viewerEmail })
        .onConflictDoNothing();
    } catch (err) {
      if (isMissingTable(err)) throw migrationPendingError();
      throw err;
    }
  }
  return getCookedState(viewerEmail, recipeId);
}

/** Newest public recipes from cooks the viewer follows, for the Discover rail. */
export async function listFollowedRecipes(
  viewerEmail: string,
  limit = 8,
): Promise<PublicRecipeRow[]> {
  return readSafe([], async () => {
    const db = await getDb();
    const rows = await db
      .select({
        recipe,
        displayName: userProfile.displayName,
        handle: userProfile.handle,
        avatarUrl: userProfile.avatarUrl,
      })
      .from(recipe)
      .innerJoin(follow, and(
        eq(follow.followeeEmail, recipe.ownerEmail),
        eq(follow.followerEmail, viewerEmail),
      ))
      .innerJoin(userProfile, eq(userProfile.email, recipe.ownerEmail))
      .where(and(eq(recipe.isPublic, true), eq(userProfile.publicFeedOptIn, true)))
      .orderBy(desc(recipe.createdAt))
      // Overfetch so hiding same-link re-drops below can still fill the row.
      .limit(limit * 2);
    // If several cooks you follow dropped the same link, show it once.
    const seenKeys = new Set<string>();
    const deduped = rows.filter((row) => {
      const key = row.recipe.sourceKey;
      if (!key) return true;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
    return attachDropperCounts(deduped.slice(0, limit));
  });
}

/** Cooked counts for a set of recipe ids (for cards); empty map pre-migration. */
export async function cookedCountsFor(recipeIds: string[]): Promise<Map<string, number>> {
  if (recipeIds.length === 0) return new Map();
  return readSafe(new Map<string, number>(), async () => {
    const db = await getDb();
    const rows = await db
      .select({
        recipeId: cookedEvent.recipeId,
        n: sql<number>`count(*)::int`,
      })
      .from(cookedEvent)
      .where(inArray(cookedEvent.recipeId, recipeIds))
      .groupBy(cookedEvent.recipeId);
    return new Map(rows.map((r) => [r.recipeId, r.n]));
  });
}
