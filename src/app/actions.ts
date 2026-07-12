"use server";

import { revalidatePath } from "next/cache";
import { getOwnerEmail } from "@/lib/auth";
import { features } from "@/lib/env";
import {
  createSingleJob,
  createBulkJobs,
  updateJob,
  clearImportHistory,
  type ImportJobRow,
} from "@/lib/repo/imports";
import { detectSourceType } from "@/lib/sources/detect";
import {
  createRecipeManual,
  deleteRecipe,
  earlierPublicSharer,
  getKnownCanonicalNames,
  isKnownIngredientName,
  listIngredientNames,
  listRecipes,
  saveDropForOwner,
  setRecipeFavorite,
  setRecipeImage,
  setRecipePublic,
  unsaveDropForOwner,
  updateRecipe,
  type RecipeEditInput,
} from "@/lib/repo/recipes";
import { updateProfile, type ProfileInput } from "@/lib/repo/profiles";
import { persistImage } from "@/lib/storage";
import { randomUUID } from "node:crypto";
import {
  createPlan,
  addRecipeToPlan,
  addCustomShoppingItem,
  removeCustomShoppingItem,
  setPlannedServings,
  removePlanItem,
  deletePlan,
  generateShoppingList,
  toggleShoppingItem,
} from "@/lib/repo/plans";
import { setLeftoverItem, setPantryItem, listPantryItems } from "@/lib/repo/pantry";
import {
  addRecipeToCollection,
  createCollection,
  deleteCollection,
  removeRecipeFromCollection,
  renameCollection,
  setCollectionPublic,
} from "@/lib/repo/collections";
import {
  markCookedByRecipe,
  reportDrop,
  setFollowByHandle,
  setFollowByRecipe,
  type CookedState,
} from "@/lib/repo/social";
import {
  addRecipeNote,
  deleteRecipeNote,
  removeLatestCooked,
  type RecipeNoteKind,
} from "@/lib/repo/notes";
import {
  assertCanCreateCollection,
  assertCanCreatePlan,
  assertCanPublishCollection,
  recordAiUse,
} from "@/lib/entitlements";
import type { ImageInput } from "@/lib/ai/extract";

// ---- Imports --------------------------------------------------------------

export interface JobView {
  id: string;
  label: string | null;
  rawInput: string | null;
  sourceType: ImportJobRow["sourceType"];
  status: ImportJobRow["status"];
  error: string | null;
  recipeId: string | null;
}

function toView(j: ImportJobRow): JobView {
  return {
    id: j.id,
    label: j.label,
    rawInput: j.rawInput,
    sourceType: j.sourceType,
    status: j.status,
    error: j.error,
    recipeId: j.recipeId,
  };
}

function failedJob(label: string, error: string, sourceType: ImportJobRow["sourceType"] = "text"): JobView {
  return {
    // "local-" ids never reached the database — the UI hides Retry for them,
    // since there is no job row to re-run.
    id: `local-${randomUUID()}`,
    label,
    rawInput: label,
    sourceType,
    status: "failed",
    error,
    recipeId: null,
  };
}

/** Create import job(s) from a single link/text or a bulk paste, return them pending. */
export async function startImport(input: {
  mode: "single" | "bulk";
  value: string;
}): Promise<{ jobs: JobView[]; aiEnabled: boolean }> {
  try {
    const owner = await getOwnerEmail();
    if (input.mode === "bulk") {
      const { jobs } = await createBulkJobs(owner, input.value);
      return { jobs: jobs.map(toView), aiEnabled: features.aiEnabled };
    }
    const type = detectSourceType(input.value);
    const job = await createSingleJob(owner, type, input.value);
    return { jobs: [toView(job)], aiEnabled: features.aiEnabled };
  } catch (error) {
    console.error("Import start failed", error);
    return {
      jobs: [
        failedJob(
          input.value.trim().slice(0, 80) || "Import",
          "Import could not start. Check that the database is reachable, then try again.",
        ),
      ],
      aiEnabled: features.aiEnabled,
    };
  }
}

/** Run a single pending import job to completion and return its final state. */
export async function runImportJob(jobId: string): Promise<JobView | null> {
  const owner = await getOwnerEmail();
  try {
    const { processJob } = await import("@/lib/import/process");
    const job = await processJob(owner, jobId);
    if (job?.status === "done") revalidatePath("/recipes");
    return job ? toView(job) : null;
  } catch (error) {
    console.error("Import job failed", error);
    const message = error instanceof Error ? error.message : "Import failed while processing.";
    const failed = await updateJob(owner, jobId, { status: "failed", error: message });
    return failed ? toView(failed) : failedJob("Import failed", "Import failed while processing. Try again.");
  }
}

