import "server-only";
import { getVideoDetails } from "youtube-caption-extractor";
import { youtubeVideoId } from "./detect";
import type { SourceContent } from "./types";

/**
 * Pick the best YouTube thumbnail that actually exists. `maxresdefault` (1280x720)
 * is only present for HD uploads, so HEAD-check it and fall back to `hqdefault`
 * (480x360), which YouTube generates for every video.
 */
async function bestThumbnail(videoID: string): Promise<string> {
  const maxres = `https://i.ytimg.com/vi/${videoID}/maxresdefault.jpg`;
  try {
    const res = await fetch(maxres, { method: "HEAD" });
    if (res.ok) return maxres;
  } catch {
    // Network hiccup — fall through to the guaranteed thumbnail.
  }
  return `https://i.ytimg.com/vi/${videoID}/hqdefault.jpg`;
}

/**
 * Pull a YouTube video's captions + description. Cooking channels often put the
 * full written recipe in the description, so we send both to the model. This is
 * best-effort: the underlying library scrapes YouTube internals and can break,
 * so callers should surface a "paste the description" fallback on failure.
 */
export async function fetchYoutube(url: string): Promise<SourceContent> {
  const videoID = youtubeVideoId(url);
  if (!videoID) throw new Error("That doesn't look like a valid YouTube link.");

  let details;
  try {
    details = await getVideoDetails({ videoID, lang: "en" });
  } catch {
    throw new Error(
      "Couldn't read this video automatically. Paste the video's description or caption text instead.",
    );
  }

  const transcript = (details.subtitles ?? [])
    .map((s) => s.text)
    .join(" ")
    .trim();
  const description = (details.description ?? "").trim();

  if (!transcript && !description) {
    throw new Error(
      "This video has no readable captions or description. Paste the recipe text instead.",
    );
  }

  const text = [
    details.title ? `Video title: ${details.title}` : "",
    description ? `Description:\n${description}` : "",
    transcript ? `Transcript:\n${transcript}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 16000);

  return { text, imageUrl: await bestThumbnail(videoID), author: null, context: url };
}
