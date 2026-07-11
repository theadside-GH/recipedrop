"use client";

import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await getBrowserSupabase().auth.signOut();
    } finally {
      window.location.href = "/discover";
    }
  }

  return (
    <Button type="button" variant="ghost" onClick={signOut} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Sign out
    </Button>
  );
}
