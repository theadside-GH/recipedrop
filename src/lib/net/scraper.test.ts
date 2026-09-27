import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { scrapingBeeApiKey: "test-key" } }));

const { fetchViaScraper } = await import("./scraper");

const fetchMock = vi.fn();
const tiers = () => fetchMock.mock.calls.map(([api]) => (new URL(api).searchParams.has("stealth_proxy") ? "stealth" : "premium"));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("fetchViaScraper", () => {
  it("uses only the cheap tier when it works", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>recipe</html>", { status: 200 }));

    const res = await fetchViaScraper("https://www.budgetbytes.com/x/");

    expect(await res!.text()).toBe("<html>recipe</html>");
    expect(tiers()).toEqual(["premium"]);
  });

  it("escalates to stealth when the site's firewall refuses the cheap tier (Woks of Life)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{"reason": "Server responded with 613"}', { status: 500 }))
      .mockResolvedValueOnce(new Response("<html>recipe</html>", { status: 200 }));

    const res = await fetchViaScraper("https://thewoksoflife.com/egg-fried-rice/");

    expect(res!.status).toBe(200);
    expect(tiers()).toEqual(["premium", "stealth"]);
  });

  it("stops at a real 404 instead of paying for stealth", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Not found", { status: 404 }));

    const res = await fetchViaScraper("https://example.com/gone/");

    expect(res!.status).toBe(404);
    expect(tiers()).toEqual(["premium"]);
  });

  it("returns null when every tier fails", async () => {
    fetchMock.mockResolvedValue(new Response("error", { status: 500 }));

    expect(await fetchViaScraper("https://example.com/x/")).toBeNull();
    expect(tiers()).toEqual(["premium", "stealth"]);
  });
});
