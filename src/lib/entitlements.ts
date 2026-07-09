import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiUsageEvent, userProfile } from "@/lib/db/schema";

/**
 * Plan tiers and what they entitle. `paidTier` on user_profile selects the
 * tier ("free" by default); anything unrecognized falls back to free so a bad
 * value can never grant unlimited use. Wire the upgrade flow (Stripe etc.) by
 * setting paidTier — enforcement here picks it up automatically.
 */
export const TIERS = {
  free: { label: "Free", aiUsesPerDay: 10 },
  pro: { label: "Pro", aiUsesPerDay: 200 },
} as const;

export type TierId = keyof typeof TIERS;

export type AiUseKind = "import" | "photo" | "repair" | "segment";

export class QuotaExceededError extends Error {
  constructor(tier: TierId) {
    const t = TIERS[tier];
    super(
      tier === "free"
        ? `You've used all ${t.aiUsesPerDay} AI imports on the Free plan today. More tomorrow — or upgrade for a bigger allowance.`
        : `You've hit today's limit of ${t.aiUsesPerDay} AI imports. It resets tomorrow.`,
    );
    this.name = "QuotaExceededError";
  }
}

async function tierFor(ownerEmail: string): Promise<TierId> {
  const db = await getDb();
  const [row] = await db
    .select({ paidTier: userProfile.paidTier })
    .from(userProfile)
    .where(eq(userProfile.email, ownerEmail))
    .limit(1);
  return row?.paidTier === "pro" ? "pro" : "free";
}

/** AI uses in the past 24h and the user's daily allowance. */
export async function getAiUsage(ownerEmail: string): Promise<{
  tier: TierId;
  used: number;
  limit: number;
}> {
  const db = await getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [tier, [row]] = await Promise.all([
    tierFor(ownerEmail),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(aiUsageEvent)
      .where(and(eq(aiUsageEvent.ownerEmail, ownerEmail), gte(aiUsageEvent.createdAt, since))),
  ]);
  return { tier, used: row?.n ?? 0, limit: TIERS[tier].aiUsesPerDay };
}

/** Postgres 42P01 (undefined_table) — the usage migration hasn't run yet. */
function isMissingTable(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "42P01";
}

/**
 * Gate a metered AI call: throws QuotaExceededError when the user's daily
 * allowance is spent, otherwise records the use. Call right before invoking
 * the model so failed quota checks never cost anything.
 *
 * Fails open if ai_usage_event doesn't exist yet (deploy landed before
 * `npm run db:migrate`) so imports keep working; metering starts once the
 * migration runs.
 */
export async function recordAiUse(ownerEmail: string, kind: AiUseKind): Promise<void> {
  try {
    const { tier, used, limit } = await getAiUsage(ownerEmail);
    if (used >= limit) throw new QuotaExceededError(tier);
    const db = await getDb();
    await db.insert(aiUsageEvent).values({ ownerEmail, kind });
  } catch (err) {
    if (err instanceof QuotaExceededError) throw err;
    if (isMissingTable(err)) {
      console.warn("ai_usage_event table missing — run `npm run db:migrate`. Allowing AI use unmetered.");
      return;
    }
    throw err;
  }
}
