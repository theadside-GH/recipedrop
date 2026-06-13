"use server";

import { revalidatePath } from "next/cache";
import { getOwnerEmail } from "@/lib/auth";
import { features } from "@/lib/env";
import {
  createSingleJob,
  createBulkJobs,
  type ImportJobRow,
} from "@/lib/repo/imports";
import { processJob, processPhotoImport } from "@/lib/import/process";
import { detectSourceType } from "@/lib/sources/detect";
import { deleteRecipe } from "@/lib/repo/recipes";
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
  sourceType: ImportJobRow["sourceType"];
  status: ImportJobRow["status"];
  error: string | null;
  recipeId: string | null;
}

function toView(j: ImportJobRow): JobView {
  return {
    id: j.id,
    label: j.label,
    sourceType: j.sourceType,
    status: j.status,
    error: j.error,
    recipeId: j.recipeId,
  };
}

/** Create import job(s) from a single link/text or a bulk paste, return them pending. */
export async function startImport(input: {
  mode: "single" | "bulk";
  value: string;
}): Promise<{ jobs: JobView[]; aiEnabled: boolean }> {
  const owner = await getOwnerEmail();
  if (input.mode === "bulk") {
    const { jobs } = await createBulkJobs(owner, input.value);
    return { jobs: jobs.map(toView), aiEnabled: features.aiEnabled };
  }
  const type = detectSourceType(input.value);
  const job = await createSingleJob(owner, type, input.value);
  return { jobs: [toView(job)], aiEnabled: features.aiEnabled };
}

/** Run a single pending import job to completion and return its final state. */
export async function runImportJob(jobId: string): Promise<JobView | null> {
  const job = await processJob(jobId);
  if (job?.status === "done") revalidatePath("/");
  return job ? toView(job) : null;
}

/** Import one or more recipe photos directly (vision). Returns the new recipe id. */
export async function importPhotos(images: ImageInput[]): Promise<{ recipeId: string }> {
  const owner = await getOwnerEmail();
  const recipeId = await processPhotoImport(owner, images);
  revalidatePath("/");
  return { recipeId };
}

// ---- Recipes --------------------------------------------------------------

export async function deleteRecipeAction(id: string): Promise<void> {
  await deleteRecipe(id);
  revalidatePath("/");
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
