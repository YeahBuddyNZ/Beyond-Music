#!/usr/bin/env bash
# Beyond style rule, enforced at commit: no em dashes in anything we write.
# Usage: scripts/check-style.sh          check staged changes (what pre-commit runs)
#        scripts/check-style.sh --all    check every tracked text file (an audit)
# Only lines you add are checked, so old text does not block a commit. A line carrying
# "style-ok" is skipped on purpose (for quoting someone else). Do not edit this script to get past it.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2
DASH=$'\xe2\x80\x94'
skip_re='(^|/)(node_modules|vendor|\.git|\.next|dist|build|Pods)/|\.(png|jpe?g|gif|webp|ico|pdf|zip|aab|apk|ipa|jks|keystore|woff2?|ttf|otf|mp[34]|mov|stl|pkl)$|(^|/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|(^|/)\.claude/skills/'
hits=""
if [ "${1:-}" = "--all" ]; then
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    printf '%s\n' "$f" | grep -Eq "$skip_re" && continue
    h=$(grep -InF -- "$DASH" "$f" 2>/dev/null | grep -v 'style-ok' | head -3 | sed "s|^|$f:|")
    [ -n "$h" ] && hits="$hits$h"$'\n'
  done < <(git ls-files)
else
  while IFS= read -r f; do
    printf '%s\n' "$f" | grep -Eq "$skip_re" && continue
    h=$(git diff --cached -U0 --diff-filter=ACMR -- "$f" | grep -E '^\+[^+]' | grep -F -- "$DASH" | grep -v 'style-ok' | head -3 | sed "s|^+|$f: |")
    [ -n "$h" ] && hits="$hits$h"$'\n'
  done < <(git diff --cached --name-only --diff-filter=ACMR)
fi
if [ -n "$hits" ]; then
  printf '%s' "$hits"
  echo "BLOCKED: em dash found. Use a comma, a colon or a full stop instead (New Zealand English, no em dashes)."
  exit 1
fi
exit 0
