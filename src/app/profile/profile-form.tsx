"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Save, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { updateProfileAction } from "@/app/actions";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { imageFileToDataUrl } from "@/lib/client-image";
import type { UserProfile } from "@/lib/db/schema";

export function ProfileForm({ profile, email }: { profile: UserProfile; email: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [signingOut, startSignOutTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleLocked = !!profile.handle && !!profile.handleChangedAt;
  const [form, setForm] = useState({
    displayName: profile.displayName,
    handle: profile.handle ?? "",
    avatarUrl: profile.avatarUrl ?? "",
    bio: profile.bio ?? "",
    publicFeedOptIn: profile.publicFeedOptIn,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    setError(null);
    startTransition(async () => {
      try {
        await updateProfileAction({
          displayName: form.displayName,
          handle: form.handle || null,
          avatarUrl: form.avatarUrl || null,
          bio: form.bio || null,
          publicFeedOptIn: form.publicFeedOptIn,
        });
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Profile did not save.");
      }
    });
  }

  async function chooseAvatar(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await imageFileToDataUrl(file, { maxSize: 480, quality: 0.85 });
      setForm((current) => ({ ...current, avatarUrl: dataUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image.");
    }
  }

  function signOut() {
    startSignOutTransition(async () => {
      const supabase = getBrowserSupabase();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="mt-1 text-sm text-muted">
            Signed in as <strong className="font-medium text-foreground">{email}</strong>
          </p>
          <p className="mt-1 text-sm text-muted">
            Control how your public dishcoveries appear. Recipes stay private unless you mark them public.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={signOut} disabled={signingOut}>
          {signingOut ? "Signing out..." : "Sign out"}
        </Button>
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card">
          {form.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <User className="h-7 w-7 text-muted" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <span className="text-sm font-medium">Profile picture</span>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-brand-soft">
            <ImagePlus className="h-4 w-4" />
            Choose photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => chooseAvatar(event.target.files?.[0])}
            />
          </label>
          <p className="text-xs text-muted">
            If you signed in with Google, your Google profile photo is used until you choose a different one.
          </p>
        </div>
      </div>

      <label className="space-y-2 block">
        <span className="text-sm font-medium">Name</span>
        <Input
          value={form.displayName}
          onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
          required
        />
        <p className="text-xs text-muted">
          Shown on your public profile. Once you have a handle, dishcoveries are credited to it instead.
        </p>
      </label>

      <label className="space-y-2 block">
        <span className="text-sm font-medium">Handle</span>
        <Input
          value={form.handle}
          onChange={(event) => setForm((current) => ({ ...current, handle: event.target.value }))}
          placeholder="ralphcooks"
          disabled={handleLocked}
        />
        <p className="text-xs text-muted">
          {handleLocked
            ? "Your handle is locked. You already used your one handle change."
            : profile.handle
              ? "You can change your handle one more time. After that it locks."
              : "Choose carefully. After you change a saved handle once, it locks."}
        </p>
      </label>

      <label className="space-y-2 block">
        <span className="text-sm font-medium">Bio</span>
        <Textarea
          value={form.bio}
          onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
          rows={4}
        />
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
        <input
          type="checkbox"
          checked={form.publicFeedOptIn}
          onChange={(event) =>
            setForm((current) => ({ ...current, publicFeedOptIn: event.target.checked }))
          }
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="block text-sm font-medium">Include me in public dishcovery</span>
          <span className="block text-xs text-muted">
            Only recipes you mark Public can appear. Private recipes never show in dishcovery.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={isPending}>
          <Save className="h-5 w-5" />
          {isPending ? "Saving..." : "Save profile"}
        </Button>
        {saved && <span className="text-sm text-muted">Saved.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
