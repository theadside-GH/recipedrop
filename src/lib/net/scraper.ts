import "server-only";
import { env } from "@/lib/env";

// Premium (residential) proxies route through a real ISP address and can take
// a while; the import runs in a background job, so a slow success still beats
// a fast "this site blocks us".
const SCRAPER_TIMEOUT_MS = 45_000;

/** True when a paid fetch fallback is configured (SCRAPINGBEE_API_KEY). */
export function scraperEnabled(): boolean {
  return env.scrapingBeeApiKey.length > 0;
}

/**
 * Fetch a page through ScrapingBee's residential proxies. Some publishers
 * (People Inc.: Allrecipes, Serious Eats, Simply Recipes…) refuse every
 * request from a cloud IP — Vercel's included — whatever the user agent, but
 * serve the same page to a home connection. Only called after a direct fetch
 * was blocked, so a normal import never spends scraper credits.
 *
 * Returns the page response, or null when the scraper couldn't get it either.
 */
export async function fetchViaScraper(url: string): Promise<Response | null> {
  if (!scraperEnabled()) return null;
  const api = new URL("https://app.scrapingbee.com/api/v1/");
  api.searchParams.set("api_key", env.scrapingBeeApiKey);
  api.searchParams.set("url", url);
  // Recipe data is in the server-rendered HTML (JSON-LD); no browser needed.
  // premium_proxy without JS costs 10 credits per page.
  api.searchParams.set("render_js", "false");
  api.searchParams.set("premium_proxy", "true");
  api.searchParams.set("country_code", "us");
  try {
    const res = await fetch(api, { signal: AbortSignal.timeout(SCRAPER_TIMEOUT_MS) });
    if (!res.ok) {
      // Never log the request URL — it carries the API key.
      console.warn(`[scraper] ${new URL(url).hostname} -> HTTP ${res.status}`);
      return null;
    }
    return res;
  } catch (err) {
    console.warn(`[scraper] ${new URL(url).hostname} failed:`, err instanceof Error ? err.name : err);
    return null;
  }
}
