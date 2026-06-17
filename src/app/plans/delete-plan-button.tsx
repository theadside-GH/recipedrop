"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deletePlanAction } from "@/app/actions";
import { cn } from "@/lib/utils";

export function DeletePlanButton({ planId, planName }: { planId: string; planName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function deletePlan() {
    if (!confirming) {
      setConfirming(true);
      window.setTimeout(() => setConfirming(false), 3000);
      return;
    }

    startTransition(async () => {
      await deletePlanAction(planId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={deletePlan}
      disabled={isPending}
      aria-label={`Delete ${planName}`}
      className={cn(
        "flex h-10 shrink-0 items-center justify-center rounded-full border px-3 text-sm font-medium transition-colors disabled:opacity-60",
        confirming
          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
          : "border-border bg-surface text-muted hover:border-red-200 hover:text-red-600",
      )}
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      <span className="ml-2 hidden sm:inline">{confirming ? "Confirm" : "Delete"}</span>
    </button>
  );
}
