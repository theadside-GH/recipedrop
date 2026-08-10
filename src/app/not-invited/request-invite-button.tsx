"use client";

import { useState } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestInviteAction } from "@/app/actions";

/** One-tap access request for a signed-in, uninvited viewer (email is known). */
export function RequestInviteButton() {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function request() {
    if (state === "busy") return;
    setState("busy");
    const result = await requestInviteAction();
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
    <div className="flex flex-col items-center gap-1">
      <Button type="button" onClick={request} disabled={state === "busy"}>
        {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        Request an invite
      </Button>
      {message && <p className="text-sm text-red-600">{message}</p>}
    </div>
  );
}
