"use client";

import { useState, useTransition } from "react";
import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportDropAction } from "@/app/actions";

/**
 * Minimal moderation entry point on public drops: expands to an optional
 * reason box, writes a content_report row for the operator to review.
 */
export function ReportDropButton({ recipeId }: { recipeId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <p className="text-sm text-muted">
        Thanks — this drop was reported and will get a look.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <Flag className="h-3.5 w-3.5" />
        Report this drop
      </button>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await reportDropAction(recipeId, reason);
        setSent(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send the report.");
      }
    });
  }

  return (
    <div className="max-w-md space-y-2 rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-medium">Report this drop</p>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="What's wrong? (optional — spam, not a recipe, inappropriate...)"
        rows={2}
        className="w-full rounded-xl border border-border bg-card p-3 text-sm focus:border-brand focus-visible:outline-none"
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
          Send report
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
