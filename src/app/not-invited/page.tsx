import type { Metadata } from "next";
import Link from "next/link";
import { ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Invite only" };

/**
 * Where signed-in accounts that aren't on the INVITE_EMAILS list land. They
 * can still browse everything public — the app itself is friends-only while
 * it grows.
 */
export default function NotInvitedPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
        <ChefHat className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-2xl font-bold">RecipeDrop is invite-only right now</h1>
      <p className="mt-2 text-muted">
        You&apos;re signed in, but this kitchen is friends-and-family for the moment. Ask
        the person who shared RecipeDrop with you to add your email — then everything
        just works.
      </p>
      <p className="mt-2 text-sm text-muted">
        You can still browse the public recipes on Discover in the meantime.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/discover">
          <Button variant="secondary">Browse Discover</Button>
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}