export async function clearImportHistoryAction(): Promise<void> {
  const owner = await getOwnerEmail();
  await clearImportHistory(owner);
  revalidatePath("/import");
}

/** Import one or more recipe photos directly (vision). Returns the new recipe id. */
export async function importPhotos(images: ImageInput[]): Promise<{ recipeId: string }> {
  const owner = await getOwnerEmail();
  const { processPhotoImport } = await import("@/lib/import/process");
  const recipeId = await processPhotoImport(owner, images);
  revalidatePath("/recipes");
  return { recipeId };
}

// ---- Recipes --------------------------------------------------------------

export async function deleteRecipeAction(id: string): Promise<void> {
  const owner = await getOwnerEmail();
  await deleteRecipe(owner, id);
  revalidatePath("/recipes");
}

export async function setFavoriteAction(id: string, isFavorite: boolean): Promise<void> {
  const owner = await getOwnerEmail();
  await setRecipeFavorite(owner, id, isFavorite);
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
}

/** Save a public drop into the viewer's own library so they can make it. */
export async function saveDropAction(
  recipeId: string,
): Promise<{ id: string; alreadySaved: boolean }> {
  const owner = await getOwnerEmail();
  const result = await saveDropForOwner(owner, recipeId);
  revalidatePath("/recipes");
  revalidatePath("/discover");
  return result;
}

/** Undo a save: remove the viewer's copy of a public drop from their library. */
export async function unsaveDropAction(recipeId: string): Promise<void> {
  const owner = await getOwnerEmail();
  await unsaveDropForOwner(owner, recipeId);
  revalidatePath("/recipes");
  revalidatePath("/discover");
}

export async function setRecipePublicAction(
  id: string,
  isPublic: boolean,
): Promise<{ notice: string | null }> {
  const owner = await getOwnerEmail();
  await setRecipePublic({ ownerEmail: owner, id, isPublic });
  revalidatePath("/recipes");
  revalidatePath("/discover");
  revalidatePath(`/r/${id}`);
  if (!isPublic) return { notice: null };
  const earlier = await earlierPublicSharer(owner, id);
  if (!earlier) return { notice: null };
  const who = earlier.handle ? `@${earlier.handle}` : earlier.displayName;
  return {
    notice:
      `It's public — but ${who} shared this same link first, so theirs is the one that ` +
      "shows in Discover. Yours still works via your profile and its direct link.",
  };
}

export async function setRecipeImageAction(id: string, imagePath: string): Promise<void> {
  const owner = await getOwnerEmail();
  // Uploaded photos arrive as data: URLs — host them instead of embedding.
  const hosted = (await persistImage(imagePath)) ?? imagePath;
  await setRecipeImage({ ownerEmail: owner, id, imagePath: hosted });
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
  revalidatePath(`/recipes/${id}/edit`);
}

export async function updateProfileAction(input: ProfileInput): Promise<void> {
  const owner = await getOwnerEmail();
  await updateProfile(owner, { ...input, avatarUrl: await persistImage(input.avatarUrl) });
  revalidatePath("/recipes");
  revalidatePath("/discover");
  revalidatePath("/profile");
}

/** Create a recipe the user typed in by hand. */
export async function createRecipeAction(
  input: Omit<RecipeEditInput, "id" | "ownerEmail">,
): Promise<{ id: string }> {
  const owner = await getOwnerEmail();
  const id = await createRecipeManual(owner, {
    ...input,
    imagePath: await persistImage(input.imagePath),
  });
  revalidatePath("/recipes");
  return { id };
}

export async function updateRecipeAction(
  id: string,
  input: Omit<RecipeEditInput, "id" | "ownerEmail">,
): Promise<void> {
  const owner = await getOwnerEmail();
  await updateRecipe({
    ...input,
    imagePath: await persistImage(input.imagePath),
    id,
    ownerEmail: owner,
  });
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
  revalidatePath(`/recipes/${id}/edit`);
  revalidatePath("/plans");
}

export async function repairRecipeAction(id: string): Promise<{ ok: boolean; message: string }> {
  try {
    const owner = await getOwnerEmail();
    const { repairRecipeFromSource } = await import("@/lib/import/repair");
    const result = await repairRecipeFromSource(owner, id);
    revalidatePath("/recipes");
    revalidatePath(`/recipes/${id}`);
    revalidatePath(`/recipes/${id}/edit`);
    revalidatePath("/plans");
    return { ok: true, message: result.message };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Recipe repair failed.",
    };
  }
}

