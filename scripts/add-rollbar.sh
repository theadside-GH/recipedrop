#!/usr/bin/env bash
# One-shot: install the Rollbar error-tracking integration from the Vercel
# Marketplace onto this project (defaults to the free tier).
set -euo pipefail
export PATH="/c/Users/ralph/node-portable:$PATH"
cd "$(dirname "$0")/.."
vercel integration add rollbar/error-tracking --yes
