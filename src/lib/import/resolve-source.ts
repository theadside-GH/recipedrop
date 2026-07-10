import "server-only";
import { isShortShareLink, sourceKeyFor } from "@/lib/source-key";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const MAX_REDIRECTS = 3;

/**
 * Source key for grouping, resolving per-share short links first. TikTok's
 * share links (tiktok.com/t/XXXX, vm.tiktok.com/XXXX) mint a different code
 * for every share of the same video, so the key must come from the canonical
 * URL they redirect to — otherwise the same dish never groups. Falls back to
 * the unresolved key (never throws) when the redirect can't be followed.
 */
export async function resolveSourceKey(sourceUrl: string | null | undefined): Promise<string | null> {
  const raw = sourceUrl?.trim();
  if (!raw || !isShortShareLink(raw)) return sourceKeyFor(raw);
  try {
    let target = new URL(raw);
    for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
      const res = await fetch(target, {
        headers: { "user-agent": UA },
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
      });
      await res.body?.cancel();
      if (res.status < 300 || res.status >= 400) break;
      const location = res.headers.get("location");
      if (!location) break;
      target = new URL(location, target);
      if (!isShortShareLink(target.toString())) break;
    }
    return sourceKeyFor(target.toString()) ?? sourceKeyFor(raw);
  } catch {
    return sourceKeyFor(raw);
  }
}
