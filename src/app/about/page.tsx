import {
  Bot,
  CircleHelp,
  Link2,
  LockKeyhole,
  MessageSquareText,
  Share2,
  Smartphone,
  Sparkles,
} from "lucide-react";

export const metadata = { title: "About" };

const FAQS = [
  {
    question: "What can RecipeDrop import?",
    answer:
      "Regular recipe websites, TikTok, Instagram, Facebook, YouTube, pasted captions, pasted recipe text, and photos or screenshots of recipes. You can also attach your own recipe photo.",
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
    question: "How do I install it on Android?",
    answer:
      "Open RecipeDrop in Chrome, tap the three-dot menu, then choose Install app or Add to Home screen. In-app browsers inside TikTok or Instagram usually cannot install it.",
    icon: Smartphone,
  },
  {
    question: "How does sharing from my phone work?",
    answer:
      "After installing, use the normal Android share sheet from TikTok, Instagram, YouTube, Chrome, or another app and choose RecipeDrop.",
    icon: Share2,
  },
  {
    question: "What about iPhone?",
    answer:
      "iPhones don't offer the share-to-app shortcut, so copy the video's link, open RecipeDrop, and paste it into Import — same result, one extra step. You can still add RecipeDrop to your Home Screen: open it in Safari, tap Share, then Add to Home Screen.",
    icon: Smartphone,
  },
  {
    question: "Who can use this app?",
    answer:
      "Anyone with an invite. Sign in with Google or an emailed magic link — no password to remember. Your profile can have a photo, name, handle, and a public-sharing setting that is off until you turn it on.",
    icon: LockKeyhole,
  },
  {
    question: "What happens to my data?",
    answer:
      "Your recipes, pantry, and plans are private to your account unless you choose to make a recipe public. Photos and data are stored with Supabase, the app's database provider. Want anything exported or your account removed? Message Ralph and it's done.",
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
          you plan meals, print recipes, and build shopping lists from what you saved.
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
