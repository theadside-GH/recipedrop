---
name: verify
description: How to run and drive DishCovered locally for end-to-end verification without touching the prod Supabase DB.
---

# Verifying DishCovered changes

## Isolated local run (no prod data)

`.env.local` points at prod (Supabase + cloud DATABASE_URL). Override in the
shell to get local mode: auth disabled (always signed in as OWNER_EMAIL) and an
embedded PGlite DB.

```bash
export PATH="/c/Users/ralph/node-portable:$PATH"   # portable Node 22
SCRATCH=<session scratchpad>
ENV='PGLITE_DIR='"$SCRATCH"'/pglite DATABASE_URL= NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= SUPABASE_SERVICE_ROLE_KEY= OWNER_EMAIL=ralph.sutton@gmail.com'
env $ENV npm run db:seed          # 4 sample recipes, creates schema
env $ENV npx next dev -p <port>   # pick a free port; 3000/3111/3479 often taken by other apps
```

## Gotchas (each cost real time)

- **PGlite is single-process.** Never run seed scripts while the dev server is
  up — the server won't see the writes and the data dir can corrupt
  (`RuntimeError: Aborted()` on next open → `rm -rf` the pglite dir and reseed).
  Sequence: kill server → seed → start server.
- **Killing the background shell does not kill `next dev` on Windows.** Find the
  listener with `netstat -ano | grep :<port>` and `Stop-Process -Id <pid>`.
- **Discover feed is empty without profiles.** `listPublicRecipes` inner-joins
  `user_profile` and requires `publicFeedOptIn = true`. Fixtures need a profile
  row per recipe owner (plus `recipe.isPublic = true`).
- Schema names that trip up fixture inserts: table `step` (not recipeStep),
  column `rawText`, enum `unit_category` uses `mass` (not weight).
- **Delete `.next` after verifying** — it was compiled with the scratch env and
  Ralph's normal run should not reuse it.

## Driving the UI

No Playwright in the repo, but `playwright-core` + system Chrome works:

```js
const { chromium } = require("playwright-core"); // npm i playwright-core in scratchpad
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", // forward slashes!
  headless: true,
});
```

Backslashed Windows paths get mangled through the bash heredoc/-e path — write
driver scripts with the Write tool and use forward slashes.

## Two-user flows

Local mode is always the owner. To test social flows (Discover, /r/[id] drops,
save/follow), insert a public recipe under a second email (e.g.
friend@example.com) with its own opted-in profile, then browse as the owner.
