import "server-only";
import { getJob, updateJob as updateOwnedJob, type ImportJobRow } from "@/lib/repo/imports";
import { fetchWebsite } from "@/lib/sources/website";
import { fetchYoutube } from "@/lib/sources/youtube";
import type { SourceContent } from "@/lib/sources/types";
import { extractRecipe, type ImageInput } from "@/lib/ai/extract";
import { findStandInImage } from "@/lib/ai/image-search";
import { recordAiUse } from "@/lib/entitlements";
import { pickWorkingImage } from "@/lib/import/images";
import { resolveSourceKey } from "@/lib/import/resolve-source";
import type { RecipeExtraction } from "@/lib/ai/schema";
import {
  createRecipeFromExtraction,
  findDuplicateRecipeBySource,
  findDuplicateRecipe,
  getKnownCanonicalNames,
} from "@/lib/repo/recipes";

/**
 * What to try next when a source had nothing extractable — phrased for what
 * the user actually pasted. Only social videos should hear about "captions".
 */
function extractionAdvice(sourceType: ImportJobRow["sourceType"], rawInput: string | null): string {
  const social = /tiktok\.com|instagram\.com|facebook\.com|fb\.watch/i.test(rawInput ?? "");
  if (sourceType === "youtube" || social) {
    return (
      "The recipe details are probably in the video itself rather than the caption — " +
      'copy the full recipe text (or type what you see in the video) into the "Paste text" tab.'
    );
  }
  if (sourceType === "text") {
    return "That text doesn't look like a full recipe — paste the ingredients and the steps together, or write it in by hand via New recipe.";
  }
  return "That page doesn't seem to contain a readable recipe — if it's behind a popup or login, copy the recipe text from the page and paste it instead.";
}

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
export async function processJob(ownerEmail: string, jobId: string): Promise<ImportJobRow | null> {
  const job = await getJob(ownerEmail, jobId);
  if (!job) return null;
  if (job.status === "done") return job;

  const updateJob = (id: string, patch: Parameters<typeof updateOwnedJob>[2]) =>
    updateOwnedJob(ownerEmail, id, patch);

  await updateJob(jobId, { status: "processing", error: null });
  try {
    const sourceKey =
      job.sourceType === "text" ? null : await resolveSourceKey(job.rawInput);
    if (job.sourceType !== "text") {
      const duplicate = await findDuplicateRecipeBySource({
        ownerEmail: job.ownerEmail,
        sourceUrl: job.rawInput,
        sourceKey,
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
    await recordAiUse(ownerEmail, "import");
    const extraction = await extractRecipe({
      text: content.text,
      knownCanonical: known,
      context: content.context ?? job.rawInput,
    });
    // Incomplete extraction: save what we got when there's a real start
    // (finished below as needs_review so the user can fill in the rest);
    // fail with specifics only when there's nothing worth keeping.
    const partial = !hasUsefulRecipeDetails(extraction);
    if (partial && !hasPartialRecipeDetails(extraction)) {
      throw new Error(
        `DishCovered read the source but ${describeExtractionGaps(extraction)}. ` +
          extractionAdvice(job.sourceType, job.rawInput),
      );
    }
    // Verify the image actually loads before saving it; fall back through the
    // source's other candidates so recipes stop landing without a photo.
    extraction.imageUrl = await pickWorkingImage([
      extraction.imageUrl,
      content.imageUrl,
      ...(content.imageCandidates ?? []),
    ]);
    if (!extraction.imageUrl) {
      // No usable photo anywhere in the source: find a stand-in by dish name
      // so the recipe never lands pictureless. The owner can replace it later.
      extraction.imageUrl = await findStandInImage(extraction.title);
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
      sourceKey,
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
      sourceKey,
    });
    if (partial) {
      return updateJob(jobId, {
        status: "needs_review",
        recipeId,
        error:
          `Imported what we could, but ${describeExtractionGaps(extraction)}. ` +
          "Open it to fill in the rest, or paste the full recipe text over it with Edit.",
      });
    }
    return updateJob(jobId, { status: "done", recipeId, error: null });
  } catch (err) {
    return updateJob(jobId, { status: "failed", error: friendlyImportError(err) });
  }
}

/** Enough to be worth saving as a draft the user can finish by hand. */
function hasPartialRecipeDetails(extraction: RecipeExtraction): boolean {
  const ingredientCount = countIngredients(extraction);
  const stepCount = countSteps(extraction);
  return ingredientCount >= 2 || stepCount >= 2;
}

/** Human-readable summary of what the extraction did and didn't find. */
export function describeExtractionGaps(extraction: RecipeExtraction): string {
  const ingredientCount = countIngredients(extraction);
  const stepCount = countSteps(extraction);
  const found: string[] = [];
  const missing: string[] = [];
  (ingredientCount > 0 ? found : missing).push(
    ingredientCount > 0
      ? `${ingredientCount} ingredient${ingredientCount === 1 ? "" : "s"}`
      : "the ingredient list",
  );
  (stepCount > 0 ? found : missing).push(
    stepCount > 0 ? `${stepCount} step${stepCount === 1 ? "" : "s"}` : "the cooking steps",
  );
  const foundText = found.length ? `only found a title and ${found.join(" and ")}` : "found only a title";
  return `${foundText} — missing ${missing.length ? missing.join(" and ") : "detail"}`;
}

/**
 * Errors from our own stack (DB writes, network hiccups) read as scary
 * internals and are usually transient — tell the user to retry instead.
 */
function friendlyImportError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Unknown error during import.";
  if (/^failed query|econnre|etimedout|fetch failed|connection|timeout/i.test(raw)) {
    return "A temporary glitch on our side stopped this import — the link itself is fine. Press Retry.";
  }
  return raw;
}

function countIngredients(extraction: RecipeExtraction): number {
  return extraction.ingredients.filter(
    (ingredient) => ingredient.raw.trim() || ingredient.canonicalName.trim(),
  ).length;
}

function countSteps(extraction: RecipeExtraction): number {
  return extraction.steps.filter((step) => step.instruction.trim()).length;
}

export function hasUsefulRecipeDetails(extraction: RecipeExtraction): boolean {
  return countIngredients(extraction) >= 2 && countSteps(extraction) >= 1;
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
  await recordAiUse(ownerEmail, "photo");
  const extraction = await extractRecipe({ images, knownCanonical: known });
  if (!hasUsefulRecipeDetails(extraction)) {
    throw new Error(
      `DishCovered read the image${images.length === 1 ? "" : "s"} but ` +
        `${describeExtractionGaps(extraction)}. Try a sharper photo, or include the page with the missing part.`,
    );
  }
  // Photo imports rarely carry a usable dish photo — find a stand-in by title.
  extraction.imageUrl =
    (await pickWorkingImage([extraction.imageUrl])) ??
    (await findStandInImage(extraction.title));
  return createRecipeFromExtraction(ownerEmail, extraction, { sourceType: "photo" });
}
