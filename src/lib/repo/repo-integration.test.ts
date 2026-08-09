/**
 * Integration tests over the real repo layer against an in-memory PGlite —
 * the risk lives here (owner scoping, quota, job claims), not in the pure
 * lib code the unit tests cover.
 *
 * Env is pinned before any app import: the db module memoizes its driver
 * choice off DATABASE_URL/PGLITE_DIR at first touch.
 */
process.env.DATABASE_URL = "";
process.env.PGLITE_DIR = "memory://";
process.env.VERCEL = "";

import { beforeAll, describe, expect, it } from "vitest";

const OWNER = "owner@test.local";
const STRANGER = "stranger@test.local";

async function repos() {
  return {
    recipes: await import("./recipes"),
    imports: await import("./imports"),
    entitlements: await import("@/lib/entitlements"),
  };
}

async function createRecipeFor(email: string, title: string) {
  const { recipes } = await repos();
  return recipes.createRecipeManual(email, {
    title,
    description: null,
    sourceUrl: null,
    sourceAuthor: null,
    imagePath: null,
    prepMinutes: 5,
    cookMinutes: 10,
    totalMinutes: 15,
    servingsDefault: 2,
    mealType: "dinner",
    difficulty: null,
    tags: ["test"],
    ingredients: ["1 cup rice", "2 chicken breasts"],
    steps: ["Cook the rice.", "Cook the chicken."],
  });
}

beforeAll(async () => {
  // First getDb() call runs migrations against the in-memory database.
  const { getDb } = await import("@/lib/db");
  await getDb();
}, 120_000);

describe("owner scoping", () => {
  it("keeps one owner's recipes out of another's library and reach", async () => {
    const { recipes } = await repos();
    const id = await createRecipeFor(OWNER, "Owner Scoping Dish");

    const ownRows = await recipes.listRecipes(OWNER);
    expect(ownRows.some((r) => r.id === id)).toBe(true);
    const strangerRows = await recipes.listRecipes(STRANGER);
    expect(strangerRows.some((r) => r.id === id)).toBe(false);

    // Writes against someone else's row must not stick.
    await recipes.setRecipeFavorite(STRANGER, id, true);
    await recipes.setRecipeRating(STRANGER, id, 5);
    await recipes.deleteRecipe(STRANGER, id);
    const full = await recipes.getRecipeFull(id);
    expect(full).not.toBeNull();
    expect(full!.recipe.isFavorite).toBe(false);
    expect(full!.recipe.rating).toBeNull();

    await expect(
      recipes.updateRecipe({
        ownerEmail: STRANGER,
        id,
        title: "Hijacked",
        description: null,
        sourceUrl: null,
        sourceAuthor: null,
        imagePath: null,
        prepMinutes: null,
        cookMinutes: null,
        totalMinutes: null,
        servingsDefault: 2,
        mealType: "dinner",
        difficulty: null,
        tags: [],
        ingredients: ["1 cup sabotage"],
        steps: ["Ruin it."],
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("scopes ratings to the owner and clamps them to 1–5", async () => {
    const { recipes } = await repos();
    const id = await createRecipeFor(OWNER, "Rating Clamp Dish");
    await recipes.setRecipeRating(OWNER, id, 9);
    expect((await recipes.getRecipeFull(id))!.recipe.rating).toBe(5);
    await recipes.setRecipeRating(OWNER, id, null);
    expect((await recipes.getRecipeFull(id))!.recipe.rating).toBeNull();
  });
});

describe("AI quota", () => {
  it("enforces the free-tier cap exactly at the boundary", async () => {
    const { entitlements } = await repos();
    const user = "quota@test.local";
    const limit = entitlements.TIERS.free.aiUses;
    for (let i = 0; i < limit; i++) {
      await entitlements.recordAiUse(user, "import");
    }
    await expect(entitlements.recordAiUse(user, "import")).rejects.toThrow(
      entitlements.QuotaExceededError,
    );
  });
});

describe("import job claims", () => {
  it("lets exactly one runner claim a job; stale claims are recoverable", async () => {
    const { imports } = await repos();
    const job = await imports.createSingleJob(OWNER, "text", "some pasted recipe text");

    const first = await imports.claimJob(OWNER, job.id);
    expect(first?.status).toBe("processing");

    // Second claim while fresh must lose.
    expect(await imports.claimJob(OWNER, job.id)).toBeNull();

    // Another user can never claim it.
    expect(await imports.claimJob(STRANGER, job.id)).toBeNull();

    // A crashed run (stale updatedAt) is safe to take over. Backdate straight
    // in the DB — updateJob always stamps updatedAt with "now".
    const db = await (await import("@/lib/db")).getDb();
    const { importJob } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await db
      .update(importJob)
      .set({ updatedAt: new Date(Date.now() - imports.STALE_PROCESSING_MS - 1000) })
      .where(eq(importJob.id, job.id));
    const takeover = await imports.claimJob(OWNER, job.id);
    expect(takeover?.status).toBe("processing");

    // Done jobs are never reclaimed.
    await imports.updateJob(OWNER, job.id, { status: "done" });
    expect(await imports.claimJob(OWNER, job.id)).toBeNull();
  });
});

describe("save/unsave drop invariants", () => {
  it("copies a public drop into the saver's library and returns credit on unsave", async () => {
    const { recipes } = await repos();
    const db = await (await import("@/lib/db")).getDb();
    const { recipe, userProfile } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const dropId = await createRecipeFor(OWNER, "Public Drop Dish");
    await db.insert(userProfile).values({
      email: OWNER,
      displayName: "Owner",
      publicFeedOptIn: true,
    }).onConflictDoNothing();
    await recipes.setRecipePublic({ ownerEmail: OWNER, id: dropId, isPublic: true });

    const saved = await recipes.saveDropForOwner(STRANGER, dropId);
    expect(saved.alreadySaved).toBe(false);
    const copy = await recipes.getRecipeFull(saved.id);
    expect(copy!.recipe.ownerEmail).toBe(STRANGER);
    expect(copy!.recipe.savedFromEmail).toBe(OWNER);
    expect(copy!.ingredients.length).toBeGreaterThan(0);
    expect(copy!.steps.length).toBeGreaterThan(0);

    const [afterSave] = await db.select().from(recipe).where(eq(recipe.id, dropId));
    expect(afterSave.dropCount).toBe(2);

    // Saving again dedupes to the existing copy.
    const again = await recipes.saveDropForOwner(STRANGER, dropId);
    expect(again.alreadySaved).toBe(true);
    expect(again.id).toBe(saved.id);

    await recipes.unsaveDropForOwner(STRANGER, dropId);
    expect(await recipes.getRecipeFull(saved.id)).toBeNull();
    const [afterUnsave] = await db.select().from(recipe).where(eq(recipe.id, dropId));
    expect(afterUnsave.dropCount).toBe(1);
  });
});
