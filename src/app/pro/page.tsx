import Link from "next/link";
import {
  BadgeCheck,
  Bot,
  CalendarRange,
  Camera,
  CircleHelp,
  Crown,
  FolderOpen,
  HandCoins,
  Share2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { createCheckoutAction, openBillingPortalAction } from "@/app/actions";
import { getViewerEmail } from "@/lib/auth";
import { getProPrice } from "@/lib/billing";
import { TIERS } from "@/lib/entitlements";
import { features } from "@/lib/env";
import { getOrCreateProfile } from "@/lib/repo/profiles";

export const dynamic = "force-dynamic";

export const metadata = { title: "DishCovered Pro" };

export default async function ProPage() {
  const viewer = await getViewerEmail();
  const profile = viewer ? await getOrCreateProfile(viewer) : null;
  const isPro = profile?.paidTier === "pro";
  const price = await getProPrice();

  const priceLine = price
    ? `${price.label} — that's less than one takeout order.`
    : "Final pricing lands at launch — think a couple of takeout coffees a year, not another streaming bill.";

  const faqs = [
    {
      question: "What stays free forever?",
      answer: `Your recipe library, cook mode, meal plans, the merged shopping list, pantry, collections, sharing dishcoveries, and ${TIERS.free.aiUsesPerDay} AI imports every day. DishCovered is useful without paying a cent — Pro just removes the ceilings.`,
      icon: BadgeCheck,
    },
    {
      question: "Why isn't everything free?",
      answer:
        "Every import runs real AI to turn a messy video caption or photo into a clean recipe, and that costs actual money per use. The free plan covers casual cooking; Pro covers heavy importers and keeps the lights on without ads or selling your data.",
      icon: HandCoins,
    },
    {
      question: "What exactly does Pro unlock?",
      answer: `${TIERS.pro.aiUsesPerDay} AI imports a day (vs ${TIERS.free.aiUsesPerDay}), unlimited photo imports (vs ${TIERS.free.photoUsesPerDay}/day), unlimited meal plans and collections (vs ${TIERS.free.maxPlans} and ${TIERS.free.maxCollections}), and public collections — share a whole themed set of dishcoveries with one link.`,
      icon: Crown,
    },
    {
      question: "How much does it cost?",
      answer: priceLine,
      icon: CircleHelp,
    },
    {
      question: "Can I cancel anytime?",
      answer:
        "Yes — one click in the billing portal, no email required, and you keep Pro until the period you already paid for runs out.",
      icon: ShieldCheck,
    },
    {
      question: "What happens to my stuff if I downgrade?",
      answer:
        "Nothing is ever deleted. Extra plans and collections stay readable; the limits only apply to creating new ones. Your recipes are always yours — export the whole library as a file from Profile whenever you like.",
      icon: FolderOpen,
    },
  ];

  const perks = [
    {
      icon: Bot,
      title: `${TIERS.pro.aiUsesPerDay} AI imports a day`,
      text: `Import sprees welcome — the free plan's ${TIERS.free.aiUsesPerDay}/day becomes ${TIERS.pro.aiUsesPerDay}.`,
    },
    {
      icon: Camera,
      title: "Unlimited photo imports",
      text: "Scan the whole family recipe box, not three cards a day.",
    },
    {
      icon: CalendarRange,
      title: "Unlimited meal plans",
      text: "Keep this week, next week, and the holiday menu all going at once.",
    },
    {
      icon: Share2,
      title: "Public collections",
      text: "Share an entire collection — “Sunday pastas”, “Camping food” — with one link.",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand-soft via-background to-background p-6 sm:p-10">
        <Crown
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rotate-12 text-brand opacity-[0.07]"
        />
        <h1 className="max-w-xl text-3xl sm:text-4xl">
          DishCovered Pro — for cooks who Dishcover a lot
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          The free plan is the full app. Pro raises the daily AI allowance and removes the
          caps, so importing your hundredth TikTok feels the same as your first.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <UpgradeCta signedIn={!!viewer} isPro={isPro} />
          {price && (
            <span className="text-sm font-medium text-muted">{price.label}, cancel anytime</span>
          )}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {perks.map((perk) => (
          <article key={perk.title} className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
              <perk.icon className="h-5 w-5" />
            </div>
            <h2 className="font-semibold">{perk.title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{perk.text}</p>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Sparkles className="h-5 w-5 text-brand" />
          Why subscribe — honest answers
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {faqs.map((item) => (
            <article key={item.question} className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{item.question}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6 text-center sm:p-8">
        <h2 className="text-xl font-semibold">Cook more, type less</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Questions the cards didn&apos;t answer? The{" "}
          <Link href="/about" className="font-medium text-brand hover:underline">
            About page
          </Link>{" "}
          covers how importing and sharing work.
        </p>
        <div className="mt-4 flex justify-center">
          <UpgradeCta signedIn={!!viewer} isPro={isPro} />
        </div>
      </section>
    </div>
  );
}

function UpgradeCta({ signedIn, isPro }: { signedIn: boolean; isPro: boolean }) {
  if (isPro) {
    return (
      <form action={openBillingPortalAction} className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
          <Crown className="h-4 w-4" /> You&apos;re on Pro
        </span>
        <Button type="submit" variant="secondary">
          Manage billing
        </Button>
      </form>
    );
  }
  if (!signedIn) {
    return (
      <Link href="/login?next=/pro" className={buttonVariants({ size: "lg" })}>
        Sign in to get started
      </Link>
    );
  }
  if (!features.checkoutEnabled) {
    return (
      <span className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted">
        Pro launches soon — you&apos;ll be able to upgrade right here.
      </span>
    );
  }
  return (
    <form action={createCheckoutAction}>
      <Button type="submit" size="lg">
        <Crown className="h-4 w-4" />
        Upgrade to Pro
      </Button>
    </form>
  );
}
