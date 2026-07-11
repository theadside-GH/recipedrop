"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clipboard,
  Loader2,
  RotateCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { startImport, runImportJob, type JobView } from "@/app/actions";
import type { SourceType } from "@/lib/sources/types";

const SOURCE_LABEL: Record<SourceType, string> = {
  url: "Website",
  youtube: "YouTube",
  text: "Text",
  photo: "Photo",
};

export function ShareCaptureClient({
  aiEnabled,
  initialValue,
  initialSourceType,
}: {
  aiEnabled: boolean;
  initialValue: string;
  initialSourceType: SourceType | null;
}) {
  const [value, setValue] = useState(initialValue);
  const [job, setJob] = useState<JobView | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const importValue = useCallback(async (nextValue = value) => {
    if (!nextValue.trim() || busy || !aiEnabled) return;
    setBusy(true);
    try {
      const { jobs } = await startImport({ mode: "single", value: nextValue });
      const created = jobs[0];
      setJob(created);
      if (!created) return;
      setJob({ ...created, status: "processing" });
      const result = await runImportJob(created.id);
      if (result) setJob(result);
    } catch (err) {
      // Never fail silently — the user just shared a recipe and is watching.
      setJob({
        id: "local-share-error",
        label: nextValue.trim().slice(0, 80) || "Shared recipe",
        rawInput: nextValue,
        sourceType: "text",
        status: "failed",
        error:
          err instanceof Error && err.message
            ? err.message
            : "Import could not start — check your connection and try again.",
        recipeId: null,
      });
    } finally {
      setBusy(false);
    }
  }, [aiEnabled, busy, value]);

  useEffect(() => {
    if (started.current || !initialValue.trim() || !aiEnabled) return;
    started.current = true;
    void importValue(initialValue);
  }, [aiEnabled, importValue, initialValue]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Clipboard className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {initialValue ? "Shared recipe captured" : "Paste a recipe link or caption"}
            </p>
            <p className="text-sm text-muted">
              {initialSourceType
                ? SOURCE_LABEL[initialSourceType]
                : "TikTok, Instagram, Facebook, YouTube, websites, or recipe text"}
            </p>
          </div>
        </div>

        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-4 min-h-28"
          placeholder="Paste a link, caption, or recipe text..."
          disabled={!aiEnabled || busy}
        />

        <Button
          onClick={() => importValue()}
          disabled={!aiEnabled || busy || !value.trim()}
          className="mt-3 w-full"
          size="lg"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Import this recipe
        </Button>
      </div>

      {job && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <StatusIcon status={job.status} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{job.label || "Recipe"}</p>
            <p className="text-xs text-muted">
              {(job.status === "failed" || job.status === "needs_review") && job.error
                ? job.error
                : SOURCE_LABEL[job.sourceType]}
            </p>
          </div>
          {(job.status === "done" || job.status === "needs_review") && job.recipeId && (
            <Link href={`/recipes/${job.recipeId}`}>
              <Button size="sm" variant="secondary">
                View <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
          {job.status === "failed" && (
            <Button size="sm" variant="ghost" onClick={() => importValue(value)}>
              <RotateCw className="h-4 w-4" /> Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: JobView["status"] }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 shrink-0 text-fresh" />;
  if (status === "needs_review") return <CheckCircle2 className="h-5 w-5 shrink-0 text-muted" />;
  if (status === "failed") return <XCircle className="h-5 w-5 shrink-0 text-red-500" />;
  if (status === "processing")
    return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand" />;
  return <div className="h-5 w-5 shrink-0 rounded-full border-2 border-border" />;
}
