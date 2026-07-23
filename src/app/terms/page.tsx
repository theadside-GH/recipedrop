import Link from "next/link";

export const metadata = { title: "Terms of Service" };

/**
 * Plain-language terms for a small indie app. Sections are intentionally
 * short — the point is honesty and clarity, not legal maximalism.
 */
const SECTIONS: { heading: string; body: React.ReactNode }[] = [
  {
    heading: "1. What DishCovered is",
    body: (
      <>
        DishCovered turns recipes from links, text, and photos into a personal recipe
        library, with meal planning, shopping lists, and optional public sharing. By
        creating an account or using the app you agree to these terms. If you don&apos;t
        agree, please don&apos;t use DishCovered.
      </>
    ),
  },
  {
    heading: "2. Your account",
    body: (
      <>
        You sign in with Google or an emailed magic link. Keep your account to yourself —
        you&apos;re responsible for what happens under it. You must be old enough to have
        an account under the laws where you live.
      </>
    ),
  },
  {
    heading: "3. Your content",
    body: (
      <>
        Recipes, notes, plans, and photos you add are yours. You give us permission to
        store and display them so the app can work. Everything you add is{" "}
        <strong>private by default</strong> — it only appears publicly if you mark a
        recipe or collection public, and you can flip it back anytime. When you import
        from a website or social post, you&apos;re responsible for having the right to
        save that content for personal use; public dishcoveries credit the source link.
      </>
    ),
  },
  {
    heading: "4. Acceptable use",
    body: (
      <>
        Don&apos;t abuse the service: no unlawful content, no harassment in comments, no
        attempts to break or overload the app, no scraping other people&apos;s data, and
        no reselling or automating the AI import features. We can hide public content
        that&apos;s reported, and suspend accounts that break these rules.
      </>
    ),
  },
  {
    heading: "5. AI features",
    body: (
      <>
        Recipe extraction, repair, and plan autopilot use AI and are metered with a daily
        allowance that depends on your plan. AI output can contain mistakes — double-check
        anything safety-critical, like cooking temperatures and allergen information.
      </>
    ),
  },
  {
    heading: "6. Subscriptions",
    body: (
      <>
        The free plan is the full app with a daily AI allowance.{" "}
        <Link href="/pro" className="font-medium text-brand hover:underline">
          DishCovered Pro
        </Link>{" "}
        is an optional subscription billed through Stripe. You can cancel anytime from the
        billing portal; Pro stays active until the end of the period you paid for.
        Downgrading never deletes your data.
      </>
    ),
  },
  {
    heading: "7. The service is provided as-is",
    body: (
      <>
        DishCovered is a small independent app. We work hard to keep it reliable, but
        it&apos;s provided <em>as is</em>, without warranties, and we may change or
        discontinue features. To the extent the law allows, our total liability to you is
        limited to the amount you paid us in the twelve months before a claim. You can
        export your full library anytime from your Profile.
      </>
    ),
  },
  {
    heading: "8. Ending things",
    body: (
      <>
        You can stop using DishCovered anytime — export your data from Profile first, and
        message Ralph to have your account and data deleted. We may suspend accounts that
        violate these terms.
      </>
    ),
  },
  {
    heading: "9. Changes and contact",
    body: (
      <>
        If these terms change in a meaningful way, we&apos;ll note it in the app. Questions
        or requests: message Ralph — the person who built and runs DishCovered.
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-muted">Last updated: July 23, 2026</p>
        <p className="max-w-2xl text-muted">
          The short version: your recipes are yours, be decent to other dishcoverers, AI
          imports are metered, and Pro is optional and cancelable anytime. The longer
          version follows. See also the{" "}
          <Link href="/privacy" className="font-medium text-brand hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>

      <section className="space-y-6">
        {SECTIONS.map((s) => (
          <article key={s.heading}>
            <h2 className="font-semibold">{s.heading}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{s.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
