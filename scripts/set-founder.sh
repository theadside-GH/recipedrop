#!/usr/bin/env bash
# One-shot: mark the creator's email as a founder (Pro tier, never rate-limited)
# on Vercel production via the FOUNDER_EMAILS env var.
set -euo pipefail
export PATH="/c/Users/ralph/node-portable:$PATH"
cd "$(dirname "$0")/.."
printf '%s' "ralph.sutton@gmail.com" | vercel env add FOUNDER_EMAILS production
echo "FOUNDER_EMAILS set for production"
