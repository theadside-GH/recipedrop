"use client";

import { FormEvent, useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { updateProfileAction } from "@/app/actions";
import type { UserProfile } from "@/lib/db/schema";

export function ProfileForm({ profile }: { profile: UserProfile }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    displayName: profile.displayName,
    handle: profile.handle ?? "",
    bio: profile.bio ?? "",
    publicFeedOptIn: profile.publicFeedOptIn,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await updateProfileAction({
        displayName: form.displayName,
        handle: form.handle || null,
        bio: form.bio || null,
        publicFeedOptIn: form.publicFeedOptIn,
      });
      setSaved(true);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted">
          Control how your public recipe drops appear. Recipes stay private unless you mark them public.
        </p>
      </div>

      <label className="space-y-2 block">
        <span className="text-sm font-medium">Display name</span>
        <Input
          value={form.displayName}
          onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
          required
        />
      </label>

      <label className="space-y-2 block">
        <span className="text-sm font-medium">Handle</span>
        <Input
          value={form.handle}
          onChange={(event) => setForm((current) => ({ ...current, handle: event.target.value }))}
          placeholder="ralphcooks"
        />
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
          <span className="block text-sm font-medium">Include me in public discovery</span>
          <span className="block text-xs text-muted">
            Only recipes you mark Public can appear. Private recipes never show in discovery.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={isPending}>
          <Save className="h-5 w-5" />
          {isPending ? "Saving..." : "Save profile"}
        </Button>
        {saved && <span className="text-sm text-muted">Saved.</span>}
      </div>
    </form>
  );
}
