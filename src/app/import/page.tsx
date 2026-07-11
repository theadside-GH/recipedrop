import Link from "next/link";
import { features } from "@/lib/env";
import { ImportClient } from "./import-client";
import { getOwnerEmail } from "@/lib/auth";
import { getAiUsage } from "@/lib/entitlements";
import { listRecentJobs } from "@/lib/repo/imports";
import type { JobView } from "@/app/actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Import recipes" };

export default async function ImportPage() {
  const recentJobs = await getRecentImportViews();
  const usage = features.aiEnabled ? await getAiUsageSafe() : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import recipes</h1>
        <p className="mt-1 text-muted">
          Drop in a link, paste text, upload a photo, or paste a whole list - DishCovered
          turns each one into a clean, step-by-step recipe. Family recipe that only lives
          in your head?{" "}
          <Link href="/recipes/new" className="font-medium text-brand hover:underline">
            Write it in yourself
          </Link>
          .
        </p>
      </div>
      {usage && (
        <p className="text-sm text-muted">
          AI imports today: {usage.used} of {usage.limit} used
          {usage.tier === "free" ? " (Free plan)" : ""}.
        </p>
      )}
      {!features.aiEnabled && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong className="font-semibold">AI extraction isn&apos;t set up yet.</strong>{" "}
          Add your <code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code> to{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code> to import recipes.
          See the README for setup.
        </div>
      )}
      <ImportClient
        aiEnabled={features.aiEnabled}
        initialJobs={recentJobs}
        aiRemaining={usage ? Math.max(0, usage.limit - usage.used) : null}
      />
    </div>
  );
}

async function getAiUsageSafe() {
  try {
    return await getAiUsage(await getOwnerEmail());
  } catch {
    return null;
  }
}

async function getRecentImportViews(): Promise<JobView[]> {
  try {
    const owner = await getOwnerEmail();
    const jobs = await listRecentJobs(owner, 30);
    return jobs.map((job) => {
      // Imports only run while the tab that started them is open. A job still
      // "pending"/"processing" minutes later is dead — surface it as failed so
      // the Retry button appears instead of an eternal "Waiting" row.
      const stale =
        (job.status === "pending" || job.status === "processing") &&
        Date.now() - job.updatedAt.getTime() > 5 * 60 * 1000;
      return {
        id: job.id,
        label: job.label,
        rawInput: job.rawInput,
        sourceType: job.sourceType,
        status: stale ? ("failed" as const) : job.status,
        error: stale
          ? "This import was interrupted (the page may have closed). Press Retry."
          : job.error,
        recipeId: job.recipeId,
      };
    });
  } catch {
    return [];
  }
}