export async function repairRecipeImageAction(id: string): Promise<{ ok: boolean; message: string }> {
  try {
    const owner = await getOwnerEmail();
    const { repairRecipeImageFromSource } = await import("@/lib/import/repair");
    const result = await repairRecipeImageFromSource(owner, id);
    revalidatePath("/recipes");
    revalidatePath(`/recipes/${id}`);
    revalidatePath(`/recipes/${id}/edit`);
    return { ok: true, message: result.message };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Image repair failed.",
    };
  }
}

// ---- Meal plans -----------------------------------------------------------

export async function createPlanAction(name: string): Promise<{ id: string }> {
  const owner = await getOwnerEmail();
  await assertCanCreatePlan(owner);
  const plan = await createPlan(owner, name);
  revalidatePath("/plans");
  return { id: plan.id };
}

export async function addToPlanAction(
  planId: string,
  recipeId: string,
  servings: number,
): Promise<void> {
  const owner = await getOwnerEmail();
  await addRecipeToPlan(owner, planId, recipeId, servings);
  revalidatePath(`/plans/${planId}`);
}

export async function setServingsAction(
  planId: string,
  itemId: string,
  servings: number,
): Promise<void> {
  const owner = await getOwnerEmail();
  await setPlannedServings(owner, itemId, servings);
  revalidatePath(`/plans/${planId}`);
}

export async function removePlanItemAction(planId: string, itemId: string): Promise<void> {
  const owner = await getOwnerEmail();
  await removePlanItem(owner, itemId);
  revalidatePath(`/plans/${planId}`);
}

export async function deletePlanAction(planId: string): Promise<void> {
  const owner = await getOwnerEmail();
  await deletePlan(planId, owner);
  revalidatePath("/plans");
}

export async function generateListAction(planId: string): Promise<void> {
  const owner = await getOwnerEmail();
  await generateShoppingList(owner, planId);
  revalidatePath(`/plans/${planId}`);
}

export async function addShoppingItemAction(planId: string, name: string): Promise<void> {
  const owner = await getOwnerEmail();
  await addCustomShoppingItem(owner, planId, name);
  revalidatePath(`/plans/${planId}`);
}

export async function removeShoppingItemAction(planId: string, itemId: string): Promise<void> {
  const owner = await getOwnerEmail();
  await removeCustomShoppingItem(owner, itemId);
  revalidatePath(`/plans/${planId}`);
}

export async function toggleShoppingItemAction(
  planId: string,
  itemId: string,
  checked: boolean,
): Promise<void> {
  const owner = await getOwnerEmail();
  await toggleShoppingItem(owner, itemId, checked);
  revalidatePath(`/plans/${planId}`);
}

// ---- Weekly plan autopilot --------------------------------------------------

export interface AutopilotInput {
  nights: number;
  quickMeals: number;
  usePantry: boolean;
}

export type AutopilotResult =
  | { ok: true; planId: string; planned: number; requested: number }
  | { ok: false; message: string };

/** AI-plan the week from the user's own library, then build the shopping list. */
export async function autopilotPlanAction(input: AutopilotInput): Promise<AutopilotResult> {
  try {
    const owner = await getOwnerEmail();
    const nights = Math.min(7, Math.max(1, Math.round(input.nights)));
    const quickMeals = Math.min(nights, Math.max(0, Math.round(input.quickMeals)));

    await assertCanCreatePlan(owner);
    const all = await listRecipes(owner);
    if (all.length < 3) {
      return {
        ok: false,
        message: "Save at least 3 recipes first — then autopilot has something to plan with.",
      };
    }
    const pool = all.slice(0, 150); // newest first; keeps the prompt bounded
    const [pantryItems, ingredientNames] = await Promise.all([
      listPantryItems(owner),
      listIngredientNames(
        owner,
        pool.map((r) => r.id),
      ),
    ]);

    await recordAiUse(owner, "plan");
    const { planWeek } = await import("@/lib/ai/planner");
    const result = await planWeek({
      recipes: pool.map((r) => ({
        id: r.id,
        title: r.title,
        mealType: r.mealType,
        totalMinutes: r.totalMinutes,
        ingredients: ingredientNames.get(r.id) ?? [],
      })),
      pantry: pantryItems.filter((i) => i.inPantry).map((i) => i.canonicalName),
      leftovers: pantryItems.filter((i) => i.hasLeftover).map((i) => i.canonicalName),
      nights,
      quickMeals,
      usePantry: input.usePantry,
    });

    // Trust nothing from the model: only the user's own recipes, deduped, capped.
    const owned = new Set(pool.map((r) => r.id));
    const picks = [...new Set(result.recipeIds)].filter((id) => owned.has(id)).slice(0, nights);
    if (picks.length === 0) {
      return { ok: false, message: "The planner could not put a week together. Try again." };
    }

    const plan = await createPlan(owner, result.name);
    for (const id of picks) {
      await addRecipeToPlan(owner, plan.id, id, 0); // 0 → recipe's default servings
    }
    await generateShoppingList(owner, plan.id);
    revalidatePath("/plans");
    // planned < nights when the library was too small — the plan page says so.
    return { ok: true, planId: plan.id, planned: picks.length, requested: nights };
  } catch (error) {
    console.error("Autopilot failed", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Autopilot failed. Try again.",
    };
  }
}

