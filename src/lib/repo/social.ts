import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type DB } from "@/lib/db";
import { contentReport, cookedEvent, follow, recipe, userProfile } from "@/lib/db/schema";
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
      .where(
        and(
          eq(recipe.isPublic, true),
          eq(recipe.isHidden, false),
          eq(userProfile.publicFeedOptIn, true),
        ),
      )
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

// ---------------------------------------------------------------------------
// Public cook profiles (/u/[handle]) and content reports
// ---------------------------------------------------------------------------

export interface CookProfile {
  email: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  bio: string | null;
  dropCount: number;
  followerCount: number;
}

/**
 * A cook's public profile by handle — null unless they opted into the public
 * feed (opting out hides the profile page along with their drops).
 */
export async function getCookProfileByHandle(handle: string): Promise<CookProfile | null> {
  const cleaned = handle.trim().toLowerCase();
  if (!cleaned) return null;
  const db = await getDb();
  const [profile] = await db
    .select()
    .from(userProfile)
    .where(and(eq(userProfile.handle, cleaned), eq(userProfile.publicFeedOptIn, true)))
    .limit(1);
  if (!profile?.handle) return null;

  const [drops] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(recipe)
    .where(
      and(
        eq(recipe.ownerEmail, profile.email),
        eq(recipe.isPublic, true),
        eq(recipe.isHidden, false),
      ),
    );
  const followers = await readSafe([{ n: 0 }], async () =>
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(follow)
      .where(eq(follow.followeeEmail, profile.email)),
  );
  return {
    email: profile.email,
    displayName: profile.displayName,
    handle: profile.handle,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    dropCount: drops?.n ?? 0,
    followerCount: followers[0]?.n ?? 0,
  };
}

/** Follow/unfollow a cook by handle (profile pages). */
export async function setFollowByHandle(
  viewerEmail: string,
  handle: string,
  following: boolean,
): Promise<{ following: boolean }> {
  const profile = await getCookProfileByHandle(handle);
  if (!profile) throw new Error("Cook not found.");
  if (profile.email === viewerEmail) return { following: false };
  const db = await getDb();
  try {
    if (following) {
      await db
        .insert(follow)
        .values({ followerEmail: viewerEmail, followeeEmail: profile.email })
        .onConflictDoNothing();
    } else {
      await db
        .delete(follow)
        .where(and(eq(follow.followerEmail, viewerEmail), eq(follow.followeeEmail, profile.email)));
    }
  } catch (err) {
    if (isMissingTable(err)) throw migrationPendingError();
    throw err;
  }
  return { following };
}

export async function isFollowingHandle(viewerEmail: string, handle: string): Promise<boolean> {
  return readSafe(false, async () => {
    const profile = await getCookProfileByHandle(handle);
    if (!profile || profile.email === viewerEmail) return false;
    const db = await getDb();
    const [row] = await db
      .select({ one: sql`1` })
      .from(follow)
      .where(and(eq(follow.followerEmail, viewerEmail), eq(follow.followeeEmail, profile.email)))
      .limit(1);
    return !!row;
  });
}

/**
 * Flag a public drop for the operator to review. Rows are read straight from
 * the content_report table for now — no admin UI.
 */
export async function reportDrop(
  reporterEmail: string,
  recipeId: string,
  reason: string | null,
): Promise<void> {
  const db = await getDb();
  const owner = await publicRecipeOwner(db, recipeId);
  if (!owner) throw new Error("Recipe not found.");
  try {
    await db.insert(contentReport).values({
      recipeId,
      reporterEmail,
      reason: reason?.trim().slice(0, 500) || null,
    });
  } catch (err) {
    if (isMissingTable(err)) throw migrationPendingError();
    throw err;
  }
}
