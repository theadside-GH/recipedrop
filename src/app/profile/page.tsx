import { Download } from "lucide-react";
import { getCurrentUserProfileSeed } from "@/lib/auth";
import { getOrCreateProfile } from "@/lib/repo/profiles";
import { buttonVariants } from "@/components/ui/button";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const currentUser = await getCurrentUserProfileSeed();
  const profile = await getOrCreateProfile(currentUser.email, {
    displayName: currentUser.displayName,
    avatarUrl: currentUser.avatarUrl,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <ProfileForm profile={profile} email={currentUser.email} />

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
