"use client";

import { useState } from "react";
import { BellRing, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinProWaitlistAction } from "@/app/actions";

/** Email capture shown while checkout is dormant, so ready-to-pay interest
 *  isn't lost to a dead end. */
export function NotifyMe({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || state === "busy") return;
    setState("busy");
    setMessage(null);
    const result = await joinProWaitlistAction(email);
    setMessage(result.message);
    setState(result.ok ? "done" : "idle");
  }

  if (state === "done") {
    return (
      <p className="inline-flex items-center gap-2 rounded-full border border-fresh/30 bg-fresh-soft px-4 py-2 text-sm font-medium text-fresh">
        <Check className="h-4 w-4" /> {message}
      </p>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <BellRing className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="you@example.com"
            className="pl-9"
            disabled={state === "busy"}
          />
        </div>
        <Button type="button" onClick={submit} disabled={state === "busy" || !email.trim()}>
          {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Notify me
        </Button>
      </div>
      {message && <p className="mt-1.5 text-sm text-red-600">{message}</p>}
    </div>
  );
}
