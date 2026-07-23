import Link from "next/link";
import { Crown, Download } from "lucide-react";
import { getCurrentUserProfileSeed } from "@/lib/auth";
import { getOrCreateProfile } from "@/lib/repo/profiles";
import { Button, buttonVariants } from "@/components/ui/button";
import { createCheckoutAction, openBillingPortalAction } from "@/app/actions";
import { TIERS } from "@/lib/entitlements";
import { features } from "@/lib/env";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Profile" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const sp = await searchParams;
  const currentUser = await getCurrentUserProfileSeed();
  const profile = await getOrCreateProfile(currentUser.email, {
    displayName: currentUser.displayName,
    avatarUrl: currentUser.avatarUrl,
  });
  const isPro = profile.paidTier === "pro";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <ProfileForm profile={profile} email={currentUser.email} />

      <section
        className={
          isPro
            ? "space-y-3 rounded-2xl border border-brand/40 bg-gradient-to-br from-brand-soft via-card to-card p-5 sm:p-6"
            : "space-y-3 rounded-2xl border border-border bg-card p-5 sm:p-6"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Your plan</h2>
            <p className="mt-1 text-sm text-muted">
              {isPro
                ? `Pro — ${TIERS.pro.aiUses} AI imports a day, unlimited photo imports, plans, and collections, plus commenting and public collections.`
                : `Free — ${TIERS.free.aiUses} AI imports a week. Pro raises that to ${TIERS.pro.aiUses} a day and unlocks the rest.`}
            </p>
          </div>
          <span
            className={
              isPro
                ? "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-brand to-amber-500 px-3 py-1 text-sm font-bold uppercase tracking-wide text-white shadow-sm"
                : "inline-flex shrink-0 items-center rounded-full border border-border bg-surface px-3 py-1 text-sm font-semibold text-muted"
            }
          >
            {isPro && <Crown className="h-4 w-4" />} {isPro ? "Pro" : "Free"}
          </span>
        </div>
        {sp.upgraded === "1" && !isPro && (
          <p className="rounded-xl border border-brand/25 bg-brand-soft p-3 text-sm">
            Payment received — Pro switches on within a few seconds. Refresh this page if the
            badge hasn&apos;t appeared yet.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {isPro ? (
            <form action={openBillingPortalAction}>
              <Button type="submit" variant="secondary">
                Manage billing
              </Button>
            </form>
          ) : features.checkoutEnabled ? (
            <form action={createCheckoutAction}>
              <Button type="submit">
                <Crown className="h-4 w-4" /> Upgrade to Pro
              </Button>
            </form>
          ) : null}
          <Link href="/pro" className="text-sm font-medium text-brand hover:underline">
            {isPro ? "What Pro includes" : "See what Pro includes →"}
          </Link>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Your recipes, exported</h2>
          <p className="mt-1 text-sm text-muted">
            Download all your recipes as a file. It&apos;s yours to keep.
          </p>
        </div>
        <a
          href="/api/export"
          download
          className={buttonVariants({ variant: "secondary" })}
        >
          <Download className="h-4 w-4" />
          Export my recipes
        </a>
      </section>
    </div>
  );
}
