"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, PackageOpen } from "lucide-react";

interface Result {
  imported: number;
  skipped: number;
  failed: number;
  total: number;
}

/**
 * "Switching from Paprika?" — upload a whole .paprikarecipes export at once.
 * Zero AI quota: the file is already structured.
 */
export function PaprikaImport() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file || busy) return;
    if (file.size > 50 * 1024 * 1024) {
      setError(
        "That export is over 50 MB. In Paprika, export without photos (or in batches) and try again.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/import/paprika", { method: "POST", body });
      const data = (await res.json()) as Result & { error?: string };
      if (!res.ok) throw new Error(data.error || "Import failed.");
      setResult(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <PackageOpen className="h-5 w-5" />
        </span>
        {/* min basis so on phone widths the upload button wraps below instead
            of crushing this text into a sliver column */}
        <div className="min-w-[14rem] flex-1">
          <p className="font-medium">Switching from Paprika?</p>
          <p className="text-sm text-muted">
            Upload your whole export in one go — recipes, photos, categories, and star
            ratings come along. Uses no AI allowance. (Paprika → Settings → Export →
            Paprika Recipe Format.)
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-brand-soft">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {busy ? "Importing…" : "Upload export"}
          <input
            type="file"
            accept=".paprikarecipes,application/zip,application/octet-stream"
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {result && (
        <p className="mt-3 rounded-xl border border-fresh/30 bg-fresh-soft p-3 text-sm text-fresh">
          Imported {result.imported} of {result.total} recipe{result.total === 1 ? "" : "s"}
          {result.skipped > 0 ? ` — ${result.skipped} skipped (already in Your Recipes)` : ""}
          {result.failed > 0 ? ` — ${result.failed} couldn't be read` : ""}.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