// ---- Collections ------------------------------------------------------------

export async function createCollectionAction(name: string): Promise<{ id: string }> {
  const owner = await getOwnerEmail();
  await assertCanCreateCollection(owner);
  const created = await createCollection(owner, name);
  revalidatePath("/collections");
  return { id: created.id };
}

export async function addToCollectionAction(collectionId: string, recipeId: string): Promise<void> {
  const owner = await getOwnerEmail();
  await addRecipeToCollection(owner, collectionId, recipeId);
  revalidatePath("/collections");
  revalidatePath(`/collections/${collectionId}`);
}

export async function removeFromCollectionAction(
  collectionId: string,
  recipeId: string,
): Promise<void> {
  const owner = await getOwnerEmail();
  await removeRecipeFromCollection(owner, collectionId, recipeId);
  revalidatePath("/collections");
  revalidatePath(`/collections/${collectionId}`);
  revalidatePath(`/c/${collectionId}`);
}

/**
 * Add someone else's public drop to one of your collections. Collections only
 * hold your own recipes, so this saves the drop into Your Recipes first —
 * saveDropForOwner dedupes, so an existing copy or own import is reused.
 */
export async function addDropToCollectionAction(
  collectionId: string,
  dropRecipeId: string,
): Promise<void> {
  const owner = await getOwnerEmail();
  const { id: copyId } = await saveDropForOwner(owner, dropRecipeId);
  await addRecipeToCollection(owner, collectionId, copyId);
  revalidatePath("/collections");
  revalidatePath(`/collections/${collectionId}`);
  revalidatePath("/recipes");
  revalidatePath("/discover");
  revalidatePath(`/r/${dropRecipeId}`);
}

/** Undo addDropToCollectionAction: the copy leaves the collection but stays in Your Recipes. */
export async function removeDropFromCollectionAction(
  collectionId: string,
  dropRecipeId: string,
): Promise<void> {
  const owner = await getOwnerEmail();
  // Resolves to the existing copy without creating one — a copy must already
  // exist for this drop to be in a collection at all.
  const { id: copyId } = await saveDropForOwner(owner, dropRecipeId);
  await removeRecipeFromCollection(owner, collectionId, copyId);
  revalidatePath("/collections");
  revalidatePath(`/collections/${collectionId}`);
  revalidatePath(`/r/${dropRecipeId}`);
}

export async function setCollectionPublicAction(id: string, isPublic: boolean): Promise<void> {
  const owner = await getOwnerEmail();
  if (isPublic) await assertCanPublishCollection(owner);
  await setCollectionPublic(owner, id, isPublic);
  revalidatePath("/collections");
  revalidatePath(`/collections/${id}`);
  revalidatePath(`/c/${id}`);
}

export async function renameCollectionAction(id: string, name: string): Promise<void> {
  const owner = await getOwnerEmail();
  await renameCollection(owner, id, name);
  revalidatePath("/collections");
  revalidatePath(`/collections/${id}`);
  revalidatePath(`/c/${id}`);
}

export async function deleteCollectionAction(id: string): Promise<void> {
  const owner = await getOwnerEmail();
  await deleteCollection(owner, id);
  revalidatePath("/collections");
}

/** Fresh remaining AI allowance, so the import page can update as jobs run. */
export async function aiRemainingAction(): Promise<number | null> {
  try {
    const owner = await getOwnerEmail();
    const { getAiUsage } = await import("@/lib/entitlements");
    const usage = await getAiUsage(owner);
    return Math.max(0, usage.limit - usage.used);
  } catch {
    return null;
  }
}

// ---- Recipe journal ----------------------------------------------------------

export async function addRecipeNoteAction(
  recipeId: string,
  kind: RecipeNoteKind,
  body: string | null,
): Promise<void> {
  const owner = await getOwnerEmail();
  await addRecipeNote(owner, recipeId, kind, body);
  revalidatePath(`/recipes/${recipeId}`);
}

