import "server-only";
import type { SourceContent } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Social sites (Instagram/Facebook) only embed Open Graph caption tags when the
// request looks like a link-preview crawler, not a browser.
const CRAWLER_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

async function fetchHtml(url: string, ua = UA): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": ua, accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Could not fetch the page (HTTP ${res.status}).`);
  return res.text();
}

// Social video posts (Reels/TikToks) are login-walled, so Readability sees
// nothing — but the public caption + thumbnail live in Open Graph meta tags,
// and the caption is almost always the recipe.
const SOCIAL_HOSTS = ["instagram.com", "tiktok.com", "facebook.com", "fb.watch"];

function isSocialHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return SOCIAL_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

function isTikTokHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "tiktok.com" || host.endsWith(".tiktok.com");
  } catch {
    return false;
  }
}

async function fetchTikTokOembed(url: string): Promise<SourceContent | null> {
  const res = await fetch(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
    { headers: { "user-agent": UA, accept: "application/json" } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };
  const caption = data.title?.trim();
  if (!caption || caption.length < 40) return null;
  return {
    text: `Recipe from a TikTok post${data.author_name ? ` by ${data.author_name}` : ""}:\n\n${caption}`,
    imageUrl: data.thumbnail_url ?? null,
    description: captionToDescription(caption),
    author: data.author_name ?? null,
    context: url,
  };
}

function fetchTikTokEmbeddedData(html: string, url: string): SourceContent | null {
  const raw = html.match(
    /<script\b[^>]*id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i,
  )?.[1];
  if (!raw) return null;

  try {
    const data = JSON.parse(raw) as {
      __DEFAULT_SCOPE__?: {
        "webapp.video-detail"?: {
          itemInfo?: {
            itemStruct?: {
              desc?: string;
              author?: { nickname?: string; uniqueId?: string };
              video?: { cover?: string; originCover?: string; dynamicCover?: string };
            };
          };
        };
      };
    };
    const item = data.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
    const caption = item?.desc?.trim();
    if (!item || !caption || caption.length < 40) return null;
    const author = item.author?.nickname ?? item.author?.uniqueId ?? null;
    return {
      text: `Recipe from a TikTok post${author ? ` by ${author}` : ""}:\n\n${caption}`,
      imageUrl: item.video?.cover ?? item.video?.originCover ?? item.video?.dynamicCover ?? null,
      description: captionToDescription(caption),
      author,
      context: url,
    };
  } catch {
    return null;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#34;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function captionToDescription(caption: string): string | null {
  const cleaned = caption
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 12) return null;
  return cleaned.slice(0, 220);
}

function meta(html: string, prop: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const key = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1];
    if (key !== prop) continue;
    const content = tag.match(/\bcontent=["']([^"']*)["']/i)?.[1];
    if (content) return decodeHtml(content);
  }
  return null;
}

function absoluteUrl(value: string, pageUrl: string): string | null {
  try {
    return new URL(decodeHtml(value), pageUrl).toString();
  } catch {
    return null;
  }
}

