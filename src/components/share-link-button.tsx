"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareLinkButton({ href, label = "Copy link" }: { href?: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = href ? new URL(href, window.location.origin).toString() : window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button type="button" variant="secondary" size="lg" onClick={copyLink}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
