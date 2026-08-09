"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoEmbed {
  src: string;
  /** Reels/TikToks/Shorts are 9:16; regular YouTube is 16:9. */
  portrait: boolean;
  label: string;
}

/**
 * Map a recipe's source link to an embeddable player. Only the three video
 * platforms the importer understands — anything else returns null and the
 * page just shows the plain Source button.
 */
export function videoEmbedFor(sourceUrl: string | null | undefined): VideoEmbed | null {
  const raw = sourceUrl?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ? youtube(id, false) : null;
  }
  if (host === "youtube.com") {
    const shorts = url.pathname.match(/^\/shorts\/([\w-]+)/)?.[1];
    if (shorts) return youtube(shorts, true);
    const id = url.searchParams.get("v");
    return id ? youtube(id, false) : null;
  }
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    const id = url.pathname.match(/^\/(?:@[^/]*\/video|video|v)\/(\d+)/)?.[1];
    if (!id) return null;
    return {
      src: `https://www.tiktok.com/embed/v2/${id}`,
      portrait: true,
      label: "Watch the original TikTok",
    };
  }
  if (host === "instagram.com") {
    const match = url.pathname.match(/^\/(reels?|p)\/([\w-]+)/);
    if (!match) return null;
    const kind = match[1] === "p" ? "p" : "reel";
    return {
      src: `https://www.instagram.com/${kind}/${match[2]}/embed`,
      portrait: true,
      label: "Watch the original Reel",
    };
  }
  return null;
}

function youtube(id: string, shorts: boolean): VideoEmbed {
  return {
    src: `https://www.youtube-nocookie.com/embed/${id}`,
    portrait: shorts,
    label: shorts ? "Watch the original Short" : "Watch the original video",
  };
}

/**
 * The reel behind the recipe, embedded in place. Loads nothing until tapped —
 * social embeds pull megabytes of third-party script, which shouldn't tax
 * every recipe view (and keeps their trackers out until the user opts in).
 */
export function SourceVideo({ sourceUrl }: { sourceUrl: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const embed = videoEmbedFor(sourceUrl);
  if (!embed) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-brand hover:bg-brand-soft print:hidden"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <Play className="h-5 w-5 fill-current" />
        </span>
        <span>
          <span className="block font-medium">{embed.label}</span>
          <span className="block text-sm text-muted">
            Plays right here — see the dish the way it was Dishcovered.
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="print:hidden">
      <iframe
        src={embed.src}
        title={embed.label}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className={cn(
          "rounded-2xl border border-border bg-black",
          embed.portrait ? "mx-auto aspect-[9/16] w-full max-w-[360px]" : "aspect-video w-full",
        )}
      />
    </div>
  );
}
