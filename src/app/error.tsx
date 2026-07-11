"use client";

import { useEffect } from "react";
import { ChefHat, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Branded catch-all error screen: a transient database or network hiccup
 * shows "try again" instead of Next's raw crash page.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
        <ChefHat className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-2xl font-bold">Something boiled over</h1>
      <p className="mt-2 text-muted">
        A temporary hiccup stopped this page from loading. It usually clears right up.
      </p>
      <div className="mt-6">
        <Button onClick={reset}>
          <RotateCw className="h-4 w-4" /> Try again
        </Button>
      </div>
    </div>
  );
}
