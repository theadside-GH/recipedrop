/**
 * Centralized environment access. Everything is optional so the app boots and
 * the UI renders even before the user has configured cloud services — features
 * that need a given key degrade gracefully and surface a setup hint instead.
 */

export const env = {
  /** Postgres connection string (Supabase). When unset, a local embedded
   *  PGlite database is used so the app runs with zero setup. */
  databaseUrl: process.env.DATABASE_URL ?? "",

  /** Directory for the local PGlite database (dev only). */
  pgliteDir: process.env.PGLITE_DIR ?? "./.pglite",

  /** Anthropic API key — required for AI recipe extraction. */
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",

  /** Supabase (auth + storage). When unset, the app runs in single-user
   *  "local mode" with no login required. */
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",

  /** The single owner of this personal app. */
  ownerEmail: process.env.OWNER_EMAIL ?? "owner@local",

  /** Stripe secret key — presence turns on paid-tier limit enforcement. */
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
} as const;

export const features = {
  get usePostgres() {
    return env.databaseUrl.length > 0;
  },
  get aiEnabled() {
    return env.anthropicApiKey.length > 0;
  },
  get authEnabled() {
    return env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
  },
  /**
   * Free/Pro feature limits stay dormant until billing exists (i.e. Stripe is
   * configured). The global AI daily cap is enforced regardless — it protects
   * the shared Anthropic key.
   */
  get billingEnabled() {
    return env.stripeSecretKey.length > 0;
  },
} as const;

// Model routing — latest Claude models (see CLAUDE knowledge: Opus 4.8 / Sonnet 4.6 / Haiku 4.5)
export const MODELS = {
  /** Cheap, fast text extraction (JSON-LD normalize, pasted text, transcripts). */
  text: "claude-haiku-4-5-20251001",
  /** Vision extraction from photos/screenshots and hard segmentation tasks. */
  vision: "claude-sonnet-4-6",
} as const;
