import { getCurrentUserProfileSeed } from "@/lib/auth";
import { getOrCreateProfile } from "@/lib/repo/profiles";
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
    <div className="mx-auto max-w-2xl">
      <ProfileForm profile={profile} email={currentUser.email} />
    </div>
  );
}
