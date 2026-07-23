import "server-only";
import Stripe from "stripe";
import { env, features } from "@/lib/env";

/**
 * Stripe wiring for the Pro subscription. Everything here degrades to null
 * when Stripe isn't configured, so pages that mention Pro render fine before
 * the keys exist — same philosophy as the rest of env.ts.
 *
 * Tier state lives on user_profile.paid_tier and is written ONLY by the
 * webhook (src/app/api/stripe/webhook/route.ts) — checkout success pages are
 * user-reachable and must never be trusted to grant entitlements.
 */

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!features.billingEnabled) return null;
  if (!client) client = new Stripe(env.stripeSecretKey);
  return client;
}

export interface ProPrice {
  label: string; // "$34.99/year"
  amount: number; // cents
  currency: string;
  interval: string; // "year" | "month"
}

let cachedPrice: { value: ProPrice | null; at: number } | null = null;

/**
 * The live Pro price, straight from the dashboard so the FAQ and upgrade
 * buttons never show a stale hardcoded number. Cached for an hour; null when
 * Stripe or the price id isn't configured (or the lookup fails).
 */
export async function getProPrice(): Promise<ProPrice | null> {
  const stripe = getStripe();
  if (!stripe || !env.stripePriceId) return null;
  if (cachedPrice && Date.now() - cachedPrice.at < 60 * 60 * 1000) return cachedPrice.value;
  try {
    const price = await stripe.prices.retrieve(env.stripePriceId);
    const amount = price.unit_amount ?? 0;
    const currency = price.currency ?? "usd";
    const interval = price.recurring?.interval ?? "year";
    const money = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
    const value: ProPrice = { label: `${money}/${interval}`, amount, currency, interval };
    cachedPrice = { value, at: Date.now() };
    return value;
  } catch (err) {
    console.warn("Stripe price lookup failed:", err instanceof Error ? err.message : err);
    cachedPrice = { value: null, at: Date.now() };
    return null;
  }
}

/** The Stripe customer for an email, or null if they've never checked out. */
export async function findCustomerByEmail(email: string): Promise<Stripe.Customer | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const { data } = await stripe.customers.list({ email, limit: 1 });
  return data[0] ?? null;
}
