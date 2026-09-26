import { beforeEach, describe, expect, it, vi } from "vitest";

const safeFetch = vi.fn();
const fetchViaScraper = vi.fn();

vi.mock("@/lib/net/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/net/safe-fetch")>()),
  safeFetch: (...args: unknown[]) => safeFetch(...args),
}));
vi.mock("@/lib/net/scraper", () => ({
  fetchViaScraper: (...args: unknown[]) => fetchViaScraper(...args),
}));

const { fetchWebsite } = await import("./website");

const URL_ = "https://www.allrecipes.com/recipe/23431/to-die-for-fettuccine-alfredo/";
const RECIPE_PAGE = `<html><head><script type="application/ld+json">${JSON.stringify({
  "@type": ["Recipe", "NewsArticle"],
  name: "To Die For Fettuccine Alfredo",
  recipeIngredient: ["24 ounces dry fettuccine pasta", "1 cup butter"],
  recipeInstructions: [{ "@type": "HowToStep", text: "Boil the pasta." }],
})}</script></head><body></body></html>`;

// What Allrecipes' Cloudflare sends a Vercel function.
const blocked = () => new Response("<p>If you are a reader experiencing an access issue…</p>", { status: 402 });

beforeEach(() => {
  safeFetch.mockReset();
  fetchViaScraper.mockReset();
});

describe("fetchWebsite on a site that blocks cloud IPs", () => {
  it("imports through the scraper when the direct fetch is refused", async () => {
    safeFetch.mockResolvedValue(blocked());
    fetchViaScraper.mockResolvedValue(new Response(RECIPE_PAGE, { status: 200 }));

    const content = await fetchWebsite(URL_);

    expect(fetchViaScraper).toHaveBeenCalledWith(URL_);
    expect(content.text).toContain("Title: To Die For Fettuccine Alfredo");
    expect(content.text).toContain("- 24 ounces dry fettuccine pasta");
  });

  it("names the site and says to paste the text when the scraper can't help", async () => {
    safeFetch.mockResolvedValue(blocked());
    fetchViaScraper.mockResolvedValue(null);

    await expect(fetchWebsite(URL_)).rejects.toThrow(
      /^allrecipes\.com blocks recipe importers.*"Link \/ Text" tab/,
    );
  });

  it("treats a Cloudflare challenge page as blocked", async () => {
    safeFetch.mockResolvedValue(
      new Response("Just a moment...", { status: 503, headers: { "cf-mitigated": "challenge" } }),
    );
    fetchViaScraper.mockResolvedValue(null);

    await expect(fetchWebsite(URL_)).rejects.toThrow(/blocks recipe importers/);
  });

  it("never touches the scraper when the page loads normally", async () => {
    safeFetch.mockResolvedValue(new Response(RECIPE_PAGE, { status: 200 }));

    await fetchWebsite(URL_);

    expect(fetchViaScraper).not.toHaveBeenCalled();
  });

  it("keeps social posts off the paid scraper", async () => {
    safeFetch.mockResolvedValue(blocked());

    await expect(fetchWebsite("https://www.instagram.com/p/abc123/")).rejects.toThrow(
      /blocks recipe importers/,
    );
    expect(fetchViaScraper).not.toHaveBeenCalled();
  }, 10_000);
});
