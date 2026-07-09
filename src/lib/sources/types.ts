export type SourceType = "url" | "text" | "photo" | "youtube";

/** Normalized payload a source handler produces, ready for AI extraction. */
export interface SourceContent {
  /** Cleaned text to extract from (web text, transcript, or pasted recipe). */
  text: string;
  /** A candidate hero image URL discovered in the source, if any. */
  imageUrl?: string | null;
  /** Backup image URLs (best first) to try if imageUrl turns out to be dead. */
  imageCandidates?: string[];
  /** A short source-provided summary/caption to use if extraction leaves description blank. */
  description?: string | null;
  /** Author/channel/site, if discoverable. */
  author?: string | null;
  /** Short context line passed to the model (e.g. the source URL). */
  context?: string | null;
}
