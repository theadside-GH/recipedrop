import { redirect } from "next/navigation";
import { getOwnerEmail } from "@/lib/auth";
import { getRandomRecipeId } from "@/lib/repo/recipes";

export const dynamic = "force-dynamic";

/** "Surprise me": jump to a random recipe from the user's library. */
export async function GET(): Promise<Response> {
  const owner = await getOwnerEmail();
  const id = await getRandomRecipeId(owner);
  redirect(id ? `/recipes/${id}` : "/recipes");
}
