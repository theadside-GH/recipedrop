import "server-only";
import { extractRecipe } from "@/lib/ai/extract";
import { findStandInImage } from "@/lib/ai/image-search";
import { recordAiUse } from "@/lib/entitlements";
import type { Recipe } from "@/lib/db/schema";
import { getKnownCanonicalNames, getRecipeFull, replaceRecipeFromExtraction, setRecipeImage } from "@/lib/repo/recipes";
import { fetchWebsite } from "@/lib/sources/website";
import { fetchYoutube } from "@/lib/sources/youtube";
import type { SourceContent } from "@/lib/sources/types";
import { hasUsefulRecipeDetails } from "./process";
import { pickWorkingImage } from "./images";

export interface RepairResult {
  ok: boolean;
  message: string;
}

function assertOwnedRecipe(data: Awaited<ReturnType<typeof getRecipeFull>>, ownerEmail: string) {
  if (!data || data.recipe.ownerEmail !== ownerEmail) {
    throw new Error("Recipe not found.");
  }
  return data;
}

async function loadSourceForRecipe(recipe: Recipe): Promise<SourceContent> {
  if (!recipe.sourceUrl) {
    throw new Error("This recipe does not have an original source link to repair from.");
  }
  if (recipe.sourceType === "youtube") return fetchYoutube(recipe.sourceUrl);
  if (recipe.sourceType === "url") return fetchWebsite(recipe.sourceUrl);
  throw new Error("This recipe was imported from text or photo, so there is no source link to re-read.");
}

export async function repairRecipeFromSource(
  ownerEmail: string,
  recipeId: string,
): Promise<RepairResult> {
  const data = assertOwnedRecipe(await getRecipeFull(recipeId), ownerEmail);
  const content = await loadSourceForRecipe(data.recipe);
  const known = await getKnownCanonicalNames();
  await recordAiUse(ownerEmail, "repair");
  const extraction = await extractRecipe({
    text: content.text,
    knownCanonical: known,
    context: content.context ?? data.recipe.sourceUrl ?? data.recipe.title,
  });

  if (!hasUsefulRecipeDetails(extraction)) {
    throw new Error(
      "Repair did not find enough ingredient and direction detail in the original source.",
    );
  }

  if (content.description && !extraction.description) extraction.description = content.description;
  if (content.author && !extraction.sourceAuthor) extraction.sourceAuthor = content.author;
  const workingImage = await pickWorkingImage([
    extraction.imageUrl,
    content.imageUrl,
    ...(content.imageCandidates ?? []),
  ]);
  const imagePath =
    workingImage ?? data.recipe.imagePath ?? (await findStandInImage(extraction.title));

  await replaceRecipeFromExtraction({
    ownerEmail,
    id: recipeId,
    extraction,
    imagePath,
  });

  return { ok: true, message: "Recipe repaired from the original source." };
}

export async function repairRecipeImageFromSource(
  ownerEmail: string,
  recipeId: string,
): Promise<RepairResult> {
  const data = assertOwnedRecipe(await getRecipeFull(recipeId), ownerEmail);
  const current = data.recipe.imagePath;
  let image: string | null = null;
  let fromSource = true;
  try {
    const content = await loadSourceForRecipe(data.recipe);
    image = await pickWorkingImage([content.imageUrl, ...(content.imageCandidates ?? [])]);
  } catch {
    // No source link (text/photo recipes) — go straight to the title search.
  }
  // The source usually re-serves the photo the recipe already has — which is
  // exactly why the user is tapping this button. Same image = no image.
  if (image === current) image = null;
  if (!image) {
    // Metered: the title search is an AI call.
    await recordAiUse(ownerEmail, "repair");
    const standIn = await findStandInImage(data.recipe.title);
    image = standIn && standIn !== current ? standIn : null;
    fromSource = false;
  }
  if (!image) {
    throw new Error(
      "No new photo turned up — the source and a web search only found what's already here. You can upload your own photo from Edit.",
    );
  }
  await setRecipeImage({ ownerEmail, id: recipeId, imagePath: image });
  return {
    ok: true,
    message: fromSource
      ? "Recipe image repaired from the original source."
      : "Found a stand-in photo for this dish — replace it any time from Edit.",
  };
}
