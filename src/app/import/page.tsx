import { features } from "@/lib/env";
import { ImportClient } from "./import-client";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import recipes</h1>
        <p className="mt-1 text-muted">
          Drop in a link, paste text, upload a photo, or paste a whole list - RecipeDrop
          turns each one into a clean, step-by-step recipe.
        </p>
      </div>
      {!features.aiEnabled && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong className="font-semibold">AI extraction isn&apos;t set up yet.</strong>{" "}
          Add your <code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code> to{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code> to import recipes.
          See the README for setup.
        </div>
      )}
      <ImportClient aiEnabled={features.aiEnabled} />
    </div>
  );
}
