import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiUsageEvent, collection, mealPlan, userProfile } from "@/lib/db/schema";
import { features } from "@/lib/env";

/**
 * Plan tiers and what they entitle. `paidTier` on user_profile selects the
 * tier ("free" by default); anything unrecognized falls back to free so a bad
 * value can never grant unlimited use. Wire the upgrade flow (Stripe etc.) by
 * setting paidTier — enforcement here picks it up automatically.
 *
 * The aiUsesPerDay cap is always enforced (it protects the shared Anthropic
 * key). Every other limit is dormant until `features.billingEnabled` (Stripe
 * configured), so nothing is locked before there is a way to pay.
 */
export const TIERS = {
  free: {
    label: "Free",
    aiUsesPerDay: 10,
    photoUsesPerDay: 3,
    maxPlans: 2,
    maxCollections: 2,
    publicCollections: false,
  },
  pro: {
    label: "Pro",
    aiUsesPerDay: 200,
    photoUsesPerDay: Infinity,
    maxPlans: Infinity,
    maxCollections: Infinity,
    publicCollections: true,
  },
} as const;

export type TierId = keyof typeof TIERS;

export type AiUseKind = "import" | "photo" | "repair" | "segment" | "plan";

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

export class PhotoQuotaExceededError extends Error {
  constructor(tier: TierId, photoLimit: number) {
    super(
      `Photo imports are limited to ${photoLimit}/day on the ${TIERS[tier].label} plan. Upgrade for unlimited photo imports.`,
    );
    this.name = "PhotoQuotaExceededError";
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
    const tier = await tierFor(ownerEmail);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyLimit = TIERS[tier].aiUsesPerDay;
    const photoLimit = TIERS[tier].photoUsesPerDay;
    const enforcePhoto =
      kind === "photo" && features.billingEnabled && Number.isFinite(photoLimit);

    // Insert first, then count inside the same transaction, and roll back if
    // the insert pushed us over. Counting before inserting is a check-then-act
    // race: the import client runs jobs 3-wide, so parallel calls could all
    // read used=9 and all insert. Insert-then-verify makes the cap exact.
    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx.insert(aiUsageEvent).values({ ownerEmail, kind });

      const [total] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(aiUsageEvent)
        .where(and(eq(aiUsageEvent.ownerEmail, ownerEmail), gte(aiUsageEvent.createdAt, since)));
      if ((total?.n ?? 0) > dailyLimit) throw new QuotaExceededError(tier);

      if (enforcePhoto) {
        const [photos] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(aiUsageEvent)
          .where(
            and(
              eq(aiUsageEvent.ownerEmail, ownerEmail),
              eq(aiUsageEvent.kind, "photo"),
              gte(aiUsageEvent.createdAt, since),
            ),
          );
        if ((photos?.n ?? 0) > (photoLimit as number)) {
          throw new PhotoQuotaExceededError(tier, photoLimit as number);
        }
      }
    });
  } catch (err) {
    if (err instanceof QuotaExceededError || err instanceof PhotoQuotaExceededError) throw err;
    if (isMissingTable(err)) {
      console.warn("ai_usage_event table missing — run `npm run db:migrate`. Allowing AI use unmetered.");
      return;
    }
    throw err;
  }
}

/** Dormant until billing: cap how many meal plans a free user can keep. */
export async function assertCanCreatePlan(ownerEmail: string): Promise<void> {
  if (!features.billingEnabled) return;
  const tier = await tierFor(ownerEmail);
  const max = TIERS[tier].maxPlans;
  if (!Number.isFinite(max)) return;
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(mealPlan)
    .where(eq(mealPlan.ownerEmail, ownerEmail));
  if ((row?.n ?? 0) >= max) {
    throw new Error(
      `The ${TIERS[tier].label} plan allows ${max} meal plans. Delete one, or upgrade for unlimited plans.`,
    );
  }
}

/** Dormant until billing: cap how many collections a free user can keep. */
export async function assertCanCreateCollection(ownerEmail: string): Promise<void> {
  if (!features.billingEnabled) return;
  const tier = await tierFor(ownerEmail);
  const max = TIERS[tier].maxCollections;
  if (!Number.isFinite(max)) return;
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(collection)
    .where(eq(collection.ownerEmail, ownerEmail));
  if ((row?.n ?? 0) >= max) {
    throw new Error(
      `The ${TIERS[tier].label} plan allows ${max} collections. Delete one, or upgrade for unlimited collections.`,
    );
  }
}

/** Dormant until billing: public collections are a Pro feature. */
export async function assertCanPublishCollection(ownerEmail: string): Promise<void> {
  if (!features.billingEnabled) return;
  const tier = await tierFor(ownerEmail);
  if (!TIERS[tier].publicCollections) {
    throw new Error("Sharing whole collections publicly is a Pro feature.");
  }
}
