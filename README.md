# RecipeDrop

RecipeDrop is a personal recipe inbox. Share or paste a recipe from a website,
YouTube, TikTok, Instagram, text, or photos, and it turns that source into a
structured recipe with ingredients, steps, times, tags, and shopping-list data.

Then plan your week, set servings, and generate one consolidated grocery list.

## Features

- **Share-to-app import**: install the PWA on your phone, then share compatible
  links or captions into RecipeDrop.
- **Universal import**: websites, pasted text, photos/screenshots, YouTube, and
  social captions.
- **Bulk import**: paste a batch of links or recipes and process each item with
  individual retry.
- **Grocery-aware shopping list**: keeps exact recipe math internally, but shows
  friendlier buy amounts like cartons, bottles, bags, and rounded weights.
- **Search and filters**: meal type, time, tags, and text search.
- **Cooking mode**: full-screen step-by-step cooking with timers and wake lock.
- **Installable PWA**: add it to your phone home screen.

## Tech

Next.js App Router, TypeScript, Tailwind v4, Drizzle ORM, Claude API, PGlite for
local development, and Supabase Postgres/Auth for deployment.

## Quick Start

```bash
npm install
npm run db:seed
npm run dev
```

With no environment variables, the app runs in local single-user mode using an
embedded PGlite database stored in `./.pglite`. Browsing, meal planning, and
shopping lists work out of the box. Importing new recipes requires an Anthropic
API key.

## Environment

Copy `.env.example` to `.env.local`.

```bash
ANTHROPIC_API_KEY=sk-ant-...
OWNER_EMAIL=you@example.com
DATABASE_URL=
PGLITE_DIR=./.pglite
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
INVITE_EMAILS=
NEXT_PUBLIC_SITE_URL=
```

`SUPABASE_SERVICE_ROLE_KEY` (server-only, from Project Settings → API) lets the
app host photos in Supabase Storage (`recipe-images` bucket) instead of
embedding them in database rows — much lighter pages. To move existing
embedded photos into storage, run `npm run migrate:images` once.

For local testing, only `ANTHROPIC_API_KEY` is needed for imports. For a hosted
web app, set all values except `PGLITE_DIR`.

The app is multi-user: anyone can sign in with a magic link or Google, and each
account only ever sees its own recipes. `OWNER_EMAIL` is used for local
single-user mode (no Supabase configured). To keep a hosted deployment
friends-and-family only, set `INVITE_EMAILS` to a comma-separated list of
allowed addresses — everyone else can browse public pages but lands on an
"invite only" screen (and can't spend the AI quota). Leave it empty for open
sign-ups. `NEXT_PUBLIC_SITE_URL` sets the absolute base for social link
previews; on Vercel it defaults to the production domain automatically.

## Deploy Checklist

1. Create a Supabase project.
2. Copy the Supabase Postgres connection string into `DATABASE_URL`.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Optionally set `INVITE_EMAILS` to limit who can use the app.
5. Set `ANTHROPIC_API_KEY`.
6. Check that the required hosted environment variables are present:

```bash
npm run deploy:check
```

7. Run migrations:

```bash
npm run db:migrate
```

8. Deploy to Vercel with the same environment variables.
9. In Supabase Auth URL settings, add:

```text
https://YOUR-VERCEL-DOMAIN
https://YOUR-VERCEL-DOMAIN/auth/confirm
```

10. After deploy, check:

```text
https://YOUR-VERCEL-DOMAIN/api/health
```

11. Open the site on your phone, sign in, add it to your home screen, then test
    sharing a YouTube/TikTok/recipe link into RecipeDrop.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run deploy:check` | Verify hosted env vars before deploy |
| `npm test` | Run unit tests |
| `npm run lint` | Run lint |
| `npm run db:generate` | Generate SQL migrations after schema changes |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run db:seed` | Seed sample recipes into the local database |

## Project Layout

```text
src/
  app/                 pages, routes, server actions
    import/            single, bulk, and photo import UI
    share/             PWA share-target capture flow
    recipes/[id]/      recipe detail and cooking mode
    plans/[id]/        meal plan editor and shopping list
  components/          UI primitives and shared components
  lib/
    ai/                extraction schema, prompts, Claude wrapper
    sources/           website, YouTube, share parsing, source detection
    shopping/          unit normalization, aggregation, buy-amount formatting
    repo/              data access
    db/                Drizzle schema and DB client
drizzle/               SQL migrations
```
