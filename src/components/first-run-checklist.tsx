"use client";

import Link from "next/link";
import { ArrowRight, Check, ChefHat, PlusCircle, Sparkles, X, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalSetting } from "@/lib/use-local-setting";

/**
 * A dismissible three-step quickstart for new cooks, shown at the top of Your
 * Recipes until the steps are done (or dismissed). Step completion is real —
 * driven by server data — so it doubles as a progress tracker, not just a
 * banner.
 */
export function FirstRunChecklist({
  hasRecipe,
  hasCooked,
  hasPlan,
}: {
  hasRecipe: boolean;
  hasCooked: boolean;
  hasPlan: boolean;
}) {
  const [dismissed, setDismissed] = useLocalSetting("rd-firstrun-dismissed", "");

  const allDone = hasRecipe && hasCooked && hasPlan;
  if (allDone || dismissed === "1") return null;

  const steps = [
    {
      done: hasRecipe,
      title: "Import your first recipe",
      body: "Paste a TikTok, Instagram, YouTube, or website link — AI turns it into clean steps.",
      href: "/import",
      cta: "Import a recipe",
      icon: PlusCircle,
    },
    {
      done: hasCooked,
      title: "Cook it",
      body: "Open a recipe and tap Start cooking — full-screen steps, timers, and a screen that stays awake.",
      href: "/recipes",
      cta: hasRecipe ? "Open a recipe" : "Import one first",
      icon: ChefHat,
    },
    {
      done: hasPlan,
      title: "Plan your week",
      body: "Add recipes to a plan and get one smart shopping list, grouped by aisle.",
      href: "/plans",
      cta: "Start a plan",
      icon: CalendarRange,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  // The first not-yet-done step is the one we nudge.
  const activeIndex = steps.findIndex((s) => !s.done);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-brand/30 bg-gradient-to-br from-brand-soft via-card to-card p-5 sm:p-6">
      <button
        type="button"
        onClick={() => setDismissed("1")}
        aria-label="Dismiss quickstart"
        className="absolute right-4 top-4 rounded-full p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-brand" />
        <h2 className="text-lg font-semibold">Get started in three steps</h2>
        <span className="text-sm text-muted">{doneCount}/3</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className={cn(
              "flex flex-col rounded-2xl border p-4",
              step.done
                ? "border-fresh/30 bg-fresh-soft"
                : i === activeIndex
                  ? "border-brand bg-card shadow-sm"
                  : "border-border bg-card/60",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  step.done ? "bg-fresh text-white" : "bg-brand-soft text-brand",
                )}
              >
                {step.done ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
              </span>
              <span className={cn("font-medium", step.done && "text-fresh")}>{step.title}</span>
            </div>
            <p className="mt-1.5 flex-1 text-sm text-muted">{step.body}</p>
            {!step.done && (
              <Link
                href={step.href}
                className={cn(
                  "mt-3 inline-flex items-center gap-1 text-sm font-medium",
                  i === activeIndex ? "text-brand hover:underline" : "text-muted hover:text-foreground",
                )}
              >
                {step.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
