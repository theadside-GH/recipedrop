"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Link2,
  FileText,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCw,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { startImport, runImportJob, importPhotos, type JobView } from "@/app/actions";
import type { ImageInput } from "@/lib/ai/extract";

type Tab = "link" | "bulk" | "photo";

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

export function ImportClient({ aiEnabled }: { aiEnabled: boolean }) {
  const [tab, setTab] = useState<Tab>("link");
  const [single, setSingle] = useState("");
  const [bulk, setBulk] = useState("");
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  function updateJob(updated: JobView) {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
  }

  async function runJobs(toRun: JobView[]) {
    await pool(toRun, 3, async (job) => {
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: "processing" } : j)),
      );
      const result = await runImportJob(job.id);
      if (result) updateJob(result);
    });
  }

  async function handleStart(mode: "single" | "bulk", value: string) {
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      const { jobs: created } = await startImport({ mode, value });
      setJobs((prev) => [...created, ...prev]);
      await runJobs(created);
      if (mode === "single") setSingle("");
      else setBulk("");
    } finally {
      setBusy(false);
    }
  }

  async function retry(job: JobView) {
    await runJobs([job]);
  }

  async function handlePhotos(files: FileList | null) {
    if (!files || !files.length) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const images: ImageInput[] = [];
      for (const file of Array.from(files).slice(0, 5)) {
        const data = await fileToBase64(file);
        images.push({ mediaType: mediaTypeOf(file), data });
      }
      const { recipeId } = await importPhotos(images);
      setJobs((prev) => [
        {
          id: recipeId,
          label: "Photo import",
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
        <div className="space-y-3">
          <Input
            value={single}
            onChange={(e) => setSingle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStart("single", single)}
            placeholder="Paste a recipe link (website or YouTube)…"
            disabled={!aiEnabled}
          />
          <p className="text-center text-xs text-muted">or paste the full recipe text below</p>
          <Textarea
            value={single}
            onChange={(e) => setSingle(e.target.value)}
            placeholder="Paste recipe text, or a TikTok/Instagram caption…"
            disabled={!aiEnabled}
          />
          <Button
            onClick={() => handleStart("single", single)}
            disabled={!aiEnabled || busy || !single.trim()}
            className="w-full"
            size="lg"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Import recipe
          </Button>
        </div>
      )}

      {tab === "bulk" && (
        <div className="space-y-3">
          <Textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={"Paste up to ~20 links and/or recipes at once — one per line or separated by blank lines.\n\nhttps://example.com/recipe-1\nhttps://youtube.com/watch?v=...\n..."}
            className="min-h-48"
            disabled={!aiEnabled}
          />
          <Button
            onClick={() => handleStart("bulk", bulk)}
            disabled={!aiEnabled || busy || !bulk.trim()}
            className="w-full"
            size="lg"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Import all
          </Button>
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
          <h2 className="text-sm font-semibold text-muted">
            {jobs.filter((j) => j.status === "done").length} of {jobs.length} imported
          </h2>
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} onRetry={() => retry(job)} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobRow({ job, onRetry }: { job: JobView; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <StatusIcon status={job.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{job.label || "Recipe"}</p>
        <p className="text-xs text-muted">
          {SOURCE_LABEL[job.sourceType] ?? job.sourceType}
          {job.status === "failed" && job.error ? ` · ${job.error}` : ""}
        </p>
      </div>
      {job.status === "done" && job.recipeId && (
        <Link href={`/recipes/${job.recipeId}`}>
          <Button size="sm" variant="secondary">
            View <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
      {job.status === "failed" && (
        <Button size="sm" variant="ghost" onClick={onRetry}>
          <RotateCw className="h-4 w-4" /> Retry
        </Button>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: JobView["status"] }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 shrink-0 text-fresh" />;
  if (status === "failed") return <XCircle className="h-5 w-5 shrink-0 text-red-500" />;
  if (status === "processing")
    return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand" />;
  return <div className="h-5 w-5 shrink-0 rounded-full border-2 border-border" />;
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function mediaTypeOf(file: File): ImageInput["mediaType"] {
  const t = file.type;
  if (t === "image/png" || t === "image/webp" || t === "image/gif") return t;
  return "image/jpeg";
}
