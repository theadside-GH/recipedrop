import type Stripe from "stripe";
import { getStripe } from "@/lib/billing";
import { env } from "@/lib/env";
import { setPaidTier } from "@/lib/repo/profiles";

export const dynamic = "force-dynamic";

/**
 * Stripe → paid_tier. This is the ONLY writer of user_profile.paid_tier:
 * entitlements pick the new tier up automatically (src/lib/entitlements.ts).
 *
 * The auth proxy lets /api/* through, so this route's auth is the webhook
 * signature — requests that don't verify against STRIPE_WEBHOOK_SECRET are
 * rejected before anything is read from them.
 *
 * Users are keyed by email (checkout collects it; subscription events resolve
 * it via the customer record) — no schema change needed, and re-delivered
 * events are naturally idempotent because setPaidTier just overwrites.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !env.stripeWebhookSecret) {
    return Response.json({ error: "Billing not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      env.stripeWebhookSecret,
    );
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const email = session.customer_details?.email ?? session.customer_email;
      if (session.mode === "subscription" && email) {
        await setPaidTier(email.toLowerCase(), "pro");
      }
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      // cancel_at_period_end keeps status "active" until the period lapses —
      // the user keeps what they paid for; the deleted event downgrades them.
      const email = await customerEmail(stripe, sub.customer);
      if (email) {
        if (sub.status === "active" || sub.status === "trialing") {
          await setPaidTier(email, "pro");
        } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
          await setPaidTier(email, "free");
        }
      }
      break;
    }
    case "customer.subscription.deleted": {
      const email = await customerEmail(stripe, event.data.object.customer);
      if (email) await setPaidTier(email, "free");
      break;
    }
    default:
      break;
  }

  return Response.json({ received: true });
}

async function customerEmail(
  stripe: Stripe,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer,
): Promise<string | null> {
  if (typeof customer !== "string") {
    return "deleted" in customer && customer.deleted ? null : (customer.email?.toLowerCase() ?? null);
  }
  const full = await stripe.customers.retrieve(customer);
  return full.deleted ? null : (full.email?.toLowerCase() ?? null);
}
