import Link from "next/link";

export const metadata = { title: "Privacy Policy" };

const SECTIONS: { heading: string; body: React.ReactNode }[] = [
  {
    heading: "What we collect",
    body: (
      <>
        Your account info (email, and the name/photo from Google if you sign in with it),
        the content you add (recipes, photos, plans, pantry items, notes, comments), a
        count of your AI uses (to enforce the daily allowance), and — if you subscribe to
        Pro — billing status. Card numbers go directly to Stripe; we never see or store
        them.
      </>
    ),
  },
  {
    heading: "How we use it",
    body: (
      <>
        To run the app: store your library, build shopping lists, enforce AI quotas, show
        your public dishcoveries to others when you opt in, and manage your subscription.
        That&apos;s it. <strong>No ads, no selling your data, no tracking cookies</strong> —
        the only cookies are the ones that keep you signed in.
      </>
    ),
  },
  {
    heading: "What's public",
    body: (
      <>
        Nothing, until you say so. Recipes are private by default. If you mark a recipe or
        collection public and opt into public dishcovery, that recipe plus your display
        name, handle, bio, and avatar appear on public pages. Comments you post on public
        dishcoveries are visible to others. Your email is never shown publicly.
      </>
    ),
  },
  {
    heading: "Who processes your data",
    body: (
      <>
        A few services make DishCovered work, each receiving only what it needs:{" "}
        <strong>Supabase</strong> (database, sign-in, and photo storage),{" "}
        <strong>Vercel</strong> (hosting), <strong>Anthropic</strong> (the AI that reads
        recipe text and photos during import — API data is not used to train their
        models), and <strong>Stripe</strong> (payments, if you subscribe).
      </>
    ),
  },
  {
    heading: "Your data, your call",
    body: (
      <>
        Export your entire recipe library anytime from{" "}
        <Link href="/profile" className="font-medium text-brand hover:underline">
          Profile
        </Link>
        . Want something corrected or your account and data deleted entirely? Message
        Ralph and it&apos;s done — no dark patterns, no retention tricks. We keep data
        only as long as you have an account.
      </>
    ),
  },
  {
    heading: "Changes and contact",
    body: (
      <>
        If this policy changes in a meaningful way, we&apos;ll note it in the app.
        Questions: message Ralph, who built and runs DishCovered. See also the{" "}
        <Link href="/terms" className="font-medium text-brand hover:underline">
          Terms of Service
        </Link>
        .
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted">Last updated: July 23, 2026</p>
        <p className="max-w-2xl text-muted">
          The short version: your recipes are private by default, we collect only what the
          app needs to work, and we never sell your data or show ads.
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
