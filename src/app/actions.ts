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
  deleteRecipe,
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
  try {
    const { processJob } = await import("@/lib/import/process");
    const job = await processJob(jobId);
    if (job?.status === "done") revalidatePath("/");
    return job ? toView(job) : null;
  } catch (error) {
    console.error("Import job failed", error);
    const message = error instanceof Error ? error.message : "Import failed while processing.";
    const failed = await updateJob(jobId, { status: "failed", error: message });
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
  revalidatePath("/");
  return { recipeId };
}

// ---- Recipes --------------------------------------------------------------

export async function deleteRecipeAction(id: string): Promise<void> {
  await deleteRecipe(id);
  revalidatePath("/");
}

export async function setFavoriteAction(id: string, isFavorite: boolean): Promise<void> {
  await setRecipeFavorite(id, isFavorite);
  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
}

export async function setRecipePublicAction(id: string, isPublic: boolean): Promise<void> {
  const owner = await getOwnerEmail();
  await setRecipePublic({ ownerEmail: owner, id, isPublic });
  revalidatePath("/");
  revalidatePath("/discover");
  revalidatePath(`/recipes/${id}`);
}

export async function setRecipeImageAction(id: string, imagePath: string): Promise<void> {
  const owner = await getOwnerEmail();
  await setRecipeImage({ ownerEmail: owner, id, imagePath });
  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
  revalidatePath(`/recipes/${id}/edit`);
}

export async function updateProfileAction(input: ProfileInput): Promise<void> {
  const owner = await getOwnerEmail();
  await updateProfile(owner, input);
  revalidatePath("/");
  revalidatePath("/discover");
  revalidatePath("/profile");
}

export async function updateRecipeAction(
  id: string,
  input: Omit<RecipeEditInput, "id" | "ownerEmail">,
): Promise<void> {
  const owner = await getOwnerEmail();
  await updateRecipe({ ...input, id, ownerEmail: owner });
  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
  revalidatePath(`/recipes/${id}/edit`);
  revalidatePath("/plans");
}

export async function repairRecipeAction(id: string): Promise<{ ok: boolean; message: string }> {
  try {
    const owner = await getOwnerEmail();
    const { repairRecipeFromSource } = await import("@/lib/import/repair");
    const result = await repairRecipeFromSource(owner, id);
    revalidatePath("/");
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
    revalidatePath("/");
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
  const plan = await createPlan(owner, name);
  revalidatePath("/plans");
  return { id: plan.id };
}

export async function addToPlanAction(
  planId: string,
  recipeId: string,
  servings: number,
): Promise<void> {
  await addRecipeToPlan(planId, recipeId, servings);
  revalidatePath(`/plans/${planId}`);
}

export async function setServingsAction(
  planId: string,
  itemId: string,
  servings: number,
): Promise<void> {
  await setPlannedServings(itemId, servings);
  revalidatePath(`/plans/${planId}`);
}

export async function removePlanItemAction(planId: string, itemId: string): Promise<void> {
  await removePlanItem(itemId);
  revalidatePath(`/plans/${planId}`);
}

export async function deletePlanAction(planId: string): Promise<void> {
  await deletePlan(planId);
  revalidatePath("/plans");
}

export async function generateListAction(planId: string): Promise<void> {
  await generateShoppingList(planId);
  revalidatePath(`/plans/${planId}`);
}

export async function toggleShoppingItemAction(
  planId: string,
  itemId: string,
  checked: boolean,
): Promise<void> {
  await toggleShoppingItem(itemId, checked);
  revalidatePath(`/plans/${planId}`);
}
