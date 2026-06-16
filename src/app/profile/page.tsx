import { getOwnerEmail } from "@/lib/auth";
import { getOrCreateProfile } from "@/lib/repo/profiles";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const owner = await getOwnerEmail();
  const profile = await getOrCreateProfile(owner);

  return (
    <div className="mx-auto max-w-2xl">
      <ProfileForm profile={profile} />
    </div>
  );
}
