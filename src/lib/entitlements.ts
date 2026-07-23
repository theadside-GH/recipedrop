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
 * The AI-use cap is always enforced (it protects the shared Anthropic key);
 * free meters over a rolling week, pro over a rolling day. Every other limit
 * is dormant until `features.billingEnabled` (Stripe configured), so nothing
 * is locked before there is a way to pay.
 */
export const TIERS = {
  free: {
    label: "Free",
    /** AI uses allowed per window (imports, photo scans, repairs, autopilot). */
    aiUses: 10,
    /** Size of the metering window in days: free refills weekly. */
    aiWindowDays: 7,
    aiWindowLabel: "week",
    photoUses: 3,
    maxPlans: 2,
    maxCollections: 2,
    publicCollections: false,
    canComment: false,
  },
  pro: {
    label: "Pro",
    aiUses: 200,
    aiWindowDays: 1,
    aiWindowLabel: "day",
    photoUses: Infinity,
    maxPlans: Infinity,
    maxCollections: Infinity,
    publicCollections: true,
    canComment: true,
  },
} as const;

export type TierId = keyof typeof TIERS;

export type AiUseKind = "import" | "photo" | "repair" | "segment" | "plan";

export class QuotaExceededError extends Error {
  constructor(tier: TierId) {
    const t = TIERS[tier];
    super(
      tier === "free"
        ? `You've used all ${t.aiUses} AI imports on the Free plan this ${t.aiWindowLabel}. Upgrade to Pro for ${TIERS.pro.aiUses} a day — or check back next ${t.aiWindowLabel}.`
        : `You've hit today's limit of ${t.aiUses} AI imports. It resets tomorrow.`,
    );
    this.name = "QuotaExceededError";
  }
}

export class PhotoQuotaExceededError extends Error {
  constructor(tier: TierId, photoLimit: number) {
    const t = TIERS[tier];
    super(
      `Photo imports are limited to ${photoLimit}/${t.aiWindowLabel} on the ${t.label} plan. Upgrade for unlimited photo imports.`,
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

/** The viewer's tier, for badges and UI gating. Fails soft to "free". */
export async function getTier(ownerEmail: string): Promise<TierId> {
  try {
    return await tierFor(ownerEmail);
  } catch {
    return "free";
  }
}

function windowStart(tier: TierId): Date {
  return new Date(Date.now() - TIERS[tier].aiWindowDays * 24 * 60 * 60 * 1000);
}

/** AI uses in the tier's current window and the allowance for it. */
export async function getAiUsage(ownerEmail: string): Promise<{
  tier: TierId;
  used: number;
  limit: number;
  /** "week" for free, "day" for pro — for copy like "AI uses this week". */
  windowLabel: string;
}> {
  const db = await getDb();
  const tier = await tierFor(ownerEmail);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(aiUsageEvent)
    .where(
      and(eq(aiUsageEvent.ownerEmail, ownerEmail), gte(aiUsageEvent.createdAt, windowStart(tier))),
    );
  return {
    tier,
    used: row?.n ?? 0,
    limit: TIERS[tier].aiUses,
    windowLabel: TIERS[tier].aiWindowLabel,
  };
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
    const since = windowStart(tier);
    const dailyLimit = TIERS[tier].aiUses;
    const photoLimit = TIERS[tier].photoUses;
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

/** Dormant until billing: commenting on dishcoveries is a Pro perk. */
export async function assertCanComment(ownerEmail: string): Promise<void> {
  if (!features.billingEnabled) return;
  const tier = await tierFor(ownerEmail);
  if (!TIERS[tier].canComment) {
    throw new Error("Commenting on dishcoveries is a Pro perk. Upgrade to join the conversation.");
  }
}

/** True when the viewer may comment (mirrors assertCanComment for UI gating). */
export async function canCommentNow(ownerEmail: string): Promise<boolean> {
  if (!features.billingEnabled) return true;
  return TIERS[await getTier(ownerEmail)].canComment;
}
