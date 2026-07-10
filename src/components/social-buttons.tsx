"use client";

import { useState, useTransition } from "react";
import { ChefHat, Loader2, UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markCookedAction, setFollowAction, setFollowByHandleAction } from "@/app/actions";
import { cn } from "@/lib/utils";

/** Follow the cook behind a public drop. Keyed by recipeId — no emails client-side. */
export function FollowButton({
  recipeId,
  initialFollowing,
  cookName,
}: {
  recipeId: string;
  initialFollowing: boolean;
  cookName?: string | null;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
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

/** "I made this" — one per person per recipe; shows the total. */
export function MadeThisButton({
  recipeId,
  initialCooked,
  initialCount,
}: {
  recipeId: string;
  initialCooked: boolean;
  initialCount: number;
}) {
  const [cooked, setCooked] = useState(initialCooked);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  function mark() {
    if (pending || cooked) return;
    startTransition(async () => {
      try {
        const result = await markCookedAction(recipeId);
        setCooked(result.viewerCooked);
        setCount(result.cookedCount);
      } catch {
        // Non-essential; ignore.
      }
    });
  }

  return (
    <Button
      type="button"
      size="lg"
      variant="secondary"
      onClick={mark}
      disabled={pending || cooked}
      className={cn(cooked && "border-green-200 bg-green-50 text-green-700 disabled:opacity-100")}
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
