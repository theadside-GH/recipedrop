import "server-only";
import { extractRecipe } from "@/lib/ai/extract";
import type { Recipe } from "@/lib/db/schema";
import { getKnownCanonicalNames, getRecipeFull, replaceRecipeFromExtraction, setRecipeImage } from "@/lib/repo/recipes";
import { fetchWebsite } from "@/lib/sources/website";
import { fetchYoutube } from "@/lib/sources/youtube";
import type { SourceContent } from "@/lib/sources/types";
import { hasUsefulRecipeDetails } from "./process";

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

  if (content.imageUrl && !extraction.imageUrl) extraction.imageUrl = content.imageUrl;
  if (content.description && !extraction.description) extraction.description = content.description;
  if (content.author && !extraction.sourceAuthor) extraction.sourceAuthor = content.author;

  await replaceRecipeFromExtraction({
    ownerEmail,
    id: recipeId,
    extraction,
    imagePath: content.imageUrl ?? extraction.imageUrl ?? data.recipe.imagePath,
  });

  return { ok: true, message: "Recipe repaired from the original source." };
}

export async function repairRecipeImageFromSource(
  ownerEmail: string,
  recipeId: string,
): Promise<RepairResult> {
  const data = assertOwnedRecipe(await getRecipeFull(recipeId), ownerEmail);
  const content = await loadSourceForRecipe(data.recipe);
  const image = content.imageUrl?.trim();
  if (!image) {
    throw new Error("No better image was found in the original source.");
  }
  await setRecipeImage({ ownerEmail, id: recipeId, imagePath: image });
  return { ok: true, message: "Recipe image repaired from the original source." };
}