export async function deleteRecipeNoteAction(recipeId: string, noteId: string): Promise<void> {
  const owner = await getOwnerEmail();
  await deleteRecipeNote(owner, noteId);
  revalidatePath(`/recipes/${recipeId}`);
}

/**
 * The "I made it!" toggle: on logs a dated cook (which puts the recipe in the
 * library's Made it list), off removes only the latest log — an undo, not a
 * history wipe.
 */
export async function setMadeItAction(recipeId: string, made: boolean): Promise<void> {
  const owner = await getOwnerEmail();
  if (made) await addRecipeNote(owner, recipeId, "cooked", null);
  else await removeLatestCooked(owner, recipeId);
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
}

// ---- Social -----------------------------------------------------------------

export async function setFollowAction(
  recipeId: string,
  following: boolean,
): Promise<{ following: boolean }> {
  const owner = await getOwnerEmail();
  const result = await setFollowByRecipe(owner, recipeId, following);
  revalidatePath("/discover");
  revalidatePath(`/r/${recipeId}`);
  return result;
}

export async function setFollowByHandleAction(
  handle: string,
  following: boolean,
): Promise<{ following: boolean }> {
  const owner = await getOwnerEmail();
  const result = await setFollowByHandle(owner, handle, following);
  revalidatePath(`/u/${handle}`);
  revalidatePath("/discover");
  return result;
}

export async function reportDropAction(recipeId: string, reason: string): Promise<void> {
  const owner = await getOwnerEmail();
  await reportDrop(owner, recipeId, reason || null);
}

export async function markCookedAction(recipeId: string): Promise<CookedState> {
  const owner = await getOwnerEmail();
  const result = await markCookedByRecipe(owner, recipeId);
  revalidatePath(`/r/${recipeId}`);
  revalidatePath("/discover");
  return result;
}

export async function setPantryItemAction(input: {
  planId?: string;
  canonicalName: string;
  aisle: string | null;
  checked: boolean;
}): Promise<void> {
  const owner = await getOwnerEmail();
  await setPantryItem({
    ownerEmail: owner,
    canonicalName: input.canonicalName,
    aisle: input.aisle,
    checked: input.checked,
  });
  if (input.planId) revalidatePath(`/plans/${input.planId}`);
  revalidatePath("/pantry");
}

export interface PantryNameCheck {
  /** The exact name is already a known ingredient, pantry item, or staple. */
  known: boolean;
  /** Closest known name when the input looks like a typo of it. */
  suggestion: string | null;
}

/**
 * Sanity check for hand-typed pantry items: is the name one the app already
 * knows, and if not, what's the closest likely-typo match? Unknown names get
 * an "add anyway?" confirm in the UI instead of saving silently.
 */
export async function checkPantryNameAction(name: string): Promise<PantryNameCheck> {
  const owner = await getOwnerEmail();
  const cleaned = name.trim().toLowerCase();
  if (!cleaned) return { known: false, suggestion: null };
  try {
    const [{ COMMON_ITEMS }, { closestKnownName }, { ingredientMatchKey }, recent, pantry] =
      await Promise.all([
        import("@/lib/shopping/common-items"),
        import("@/lib/shopping/spelling"),
        import("@/lib/shopping/normalize"),
        getKnownCanonicalNames(),
        listPantryItems(owner),
      ]);
    const key = ingredientMatchKey(cleaned);
    // Canonical lookup tries the singular-normalized key too, so "eggs" is
    // known whenever the canonical "egg" exists.
    const isCanonical =
      (await isKnownIngredientName(cleaned)) ||
      (key !== cleaned && (await isKnownIngredientName(key)));
    const vocabulary = [
      ...COMMON_ITEMS,
      ...recent,
      ...pantry.map((item) => item.canonicalName),
    ];
    const known = isCanonical || vocabulary.some((v) => ingredientMatchKey(v) === key);
    return { known, suggestion: known ? null : closestKnownName(cleaned, vocabulary) };
  } catch {
    return { known: true, suggestion: null }; // check is best-effort — never block the add
  }
}

export async function setLeftoverItemAction(input: {
  planId?: string;
  canonicalName: string;
  aisle: string | null;
  checked: boolean;
}): Promise<void> {
  const owner = await getOwnerEmail();
  await setLeftoverItem({
    ownerEmail: owner,
    canonicalName: input.canonicalName,
    aisle: input.aisle,
    checked: input.checked,
  });
  if (input.planId) revalidatePath(`/plans/${input.planId}`);
  revalidatePath("/pantry");
}
