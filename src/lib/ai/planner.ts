import "server-only";
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic } from "./client";
import { MODELS } from "@/lib/env";

export interface PlannerRecipe {
  id: string;
  title: string;
  mealType: string;
  totalMinutes: number | null;
  /** Canonical ingredient names (capped) so the planner can match the pantry. */
  ingredients: string[];
}

export interface PlannerArgs {
  recipes: PlannerRecipe[];
  pantry: string[];
  leftovers: string[];
  nights: number;
  quickMeals: number;
  usePantry: boolean;
}

export interface PlannerResult {
  name: string;
  recipeIds: string[];
}

const plannerSchema = z.object({
  name: z.string(),
  picks: z.array(
    z.object({
      recipeId: z.string(),
      reason: z.string(),
    }),
  ),
});

const PLANNER_SYSTEM = `You are a practical weekly dinner planner for a home cook.

You are given the cook's saved recipes (id, title, meal type, total minutes, key ingredients), what's in their pantry, their leftovers, and constraints. Pick recipes for the week.

Rules:
- Pick EXACTLY the requested number of recipes. Use only recipeIds from the provided list — never invent ids.
- Prefer dinner-type recipes unless the library is too small; never pick the same recipe twice.
- Respect the quick-meal count: that many picks must have total minutes of 30 or less (when the library allows).
- When asked to use up the pantry/leftovers, strongly prefer recipes whose ingredients overlap what's on hand — leftovers first, they spoil.
- Vary the week: avoid picking near-identical dishes (e.g. three pasta bakes).
- name: a short, friendly plan name for this week (e.g. "Cozy week, pantry edition"). No quotes or emoji.
- reason: one short phrase for why the pick fits (used for logging only).`;

/** Ask the model to plan the week from the user's own library. */
export async function planWeek(args: PlannerArgs): Promise<PlannerResult> {
  const client = getAnthropic();

  const recipeLines = args.recipes
    .map(
      (r) =>
        `${r.id} | ${r.title} | ${r.mealType} | ${r.totalMinutes ?? "?"} min | ${r.ingredients.join(", ") || "-"}`,
    )
    .join("\n");
  const userText = [
    `Plan ${args.nights} dinners. ${args.quickMeals} of them must be quick (<= 30 minutes).`,
    args.usePantry
      ? `Use up what's on hand where possible.\nPantry: ${args.pantry.join(", ") || "-"}\nLeftovers: ${args.leftovers.join(", ") || "-"}`
      : "Ignore the pantry; just plan a balanced, varied week.",
    `Saved recipes (id | title | meal type | minutes | key ingredients):\n${recipeLines}`,
  ].join("\n\n");

  const message = await client.messages.parse({
    model: MODELS.text,
    max_tokens: 2000,
    system: [{ type: "text", text: PLANNER_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userText }],
    output_config: { format: zodOutputFormat(plannerSchema) },
  });

  const parsed = message.parsed_output;
  if (!parsed || parsed.picks.length === 0) {
    throw new Error("The planner could not put a week together. Try again.");
  }
  return {
    name: parsed.name.trim() || "This week's plan",
    recipeIds: parsed.picks.map((p) => p.recipeId),
  };
}
