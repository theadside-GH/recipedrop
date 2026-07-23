import Link from "next/link";
import { ClipboardPaste, Share, Smartphone, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

export const metadata = { title: "DishCovered on iPhone" };

/**
 * The iPhone setup guide. iOS Safari has no Web Share Target, so an installed
 * PWA never appears in the share sheet — the fix is an iOS Shortcut that does:
 * share a video → "Save to DishCovered" → lands on /share?url=… and imports.
 */
export default function IosPage() {
  const hasShortcut = env.iosShortcutUrl.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">DishCovered on your iPhone</h1>
        <p className="text-muted">
          Two minutes of setup, and TikTok&apos;s share button saves recipes straight into
          DishCovered — same two taps Android gets.
        </p>
      </section>

      <section className="space-y-3">
        <StepCard n={1} icon={Smartphone} title="Put DishCovered on your Home Screen">
          Open this site in <strong>Safari</strong> → tap <strong>Share</strong> →{" "}
          <strong>Add to Home Screen</strong>. (Optional but nicer — the app opens
          full-screen.)
        </StepCard>

        <StepCard n={2} icon={Wand2} title="Add the “Save to DishCovered” Shortcut">
          {hasShortcut ? (
            <>
              <span className="block">
                One tap: install the Shortcut, and it appears in your share sheet.
              </span>
              <span className="mt-3 block">
                <a href="/shortcut">
                  <Button>
                    <Wand2 className="h-4 w-4" /> Get the Shortcut
                  </Button>
                </a>
              </span>
            </>
          ) : (
            <>
              <span className="block">
                Build it once in the Shortcuts app (comes with every iPhone):
              </span>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5">
                <li>
                  Open <strong>Shortcuts</strong> → tap <strong>+</strong> to make a new
                  shortcut.
                </li>
                <li>
                  Tap the name at the top → <strong>Rename</strong> → call it{" "}
                  <strong>Save to DishCovered</strong>.
                </li>
                <li>
                  Tap the <strong>ⓘ</strong> info button → turn on{" "}
                  <strong>Show in Share Sheet</strong>.
                </li>
                <li>
                  Add the action <strong>URL Encode</strong> (search for it) — it will
                  encode <em>Shortcut Input</em>.
                </li>
                <li>
                  Add the action <strong>Open URLs</strong> and set it to:{" "}
                  <code className="rounded bg-surface px-1.5 py-0.5 text-xs">
                    https://www.dishcovered.app/share?url=
                  </code>{" "}
                  followed by the <strong>URL Encoded Text</strong> variable (tap the
                  field, choose it from the variables bar).
                </li>
                <li>Tap Done. That&apos;s the whole shortcut.</li>
              </ol>
            </>
          )}
        </StepCard>

        <StepCard n={3} icon={Share} title="Save any recipe video">
          In TikTok, Instagram, or YouTube tap <strong>Share</strong> → scroll to{" "}
          <strong>Other</strong> (the iOS share sheet) → <strong>Save to DishCovered</strong>.
          <Sparkles className="mx-1 inline h-3.5 w-3.5 text-brand" />
          The recipe opens here, cleaned up and ready to save.
        </StepCard>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardPaste className="h-4 w-4 text-brand" /> No-setup fallback
        </p>
        <p className="mt-1 text-sm leading-6 text-muted">
          In any app: Share → <strong>Copy link</strong>, then open DishCovered and paste it
          into{" "}
          <Link href="/import" className="font-medium text-brand hover:underline">
            Import
          </Link>
          . Same clean recipe, one extra step.
        </p>
      </section>
    </div>
  );
}

function StepCard({
  n,
  icon: Icon,
  title,
  children,
}: {
  n: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex gap-4 rounded-2xl border border-border bg-card p-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-foreground shadow-sm">
        {n}
      </span>
      <div className="min-w-0 text-sm">
        <p className="flex items-center gap-1.5 font-semibold">
          <Icon className="h-4 w-4 text-brand" /> {title}
        </p>
        <div className="mt-1 leading-6 text-muted">{children}</div>
      </div>
    </article>
  );
}
