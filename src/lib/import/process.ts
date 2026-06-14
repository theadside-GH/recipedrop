import "server-only";
import { getJob, updateJob, type ImportJobRow } from "@/lib/repo/imports";
import { fetchWebsite } from "@/lib/sources/website";
import { fetchYoutube } from "@/lib/sources/youtube";
import type { SourceContent } from "@/lib/sources/types";
import { extractRecipe, type ImageInput } from "@/lib/ai/extract";
import type { RecipeExtraction } from "@/lib/ai/schema";
import {
  createRecipeFromExtraction,
  findDuplicateRecipeBySource,
  findDuplicateRecipe,
  getKnownCanonicalNames,
} from "@/lib/repo/recipes";

async function loadSource(job: ImportJobRow): Promise<SourceContent> {
  switch (job.sourceType) {
    case "url":
      return fetchWebsite(job.rawInput);
    case "youtube":
      return fetchYoutube(job.rawInput);
    case "text":
      return { text: job.rawInput };
    default:
      throw new Error(`Unsupported source type: ${job.sourceType}`);
  }
}

/**
 * Process one import job end-to-end: fetch the source, extract a structured
 * recipe with Claude, persist it, and update the job status. Never throws —
 * failures are recorded on the job so the batch UI can show + retry them.
 */
export async function processJob(jobId: string): Promise<ImportJobRow | null> {
  const job = await getJob(jobId);
  if (!job) return null;
  if (job.status === "done") return job;

  await updateJob(jobId, { status: "processing", error: null });
  try {
    if (job.sourceType !== "text") {
      const duplicate = await findDuplicateRecipeBySource({
        ownerEmail: job.ownerEmail,
        sourceUrl: job.rawInput,
      });
      if (duplicate) {
        return updateJob(jobId, {
          status: "needs_review",
          recipeId: duplicate.id,
          error: "Skipped duplicate: this source was already imported.",
        });
      }
    }

    const content = await loadSource(job);
    const known = await getKnownCanonicalNames();
    const extraction = await extractRecipe({
      text: content.text,
      knownCanonical: known,
      context: content.context ?? job.rawInput,
    });
    if (!hasUsefulRecipeDetails(extraction)) {
      throw new Error(
        "RecipeDrop could not find enough ingredient and direction detail in that source. Try the original recipe page or paste the recipe text.",
      );
    }
    if (content.imageUrl && !extraction.imageUrl) {
      extraction.imageUrl = content.imageUrl;
    }
    if (content.description && !extraction.description) {
      extraction.description = content.description;
    }
    if (content.author && !extraction.sourceAuthor) {
      extraction.sourceAuthor = content.author;
    }
    const duplicate = await findDuplicateRecipe({
      ownerEmail: job.ownerEmail,
      sourceUrl: job.sourceType === "text" ? null : job.rawInput,
      title: extraction.title,
    });
    if (duplicate) {
      return updateJob(jobId, {
        status: "needs_review",
        recipeId: duplicate.id,
        error:
          duplicate.reason === "source"
            ? "Skipped duplicate: this source was already imported."
            : `Skipped duplicate: looks like "${duplicate.title}" is already saved.`,
      });
    }
    const recipeId = await createRecipeFromExtraction(job.ownerEmail, extraction, {
      sourceType: job.sourceType,
      sourceUrl: job.sourceType === "text" ? null : job.rawInput,
    });
    return updateJob(jobId, { status: "done", recipeId, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during import.";
    return updateJob(jobId, { status: "failed", error: message });
  }
}

function hasUsefulRecipeDetails(extraction: RecipeExtraction): boolean {
  const ingredientCount = extraction.ingredients.filter((ingredient) =>
    ingredient.raw.trim() || ingredient.canonicalName.trim(),
  ).length;
  const stepCount = extraction.steps.filter((step) => step.instruction.trim()).length;
  return ingredientCount >= 2 && stepCount >= 1;
}

/**
 * Process a photo import directly (images aren't stored as job rawInput). Used
 * by the photo import action; returns the created recipe id.
 */
export async function processPhotoImport(
  ownerEmail: string,
  images: ImageInput[],
): Promise<string> {
  const known = await getKnownCanonicalNames();
  const extraction = await extractRecipe({ images, knownCanonical: known });
  if (!hasUsefulRecipeDetails(extraction)) {
    throw new Error(
      "RecipeDrop could not find enough ingredient and direction detail in those images.",
    );
  }
  return createRecipeFromExtraction(ownerEmail, extraction, { sourceType: "photo" });
}
