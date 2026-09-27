import "server-only";
import { env } from "@/lib/env";

// Premium (residential) proxies route through a real ISP address and can take
// a while; the import runs in a background job, so a slow success still beats
// a fast "this site blocks us". Stealth mode drives a real browser — slower.
const SCRAPER_TIMEOUT_MS = 45_000;
const STEALTH_TIMEOUT_MS = 90_000;

/** True when a paid fetch fallback is configured (SCRAPINGBEE_API_KEY). */
export function scraperEnabled(): boolean {
  return env.scrapingBeeApiKey.length > 0;
}

// Cheapest first. Recipe data is in the server-rendered HTML (JSON-LD), so
// most blocked sites only need a residential IP (10 credits). A few firewalls
// (The Woks of Life's) also fingerprint the client and refuse that; stealth
// mode — a real browser on a residential IP — gets through for 75 credits.
const TIERS: Array<{ name: string; params: Record<string, string>; timeoutMs: number }> = [
  { name: "premium", params: { render_js: "false", premium_proxy: "true" }, timeoutMs: SCRAPER_TIMEOUT_MS },
  { name: "stealth", params: { render_js: "true", stealth_proxy: "true" }, timeoutMs: STEALTH_TIMEOUT_MS },
];

/**
 * Fetch a page through ScrapingBee. Some publishers (People Inc.: Allrecipes,
 * Serious Eats, Simply Recipes…; Cloudflare-protected blogs like Sally's and
 * Budget Bytes) refuse every request from a cloud IP — Vercel's included —
 * whatever the user agent, but serve the same page to a home connection. Only
 * called after a direct fetch was blocked, so a normal import never spends
 * scraper credits.
 *
 * Returns the page response (including a genuine 404), or null when the
 * scraper couldn't get it either.
 */
export async function fetchViaScraper(url: string): Promise<Response | null> {
  if (!scraperEnabled()) return null;
  const host = new URL(url).hostname;
  for (const tier of TIERS) {
    const api = new URL("https://app.scrapingbee.com/api/v1/");
    api.searchParams.set("api_key", env.scrapingBeeApiKey);
    api.searchParams.set("url", url);
    for (const [key, value] of Object.entries(tier.params)) api.searchParams.set(key, value);
    api.searchParams.set("country_code", "us");
    try {
      const res = await fetch(api, { signal: AbortSignal.timeout(tier.timeoutMs) });
      if (res.ok) return res;
      // The page really doesn't exist — say so rather than "this site blocks us".
      if (res.status === 404 || res.status === 410) return res;
      // Never log the request URL — it carries the API key.
      console.warn(`[scraper] ${host} (${tier.name}) -> HTTP ${res.status}`);
    } catch (err) {
      console.warn(`[scraper] ${host} (${tier.name}) failed:`, err instanceof Error ? err.name : err);
    }
  }
  return null;
}
