#!/usr/bin/env bash
# One-shot: switch the production DATABASE_URL from the session-mode pooler
# (port 5432, ~15-client cap) to the transaction-mode pooler (port 6543).
# Reads the URL from .env.local; never prints the secret.
set -euo pipefail
export PATH="/c/Users/ralph/node-portable:$PATH"
cd "$(dirname "$0")/.."

OLD=$(grep "^DATABASE_URL=" .env.local | cut -d= -f2-)
NEW=$(printf '%s' "$OLD" | sed 's/:5432\//:6543\//')

if [ -z "$NEW" ]; then echo "ERROR: DATABASE_URL not found in .env.local"; exit 1; fi
if [ "$OLD" = "$NEW" ]; then echo "ERROR: port 5432 not found in the URL — nothing to change"; exit 1; fi

vercel env rm DATABASE_URL production --yes
printf '%s' "$NEW" | vercel env add DATABASE_URL production
echo "DATABASE_URL switched to transaction mode (port 6543)"
