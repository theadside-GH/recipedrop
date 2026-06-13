import { features } from "@/lib/env";
import { parseSharedRecipeInput } from "@/lib/sources/shared";
import { ShareCaptureClient } from "./share-capture-client";

export const dynamic = "force-dynamic";

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; text?: string; url?: string }>;
}) {
  const sp = await searchParams;
  const shared = parseSharedRecipeInput(sp);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Save a recipe</h1>
        <p className="mt-1 text-muted">
          Shared links and captions land here, then get turned into a clean recipe.
        </p>
      </div>

      {!features.aiEnabled && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong className="font-semibold">AI extraction is not set up yet.</strong>{" "}
          Add your Anthropic API key before importing new recipes.
        </div>
      )}

      <ShareCaptureClient
        aiEnabled={features.aiEnabled}
        initialValue={shared?.value ?? ""}
        initialSourceType={shared?.sourceType ?? null}
      />
    </div>
  );
}
