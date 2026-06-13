import type { SourceType } from "./types";

const YT_HOSTS = ["youtube.com", "youtu.be", "m.youtube.com", "www.youtube.com"];

/** Classify a single input string as a YouTube link, a web URL, or raw text. */
export function detectSourceType(input: string): SourceType {
  const trimmed = input.trim();
  const url = tryUrl(trimmed);
  if (url) {
    const host = url.hostname.replace(/^www\./, "");
    if (YT_HOSTS.some((h) => host === h || host.endsWith("." + h))) return "youtube";
    return "url";
  }
  return "text";
}

function tryUrl(s: string): URL | null {
  // Only treat the input as a URL if it is *just* a URL (no surrounding prose).
  if (/\s/.test(s)) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

/** Extract the YouTube video id from any common URL form. */
export function youtubeVideoId(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (u.hostname.replace(/^www\./, "") === "youtu.be") {
      return u.pathname.slice(1) || null;
    }
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(shorts|embed|v)\/([^/?]+)/);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}

const URL_RE = /https?:\/\/[^\s)>\]"']+/gi;

/**
 * Split a bulk blob (pasted text or uploaded file contents) into individual
 * items without an AI call: every URL becomes its own item, and any remaining
 * prose is kept as text items split on blank-line boundaries. Good enough for
 * the common "a list of links" case; ambiguous prose can be AI-segmented later.
 */
export function splitBulkInput(blob: string): { type: SourceType; value: string }[] {
  const urls = blob.match(URL_RE) ?? [];
  const items: { type: SourceType; value: string }[] = urls.map((u) => ({
    type: detectSourceType(u),
    value: u.replace(/[.,]+$/, ""),
  }));

  // Remaining text after removing the URLs, split into recipe-sized chunks.
  const remainder = blob.replace(URL_RE, "").trim();
  if (remainder) {
    const chunks = remainder
      .split(/\n\s*\n\s*\n*/) // blank-line separated blocks
      .map((c) => c.trim())
      .filter((c) => c.length > 40); // ignore stray fragments
    for (const c of chunks) items.push({ type: "text", value: c });
  }
  return items;
}
