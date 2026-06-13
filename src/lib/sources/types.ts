export type SourceType = "url" | "text" | "photo" | "youtube";

/** Normalized payload a source handler produces, ready for AI extraction. */
export interface SourceContent {
  /** Cleaned text to extract from (web text, transcript, or pasted recipe). */
  text: string;
  /** A candidate hero image URL discovered in the source, if any. */
  imageUrl?: string | null;
  /** Author/channel/site, if discoverable. */
  author?: string | null;
  /** Short context line passed to the model (e.g. the source URL). */
  context?: string | null;
}
