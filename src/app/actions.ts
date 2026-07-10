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
  listIngredientNames,
  listRecipes,
  saveDropForOwner,
  setRecipeFavorite,
  setRecipeImage,
  setRecipePublic,
  updateRecipe,
  type RecipeEditInput,
} from "@/lib/repo/recipes";
import { updateProfile, type ProfileInput } from "@/lib/repo/profiles";
import { randomUUID } from "node:crypto";
import {
  createPlan,
  addRecipeToPlan,
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
  setFollowByRecipe,
  type CookedState,
} from "@/lib/repo/social";
import { addRecipeNote, deleteRecipeNote, type RecipeNoteKind } from "@/lib/repo/notes";
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
    id: randomUUID(),
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

export async function setRecipePublicAction(id: string, isPublic: boolean): Promise<void> {
  const owner = await getOwnerEmail();
  await setRecipePublic({ ownerEmail: owner, id, isPublic });
  revalidatePath("/recipes");
  revalidatePath("/discover");
  revalidatePath(`/r/${id}`);
}

export async function setRecipeImageAction(id: string, imagePath: string): Promise<void> {
  const owner = await getOwnerEmail();
  await setRecipeImage({ ownerEmail: owner, id, imagePath });
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
  revalidatePath(`/recipes/${id}/edit`);
}

export async function updateProfileAction(input: ProfileInput): Promise<void> {
  const owner = await getOwnerEmail();
  await updateProfile(owner, input);
  revalidatePath("/recipes");
  revalidatePath("/discover");
  revalidatePath("/profile");
}

/** Create a recipe the user typed in by hand. */
export async function createRecipeAction(
  input: Omit<RecipeEditInput, "id" | "ownerEmail">,
): Promise<{ id: string }> {
  const owner = await getOwnerEmail();
  const id = await createRecipeManual(owner, input);
  revalidatePath("/recipes");
  return { id };
}

export async function updateRecipeAction(
  id: string,
  input: Omit<RecipeEditInput, "id" | "ownerEmail">,
): Promise<void> {
  const owner = await getOwnerEmail();
  await updateRecipe({ ...input, id, ownerEmail: owner });
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

export type AutopilotResult = { ok: true; planId: string } | { ok: false; message: string };

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
    return { ok: true, planId: plan.id };
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
