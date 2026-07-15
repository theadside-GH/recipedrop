"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChefHat, Loader2, UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markCookedAction, setFollowAction, setFollowByHandleAction } from "@/app/actions";
import { cn } from "@/lib/utils";

/** Send a signed-out tap to /login and back to the page they were on. */
function useSignInGate(signedIn: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  return () => {
    if (signedIn) return false;
    router.push(`/login?next=${encodeURIComponent(pathname)}`);
    return true;
  };
}

/** Follow the dishcoverer behind a public dish. Keyed by recipeId — no emails client-side. */
export function FollowButton({
  recipeId,
  initialFollowing,
  cookName,
  signedIn = true,
}: {
  recipeId: string;
  initialFollowing: boolean;
  cookName?: string | null;
  signedIn?: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();
  const gate = useSignInGate(signedIn);

  function toggle() {
    if (pending || gate()) return;
    startTransition(async () => {
      try {
        const result = await setFollowAction(recipeId, !following);
        setFollowing(result.following);
      } catch {
        // Leave state as-is; the page still works without the follow.
      }
    });
  }

  return (
    <Button type="button" size="lg" variant="secondary" onClick={toggle} disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : following ? (
        <UserCheck className="h-4 w-4" />
      ) : (
        <UserPlus className="h-4 w-4" />
      )}
      {following ? "Following" : `Follow${cookName ? ` ${cookName}` : ""}`}
    </Button>
  );
}

/** "I made this" — one per person per recipe; shows the total. Tap again to undo. */
export function MadeThisButton({
  recipeId,
  initialCooked,
  initialCount,
  signedIn = true,
  iconOnly = false,
  className,
}: {
  recipeId: string;
  initialCooked: boolean;
  initialCount: number;
  signedIn?: boolean;
  /** Compact round form for recipe cards. */
  iconOnly?: boolean;
  className?: string;
}) {
  const [cooked, setCooked] = useState(initialCooked);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  const gate = useSignInGate(signedIn);

  function toggle() {
    if (pending || gate()) return;
    startTransition(async () => {
      try {
        const result = await markCookedAction(recipeId, !cooked);
        setCooked(result.viewerCooked);
        setCount(result.cookedCount);
      } catch {
        // Non-essential; ignore.
      }
    });
  }

  const title = cooked ? "You made this — tap to undo" : "I made this";

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={cooked}
        aria-label={title}
        title={title}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-sm transition-colors hover:bg-surface",
          cooked && "border-fresh/40 bg-fresh-soft text-fresh",
          className,
        )}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ChefHat className={cn("h-4 w-4", cooked && "fill-current")} />
        )}
      </button>
    );
  }

  return (
    <Button
      type="button"
      size="lg"
      variant="secondary"
      onClick={toggle}
      disabled={pending}
      title={title}
      className={cn(cooked && "border-green-200 bg-green-50 text-green-700", className)}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChefHat className="h-4 w-4" />}
      {cooked ? "You made this" : "I made this"}
      {count > 0 && <span className="tabular-nums">· {count}</span>}
    </Button>
  );
}

/** Follow a cook from their public profile page (keyed by handle). */
export function FollowCookButton({
  handle,
  initialFollowing,
}: {
  handle: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    startTransition(async () => {
      try {
        const result = await setFollowByHandleAction(handle, !following);
        setFollowing(result.following);
      } catch {
        // Leave state as-is; the page still works without the follow.
      }
    });
  }

  return (
    <Button type="button" size="lg" variant={following ? "secondary" : "primary"} onClick={toggle} disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : following ? (
        <UserCheck className="h-4 w-4" />
      ) : (
        <UserPlus className="h-4 w-4" />
      )}
      {following ? "Following" : "Follow"}
    </Button>
  );
}
