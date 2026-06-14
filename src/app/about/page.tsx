import { Bot, CircleHelp, Link2, LockKeyhole, MessageSquareText, Sparkles } from "lucide-react";

const FAQS = [
  {
    question: "What can RecipeDrop import?",
    answer:
      "Regular recipe websites, TikTok, Instagram, Facebook, YouTube, pasted captions, pasted recipe text, and photos or screenshots of recipes.",
    icon: Link2,
  },
  {
    question: "Why do some social posts need extra help?",
    answer:
      "TikTok, Instagram, and Facebook sometimes hide captions, comments, or linked recipe details from normal web access. RecipeDrop uses what the page exposes, then turns that into a clean recipe.",
    icon: MessageSquareText,
  },
  {
    question: "What happens in bulk import?",
    answer:
      "Each link or recipe is handled separately. Good items are saved, duplicates are skipped, and failures stay visible with their own retry button.",
    icon: Sparkles,
  },
  {
    question: "Can it see recipe links in TikTok comments?",
    answer:
      "Not reliably. Social comments are not consistently available through normal public web access. Screenshots or pasted comment text are the dependable fallback.",
    icon: CircleHelp,
  },
  {
    question: "Who can use this app?",
    answer:
      "This deployment is owner-only. The recipe database and imports are protected behind your sign-in.",
    icon: LockKeyhole,
  },
  {
    question: "What does the AI do?",
    answer:
      "It extracts ingredients, steps, timing, servings, meal type, tags, and shopping-list-friendly ingredient names from messy source material.",
    icon: Bot,
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">About RecipeDrop</h1>
        <p className="max-w-3xl text-muted">
          RecipeDrop turns messy recipe sources into a clean personal recipe library, then helps
          you plan meals and build shopping lists from what you saved.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FAQS.map((item) => (
          <article key={item.question} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="font-semibold">{item.question}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{item.answer}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
