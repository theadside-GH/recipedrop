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

  /** Server-only Supabase key for uploading images to Storage. When unset,
   *  photos fall back to embedded data: URLs (heavier pages, but works). */
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  /** The single owner of this personal app. */
  ownerEmail: process.env.OWNER_EMAIL ?? "owner@local",

  /** Stripe secret key — presence turns on paid-tier limit enforcement. */
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",

  /** Price id of the Pro subscription (price_… from the Stripe dashboard). */
  stripePriceId: process.env.STRIPE_PRICE_ID ?? "",

  /** Signing secret for /api/stripe/webhook (whsec_… from the dashboard). */
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",

  /**
   * Comma/space-separated emails allowed to use the app. When set, sign-in
   * stays open (Supabase handles it) but anyone not on the list lands on an
   * "invite only" page — protecting the shared AI key from strangers who find
   * the URL. Unset = open to everyone (the pre-launch default).
   */
  inviteEmails: process.env.INVITE_EMAILS ?? "",

  /**
   * Public base URL for absolute links in social previews (og:image etc.).
   * Falls back to the Vercel production domain when deployed there.
   */
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : ""),
} as const;

/** Lowercased invite list; empty = invites not enforced. */
export function inviteList(): string[] {
  return env.inviteEmails
    .split(/[\s,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/** True when the invite list is on and this email isn't on it. */
export function isUninvited(email: string | null | undefined): boolean {
  const list = inviteList();
  if (list.length === 0 || !email) return false;
  const lower = email.toLowerCase();
  return lower !== env.ownerEmail.toLowerCase() && !list.includes(lower);
}

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
  /** True when checkout can actually run (secret key + a Pro price id). */
  get checkoutEnabled() {
    return env.stripeSecretKey.length > 0 && env.stripePriceId.length > 0;
  },
  /** Photos upload to Supabase Storage instead of embedding in the DB. */
  get storageEnabled() {
    return env.supabaseUrl.length > 0 && env.supabaseServiceRoleKey.length > 0;
  },
} as const;

// Model routing — latest Claude models (see CLAUDE knowledge: Opus 4.8 / Sonnet 4.6 / Haiku 4.5)
export const MODELS = {
  /** Cheap, fast text extraction (JSON-LD normalize, pasted text, transcripts). */
  text: "claude-haiku-4-5-20251001",
  /** Vision extraction from photos/screenshots and hard segmentation tasks. */
  vision: "claude-sonnet-4-6",
} as const;
