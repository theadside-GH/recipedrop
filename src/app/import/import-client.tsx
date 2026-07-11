"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Link2,
  FileText,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  CheckCircle2,
  Copy,
  EyeOff,
  XCircle,
  RotateCw,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  aiRemainingAction,
  startImport,
  runImportJob,
  importPhotos,
  clearImportHistoryAction,
  setRecipeImageAction,
  type JobView,
} from "@/app/actions";
import type { ImageInput } from "@/lib/ai/extract";
import { imageFileToDataUrl } from "@/lib/client-image";
import { splitBulkInput } from "@/lib/sources/detect";

type Tab = "link" | "bulk" | "photo";

/** Server-side cap on one bulk paste (see lib/repo/imports.ts MAX_BULK_ITEMS). */
const MAX_BULK_ITEMS = 20;

const SOURCE_LABEL: Record<string, string> = {
  url: "Website",
  youtube: "YouTube",
  text: "Pasted text",
  photo: "Photo",
};

/** Run async tasks with a small concurrency limit. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

export function ImportClient({
  aiEnabled,
  initialJobs = [],
  aiRemaining = null,
}: {
  aiEnabled: boolean;
  initialJobs?: JobView[];
  /** AI imports left in the user's daily allowance; null = unknown/unmetered. */
  aiRemaining?: number | null;
}) {
  const [tab, setTab] = useState<Tab>("link");
  // Live copy of the daily allowance — refreshed from the server after every
  // run so the hints don't keep advertising the page-load number.
  const [aiLeft, setAiLeft] = useState(aiRemaining);
  const [single, setSingle] = useState("");
  const [bulk, setBulk] = useState("");
  const [jobs, setJobs] = useState<JobView[]>(initialJobs);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [hideSkipped, setHideSkipped] = useState(false);
  const [copiedFailed, setCopiedFailed] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [singleImagePath, setSingleImagePath] = useState("");
  const [singleImageError, setSingleImageError] = useState<string | null>(null);
  const visibleJobs = hideSkipped ? jobs.filter((job) => !isSkippedDuplicate(job)) : jobs;
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const skippedCount = jobs.filter(isSkippedDuplicate).length;
  const summary = summarizeJobs(jobs);

  function updateJob(updated: JobView) {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
  }

  async function refreshQuota() {
    try {
      setAiLeft(await aiRemainingAction());
    } catch {
      // keep the last known number
    }
  }

  async function runJobs(toRun: JobView[]): Promise<JobView[]> {
    const results: JobView[] = [];
    await pool(toRun, 3, async (job) => {
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: "processing" } : j)),
      );
      try {
        const result = await runImportJob(job.id);
        if (result) {
          const next = result.id === job.id ? result : { ...job, ...result, id: job.id };
          updateJob(next);
          results.push(next);
          return;
        }
        const failed: JobView = {
          ...job,
          status: "failed",
          error: "Import failed while processing. Try again.",
          recipeId: null,
        };
        updateJob(failed);
        results.push(failed);
      } catch (err) {
        const failed: JobView = {
          ...job,
          status: "failed",
          error: err instanceof Error ? err.message : "Import failed while processing.",
          recipeId: null,
        };
        updateJob(failed);
        results.push(failed);
      }
    });
    void refreshQuota();
    return results;
  }

  async function handleStart(mode: "single" | "bulk", value: string) {
    if (!value.trim() || busy) return;
    const attachedImage = mode === "single" ? singleImagePath : "";
    setBusy(true);
    setImportError(null);
    try {
      const { jobs: created } = await startImport({ mode, value });
      setJobs((prev) => [...created, ...prev]);
      if (mode === "single") setSingle("");
      else setBulk("");
      const results = await runJobs(created);
      // Partial ("needs review") imports keep the attached photo too — they
      // have a real recipeId and are exactly the imports that lack an image.
      const imported = results.find(
        (job) => job.recipeId && (job.status === "done" || isPartialImport(job)),
      );
      if (mode === "single" && attachedImage && imported?.recipeId) {
        await setRecipeImageAction(imported.recipeId, attachedImage);
        setSingleImagePath("");
      }
      if (mode === "bulk" && results.some((job) => job.status === "failed")) {
        setImportError("Some items need help. The report below shows which ones to retry or paste another way.");
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import did not start.");
    } finally {
      setBusy(false);
    }
  }

  async function chooseSingleImage(file: File | undefined) {
    if (!file) return;
    setSingleImageError(null);
    try {
      const dataUrl = await imageFileToDataUrl(file, { maxSize: 900, quality: 0.76 });
      setSingleImagePath(dataUrl);
    } catch (err) {
      setSingleImageError(err instanceof Error ? err.message : "Could not read that image.");
    }
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (busy || !aiEnabled) return;
    const uri = event.dataTransfer.getData("text/uri-list");
    const text = event.dataTransfer.getData("text/plain");
    const value = (uri || text).trim();
    if (!value) return;
    setTab("link");
    setSingle(value);
    await handleStart("single", value);
  }

  async function retry(job: JobView) {
    await runJobs([job]);
  }

  async function retryFailed() {
    const retryable = failedJobs.filter((job) => !job.id.startsWith("local-"));
    if (!retryable.length || busy) return;
    setBusy(true);
    setImportError(null);
    try {
      await runJobs(retryable);
    } finally {
      setBusy(false);
    }
  }

  async function copyFailed() {
    const text = failedJobs
      .map((job) => job.rawInput || job.label || "")
      .map((value) => value.trim())
      .filter(Boolean)
      .join("\n");
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedFailed(true);
    window.setTimeout(() => setCopiedFailed(false), 1500);
  }

  async function clearHistory() {
    if (!confirm("Clear import history? This will not delete saved recipes.")) return;
    setJobs([]);
    await clearImportHistoryAction();
  }

  async function handlePhotos(files: FileList | null) {
    if (!files || !files.length) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const images: ImageInput[] = [];
      for (const file of Array.from(files).slice(0, 5)) {
        // Downscale + re-encode as JPEG client-side: full-size phone photos
        // blow past the 4 MB server-action body limit, and odd formats (HEIC)
        // either convert here or fail with a clear message instead of a 500.
        let dataUrl: string;
        try {
          dataUrl = await imageFileToDataUrl(file, { maxSize: 1400, quality: 0.78 });
        } catch {
          throw new Error(
            `Couldn't read "${file.name}" — that photo format isn't supported by your browser. Try a JPG or PNG, or take a screenshot of it.`,
          );
        }
        images.push({ mediaType: "image/jpeg", data: dataUrl.split(",")[1] ?? "" });
      }
      const { recipeId } = await importPhotos(images);
      setJobs((prev) => [
        {
          id: recipeId,
          label: "Photo import",
          rawInput: null,
          sourceType: "photo",
          status: "done",
          error: null,
          recipeId,
        },
        ...prev,
      ]);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Photo import failed.");
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-2 rounded-full bg-surface p-1">
        <TabButton active={tab === "link"} onClick={() => setTab("link")} icon={Link2}>
          Link / Text
        </TabButton>
        <TabButton active={tab === "bulk"} onClick={() => setTab("bulk")} icon={FileText}>
          Bulk
        </TabButton>
        <TabButton active={tab === "photo"} onClick={() => setTab("photo")} icon={ImageIcon}>
          Photo
        </TabButton>
      </div>

      {tab === "link" && (
        <div
          className="space-y-3"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <Input
            value={single}
            onChange={(e) => setSingle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStart("single", single)}
            placeholder="Paste a recipe link — TikTok, Instagram, YouTube, or any website…"
            disabled={!aiEnabled}
          />
          <p className="text-center text-xs text-muted">or paste the full recipe text below</p>
          <Textarea
            value={single}
            onChange={(e) => setSingle(e.target.value)}
            placeholder="Paste recipe text, or a TikTok/Instagram caption…"
            disabled={!aiEnabled}
          />
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3">
            {singleImagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={singleImagePath}
                alt=""
                className="h-16 w-16 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-card text-muted">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Recipe photo</p>
              <p className="text-xs text-muted">
                Optional, but useful when the import does not find one.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-brand-soft">
              <ImagePlus className="h-4 w-4" />
              Choose photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={!aiEnabled || busy}
                onChange={(event) => chooseSingleImage(event.target.files?.[0])}
              />
            </label>
            {singleImagePath && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSingleImagePath("")}
              >
                Remove
              </Button>
            )}
          </div>
          {singleImageError && <p className="text-sm text-red-600">{singleImageError}</p>}
          <Button
            onClick={() => handleStart("single", single)}
            disabled={!aiEnabled || busy || !single.trim()}
            className="w-full"
            size="lg"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Import recipe
          </Button>
          {importError && <p className="text-sm text-red-600">{importError}</p>}
        </div>
      )}

      {tab === "bulk" && (
        <div className="space-y-3">
          <Textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={
              `Paste a batch of links and/or recipes — one per line or separated by blank lines${aiLeft != null ? ` (you have ${aiLeft} AI use${aiLeft === 1 ? "" : "s"} left today)` : ""}.` +
              "\n\nhttps://example.com/recipe-1\nhttps://youtube.com/watch?v=...\n..."
            }
            className="min-h-48"
            disabled={!aiEnabled}
          />
          <BulkQuotaHint bulk={bulk} aiRemaining={aiLeft} />
          <Button
            onClick={() => handleStart("bulk", bulk)}
            disabled={!aiEnabled || busy || !bulk.trim()}
            className="w-full"
            size="lg"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Import all
          </Button>
          {importError && <p className="text-sm text-red-600">{importError}</p>}
        </div>
      )}

      {tab === "photo" && (
        <div className="space-y-3">
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface px-6 py-12 text-center transition-colors hover:border-brand",
              !aiEnabled && "pointer-events-none opacity-50",
            )}
          >
            <ImageIcon className="h-8 w-8 text-muted" />
            <span className="font-medium">Upload a photo or screenshot</span>
            <span className="text-xs text-muted">
              A recipe card, a cookbook page, or a screenshot — up to 5 images
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={!aiEnabled || photoBusy}
              onChange={(e) => handlePhotos(e.target.files)}
            />
          </label>
          {photoBusy && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading your recipe…
            </p>
          )}
          {photoError && <p className="text-sm text-red-600">{photoError}</p>}
        </div>
      )}

      {/* Job list */}
      {jobs.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Recent import history</h2>
              <p className="text-xs text-muted">{summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {failedJobs.length > 0 && (
                <>
                  <Button size="sm" variant="secondary" onClick={retryFailed} disabled={busy}>
                    <RotateCw className="h-4 w-4" />
                    Retry needs help
                  </Button>
                  <Button size="sm" variant="secondary" onClick={copyFailed}>
                    <Copy className="h-4 w-4" />
                    {copiedFailed ? "Copied" : "Copy needs help"}
                  </Button>
                </>
              )}
              {skippedCount > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setHideSkipped((value) => !value)}
                >
                  <EyeOff className="h-4 w-4" />
                  {hideSkipped ? "Show skipped" : "Hide skipped"}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={clearHistory}>
                <Trash2 className="h-4 w-4" />
                Clear history
              </Button>
            </div>
          </div>
          {visibleJobs.map((job) => (
            <JobRow key={job.id} job={job} onRetry={() => retry(job)} />
          ))}
          {visibleJobs.length === 0 && (
            <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
              Skipped items are hidden.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Live item count vs the user's remaining daily AI allowance, so a big paste
 * warns *before* it burns the quota and fails halfway. Mirrors the server's
 * accounting: a prose paste with no links also spends one use on AI
 * segmentation before the per-item imports.
 */
function BulkQuotaHint({ bulk, aiRemaining }: { bulk: string; aiRemaining: number | null }) {
  if (!bulk.trim()) {
    return aiRemaining != null && aiRemaining <= 3 ? (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Heads up: only {aiRemaining === 0 ? "no" : aiRemaining} AI use
        {aiRemaining === 1 ? "" : "s"} left today — the allowance resets daily.
      </p>
    ) : null;
  }
  const items = dedupeBulkPreview(splitBulkInput(bulk));
  const count = items.length;
  const hasLinks = items.some((item) => item.type === "url" || item.type === "youtube");
  const segmentExtra = !hasLinks && bulk.trim().length > 120 ? 1 : 0;
  const needed = count + segmentExtra;
  const overCap = count > MAX_BULK_ITEMS;
  const overQuota = aiRemaining != null && needed > aiRemaining;
  if (!overCap && !overQuota) {
    return (
      <p className="text-xs text-muted">
        {count} item{count === 1 ? "" : "s"} detected — uses {needed} AI use
        {needed === 1 ? "" : "s"}
        {segmentExtra ? " (1 to split the paste)" : ""}
        {aiRemaining != null
          ? ` of your ${aiRemaining} left today`
          : ""}
      </p>
    );
  }
  return (
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      That looks like {count} item{count === 1 ? "" : "s"}
      {overQuota
        ? ` needing ${needed} AI use${needed === 1 ? "" : "s"}${segmentExtra ? " (1 to split the paste)" : ""}, but you have ${aiRemaining} left today — anything past that will fail. Import the most important ones now and the rest tomorrow.`
        : ` — one paste imports at most ${MAX_BULK_ITEMS}, so split it into batches.`}
    </p>
  );
}

/** Mirror of the server's duplicate-line dedupe so the count matches reality. */
function dedupeBulkPreview<T extends { type: string; value: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.type}:${item.value.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Duplicate-skip rows, as opposed to partial imports that need finishing. */
function isSkippedDuplicate(job: JobView): boolean {
  return job.status === "needs_review" && !isPartialImport(job);
}

/** Partial imports: saved with gaps for the user to finish by hand. */
function isPartialImport(job: JobView): boolean {
  return job.status === "needs_review" && !!job.error?.startsWith("Imported what we could");
}

function JobRow({ job, onRetry }: { job: JobView; onRetry: () => void }) {
  const canOpen = (job.status === "done" || job.status === "needs_review") && job.recipeId;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <StatusIcon job={job} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{job.label || "Recipe"}</p>
        <p className="text-xs text-muted">
          {statusLabel(job)} · {SOURCE_LABEL[job.sourceType] ?? job.sourceType}
          {(job.status === "failed" || job.status === "needs_review") && job.error
            ? ` · ${job.error}`
            : ""}
        </p>
      </div>
      {canOpen && (
        <Link href={`/recipes/${job.recipeId}`}>
          <Button size="sm" variant="secondary">
            {isPartialImport(job) ? "Finish it" : "View"} <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
      {job.status === "failed" && !job.id.startsWith("local-") && (
        <Button size="sm" variant="ghost" onClick={onRetry}>
          <RotateCw className="h-4 w-4" /> Retry
        </Button>
      )}
    </div>
  );
}

function StatusIcon({ job }: { job: JobView }) {
  const status = job.status;
  if (status === "done") return <CheckCircle2 className="h-5 w-5 shrink-0 text-fresh" />;
  if (isPartialImport(job)) return <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />;
  if (status === "needs_review") return <CheckCircle2 className="h-5 w-5 shrink-0 text-muted" />;
  if (status === "failed") return <XCircle className="h-5 w-5 shrink-0 text-red-500" />;
  if (status === "processing")
    return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand" />;
  return <div className="h-5 w-5 shrink-0 rounded-full border-2 border-border" />;
}

function summarizeJobs(jobs: JobView[]) {
  const done = jobs.filter((job) => job.status === "done").length;
  const partial = jobs.filter(isPartialImport).length;
  const skipped = jobs.filter(isSkippedDuplicate).length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const active = jobs.filter((job) => job.status === "pending" || job.status === "processing").length;
  const parts = [`${done} imported`];
  if (partial) parts.push(`${partial} to finish`);
  if (skipped) parts.push(`${skipped} skipped`);
  if (failed) parts.push(`${failed} failed`);
  if (active) parts.push(`${active} working`);
  parts.push(`${jobs.length} total`);
  return parts.join(" · ");
}

function statusLabel(job: JobView) {
  if (job.status === "done") return "Imported";
  if (job.status === "failed") return "Needs help";
  if (job.status === "processing") return "Importing";
  if (isPartialImport(job)) return "Imported with gaps";
  if (job.status === "needs_review") return "Skipped";
  return "Waiting";
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

