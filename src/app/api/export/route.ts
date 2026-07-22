import { getOwnerEmail } from "@/lib/auth";
import { exportRecipesForOwner } from "@/lib/repo/recipes";

export const dynamic = "force-dynamic";

/**
 * Download the signed-in user's full recipe library as a JSON file. The
 * middleware in src/proxy.ts lets /api/* through, so this route enforces its
 * own auth: getOwnerEmail() throws for anonymous or uninvited callers, and
 * every row we return is scoped to that owner — a user can only ever export
 * their own recipes.
 */
export async function GET() {
  let ownerEmail: string;
  try {
    ownerEmail = await getOwnerEmail();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Please sign in to do that.";
    return Response.json({ error: message }, { status: 401 });
  }

  const recipes = await exportRecipesForOwner(ownerEmail);
  const exportedAt = new Date();
  const payload = {
    app: "DishCovered",
    version: 1,
    exportedAt: exportedAt.toISOString(),
    recipeCount: recipes.length,
    recipes,
  };

  const date = exportedAt.toISOString().slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="dishcovered-export-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
