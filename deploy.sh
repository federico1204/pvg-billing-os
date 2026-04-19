#!/bin/bash
# PVG / AXIS Billing — deploy everything in one shot
# Usage: ./deploy.sh "commit message"
# The Vercel git integration auto-deploys on push.
# The desktop app (AXIS Billing.app) is a webview — it picks up the new
# version automatically on the next page load, no rebuild needed.

set -e

MSG="${1:-chore: update}"

echo "📦 Staging all changes..."
git add -A

echo "💬 Committing: $MSG"
git commit -m "$MSG

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>" 2>/dev/null || echo "  (nothing new to commit)"

echo "🚀 Pushing to GitHub → triggers Vercel deploy..."
git push origin main

echo ""
echo "✅ Done. Vercel is building now (~60s)."
echo "   Web:     https://pvg-billing-os.vercel.app"
echo "   Desktop: AXIS Billing.app auto-refreshes on next load"
