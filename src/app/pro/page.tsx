import Link from "next/link";
import {
  BadgeCheck,
  Bot,
  CalendarRange,
  Camera,
  Check,
  CircleHelp,
  Crown,
  FolderOpen,
  HandCoins,
  MessageCircle,
  Minus,
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
      answer: `Your recipe library, cook mode, meal plans, the merged shopping list, pantry, saving and sharing dishcoveries, and ${TIERS.free.aiUses} AI imports every ${TIERS.free.aiWindowLabel}. DishCovered is useful without paying a cent — Pro removes the ceilings.`,
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
      answer: `${TIERS.pro.aiUses} AI imports a day (the free plan gets ${TIERS.free.aiUses} a week), unlimited photo imports, unlimited meal plans and collections, public collections you can share with one link, and commenting on dishcoveries.`,
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
      title: `${TIERS.pro.aiUses} AI imports a day`,
      text: `Import sprees welcome — the free plan's ${TIERS.free.aiUses} a week becomes ${TIERS.pro.aiUses} a day.`,
    },
    {
      icon: Camera,
      title: "Unlimited photo imports",
      text: "Scan the whole family recipe box, not a few cards a week.",
    },
    {
      icon: CalendarRange,
      title: "Unlimited meal plans & collections",
      text: "Keep this week, next week, and the holiday menu all going at once.",
    },
    {
      icon: Share2,
      title: "Public collections",
      text: "Share an entire collection — “Sunday pastas”, “Camping food” — with one link.",
    },
    {
      icon: MessageCircle,
      title: "Comment on dishcoveries",
      text: "Tips, swaps, and how it turned out — join the thread on any shared dish.",
    },
    {
      icon: HandCoins,
      title: "Keep it indie",
      text: "Pro is what keeps DishCovered ad-free, tracker-free, and independent.",
    },
  ];

  const comparison: { feature: string; free: string | boolean; pro: string | boolean }[] = [
    { feature: "Recipe library, cook mode & shopping list", free: true, pro: true },
    { feature: "Meal plans & pantry", free: true, pro: true },
    { feature: "AI recipe imports", free: `${TIERS.free.aiUses}/${TIERS.free.aiWindowLabel}`, pro: `${TIERS.pro.aiUses}/${TIERS.pro.aiWindowLabel}` },
    { feature: "Photo scans", free: `${TIERS.free.photoUses}/${TIERS.free.aiWindowLabel}`, pro: "Unlimited" },
    { feature: "Meal plans you can keep", free: `${TIERS.free.maxPlans}`, pro: "Unlimited" },
    { feature: "Collections", free: `${TIERS.free.maxCollections}`, pro: "Unlimited" },
    { feature: "Public collections", free: false, pro: true },
    { feature: "Commenting on dishcoveries", free: false, pro: true },
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
          The free plan is the full app with {TIERS.free.aiUses} AI imports a{" "}
          {TIERS.free.aiWindowLabel}. Pro makes it {TIERS.pro.aiUses} a{" "}
          {TIERS.pro.aiWindowLabel} and unlocks everything else — so importing your
          hundredth TikTok feels the same as your first.
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

      <section className="overflow-hidden rounded-3xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/60 text-left">
              <th className="px-5 py-3.5 font-semibold">What you get</th>
              <th className="w-28 px-3 py-3.5 text-center font-semibold">Free</th>
              <th className="w-28 px-3 py-3.5 text-center font-semibold text-brand">
                <span className="inline-flex items-center gap-1">
                  <Crown className="h-4 w-4" /> Pro
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((row) => (
              <tr key={row.feature} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3 text-muted">{row.feature}</td>
                <td className="px-3 py-3 text-center">
                  <Cell value={row.free} />
                </td>
                <td className="px-3 py-3 text-center font-medium text-foreground">
                  <Cell value={row.pro} pro />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

function Cell({ value, pro = false }: { value: string | boolean; pro?: boolean }) {
  if (value === true) return <Check className={pro ? "mx-auto h-4 w-4 text-brand" : "mx-auto h-4 w-4 text-fresh"} />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-border" />;
  return <>{value}</>;
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