/** Ranked hero-image candidates from meta tags + inline URLs, best first. */
function imagesFromHtml(html: string, pageUrl: string): string[] {
  const candidates = new Set<string>();
  for (const key of ["og:image", "twitter:image", "twitter:image:src"]) {
    const value = meta(html, key);
    if (value) candidates.add(value);
  }

  const matches = html.match(
    /https?:[^"'<>\s)]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'<>\s)]*)?/gi,
  ) ?? [];
  for (const value of matches) candidates.add(value);

  return [...candidates]
    .map((value) => absoluteUrl(value, pageUrl))
    .filter((value): value is string => !!value)
    .filter((value) => !/(?:logo|icon|favicon|avatar|sprite|placeholder|blank|cropped-tab)/i.test(value))
    .map((value) => ({ value, score: imageScore(value) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.value);
}

function imageScore(url: string): number {
  const dimension = url.toLowerCase().match(/-(\d{2,4})x(\d{2,4})\.(?:jpe?g|png|webp)/);
  const area = dimension ? Number(dimension[1]) * Number(dimension[2]) : 0;
  const unscaled = /\/[^/?]+(?<!-\d{2,4}x\d{2,4})\.(?:jpe?g|webp)(?:[?#].*)?$/i.test(url);
  const foodFormat = /\.(?:jpe?g|webp)(?:[?#].*)?$/i.test(url);
  return (foodFormat ? 1000 : 0) + (unscaled ? 900000 : area);
}

/**
 * Strip the engagement prefix Instagram prepends to og:description, e.g.
 * `1,234 likes, 56 comments - chef.jane on June 1, 2024: "<caption>"` -> the
 * caption alone. TikTok/Facebook usually put the caption there directly.
 */
function cleanSocialCaption(raw: string): string {
  let s = raw.trim();
  // Both og:title ("<name> on Instagram: "<caption>"") and og:description
  // ("<n> likes ... on <date>: "<caption>". ") wrap the caption in quotes after
  // a "<prefix>: ". Strip the prefix up to the opening quote, then drop the
  // closing quote plus any trailing punctuation/space the platform tacks on.
  const open = s.match(/:\s*["“]/);
  if (open && open.index !== undefined) {
    s = s.slice(open.index + open[0].length).replace(/["”][\s.]*$/, "");
  }
  return s.trim();
}

/** Best-effort recipe pull from a social post via its Open Graph metadata. */
function fetchSocialCaption(html: string, url: string): SourceContent {
  const host = new URL(url).hostname.replace(/^www\./, "").replace(/\.com$/, "");
  const platform = host.charAt(0).toUpperCase() + host.slice(1);
  const title = meta(html, "og:title");
  const desc = meta(html, "og:description");
  // og:title carries the FULL caption on Instagram; og:description is truncated
  // and prefixed with like/comment counts. Take whichever yields more recipe.
  const fromTitle = cleanSocialCaption(title ?? "");
  const fromDesc = cleanSocialCaption(desc ?? "");
  const caption = fromTitle.length >= fromDesc.length ? fromTitle : fromDesc;
  // The name sits before " on Instagram/TikTok/..." on the first line of og:title.
  const author =
    title?.match(/^(.+?)\s+on\s+(?:Instagram|TikTok|Facebook)\b/i)?.[1]?.trim() || null;

  if (caption.length < 40) {
    throw new Error(
      `${platform} hid this post's caption from us (it may be private or login-gated). ` +
        `Open the post, copy the caption text, and paste it into the "Paste text" tab instead.`,
    );
  }
  return {
    text: `Recipe from a ${platform} post${author ? ` by ${author}` : ""}:\n\n${caption}`,
    imageUrl: meta(html, "og:image"),
    description: captionToDescription(caption),
    author,
    context: url,
  };
}

/** Collect every JSON-LD block, flattening @graph arrays. */
function collectJsonLd(html: string): unknown[] {
  const nodes = html.match(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
  ) ?? [];
  const out: unknown[] = [];
  for (const node of nodes) {
    const raw = node
      .replace(/^<script\b[^>]*>/i, "")
      .replace(/<\/script>$/i, "")
      .trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of arr) {
        const e = entry as Record<string, unknown>;
        if (Array.isArray(e["@graph"])) out.push(...(e["@graph"] as unknown[]));
        else out.push(entry);
      }
    } catch {
      // Real-world JSON-LD is often malformed; skip unparseable blocks.
    }
  }
  return out;
}

function isRecipeNode(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== "object") return false;
  const t = (node as Record<string, unknown>)["@type"];
  if (typeof t === "string") return t.toLowerCase() === "recipe";
  if (Array.isArray(t)) return t.some((x) => String(x).toLowerCase() === "recipe");
  return false;
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join("\n");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return asText(o.text ?? o.name ?? o.itemListElement ?? "");
  }
  return String(v);
}

function firstImage(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return firstImage(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return firstImage(o.url ?? o.contentUrl ?? null);
  }
  return null;
}

/** All image URLs on a schema.org Recipe node (image can be string/array/object). */
function allImages(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(allImages);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return allImages(o.url ?? o.contentUrl ?? null);
  }
  return [];
}

/**
 * Build a compact text block from a schema.org Recipe node so the model gets
 * structured ingredients/steps instead of raw page chrome.
 */
function recipeNodeToText(node: Record<string, unknown>): SourceContent {
  const lines: string[] = [];
  if (node.name) lines.push(`Title: ${asText(node.name)}`);
  if (node.recipeYield) lines.push(`Yield: ${asText(node.recipeYield)}`);
  if (node.prepTime) lines.push(`Prep time: ${asText(node.prepTime)}`);
  if (node.cookTime) lines.push(`Cook time: ${asText(node.cookTime)}`);
  if (node.totalTime) lines.push(`Total time: ${asText(node.totalTime)}`);
  if (node.recipeCategory) lines.push(`Category: ${asText(node.recipeCategory)}`);
  if (node.description) lines.push(`Description: ${asText(node.description)}`);
  lines.push("\nIngredients:");
  const ing = node.recipeIngredient ?? node.ingredients;
  for (const i of Array.isArray(ing) ? ing : [ing]) {
    const s = asText(i);
    if (s) lines.push(`- ${s}`);
  }
  lines.push("\nInstructions:");
  const instr = node.recipeInstructions;
  const steps = Array.isArray(instr) ? instr : [instr];
  let n = 1;
  for (const st of steps) {
    const s = asText(st);
    if (s) lines.push(`${n++}. ${s}`);
  }
  const author =
    typeof node.author === "object"
      ? asText((node.author as Record<string, unknown>)?.name)
      : asText(node.author);
  return {
    text: lines.join("\n"),
    imageUrl: firstImage(node.image),
    imageCandidates: allImages(node.image),
    description: asText(node.description) || null,
    author: author || null,
  };
}

/**
 * Main-article text via Mozilla Readability — strips nav, comments, and
 * related-recipe teasers that used to leak into extraction and produce wrong
 * recipes on pages without JSON-LD.
 */
async function readableText(html: string, url: string): Promise<string | null> {
  try {
    const [{ JSDOM }, { Readability }] = await Promise.all([
      import("jsdom"),
      import("@mozilla/readability"),
    ]);
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    const text = article?.textContent?.replace(/\n{3,}/g, "\n\n").trim();
    if (!text || text.length < 200) return null;
    return `${article?.title ? `Title: ${article.title}\n\n` : ""}${text}`.slice(0, 16000);
  } catch {
    return null;
  }
}

/**
 * Just the ranked hero-image candidates from a page — used by the stand-in
 * image search, which only needs photos, not recipe text.
 */
export async function fetchPageImages(url: string): Promise<string[]> {
  const html = await fetchHtml(url);
  return imagesFromHtml(html, url);
}

/**
 * Fetch a recipe web page and return clean text for extraction. Tries
 * schema.org JSON-LD first (most recipe sites embed it); falls back to
 * Readability main-content extraction.
 */
export async function fetchWebsite(url: string): Promise<SourceContent> {
  const social = isSocialHost(url);
  if (isTikTokHost(url)) {
    const oembed = await fetchTikTokOembed(url).catch(() => null);
    if (oembed) return oembed;
    const html = await fetchHtml(url, UA);
    const embedded = fetchTikTokEmbeddedData(html, url);
    if (embedded) return embedded;
    return fetchSocialCaption(html, url);
  }
  const html = await fetchHtml(url, social ? CRAWLER_UA : UA);

  if (social) return fetchSocialCaption(html, url);

  const pageImages = imagesFromHtml(html, url);

  const recipeNode = collectJsonLd(html).find(isRecipeNode);
  if (recipeNode) {
    const content = recipeNodeToText(recipeNode);
    return {
      ...content,
      imageUrl: content.imageUrl ?? pageImages[0] ?? null,
      imageCandidates: [...(content.imageCandidates ?? []), ...pageImages],
      context: url,
    };
  }

  const ogDescription = meta(html, "og:description") ?? meta(html, "description");

  // No structured recipe data: prefer Readability's main-article text so nav,
  // comments, and "you may also like" recipes don't confuse extraction.
  const readable = await readableText(html, url);
  if (readable) {
    return {
      text: readable,
      imageUrl: pageImages[0] ?? null,
      imageCandidates: pageImages,
      description: ogDescription ? captionToDescription(ogDescription) : null,
      author: null,
      context: url,
    };
  }

  const title = meta(html, "og:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16000);
  if (!text) {
    throw new Error(
      "Couldn't read a recipe from that page. Try pasting the recipe text instead.",
    );
  }
  return {
    text: `${title ? `Title: ${decodeHtml(title)}\n\n` : ""}${decodeHtml(text)}`.slice(0, 16000),
    imageUrl: pageImages[0] ?? null,
    imageCandidates: pageImages,
    description: ogDescription ? captionToDescription(ogDescription) : null,
    author: null,
    context: url,
  };
}
