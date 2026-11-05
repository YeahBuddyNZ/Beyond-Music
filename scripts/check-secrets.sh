#!/usr/bin/env bash
# Beyond version control standard: block secrets and signing files from being committed.
# Usage: scripts/check-secrets.sh          check staged files (what pre-commit runs)
#        scripts/check-secrets.sh --all    check every tracked file (an audit)
# A line carrying "secrets-ok" is skipped on purpose. Do not edit this script to get past it.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2

if [ "${1:-}" = "--all" ]; then
  files=$(git ls-files)
else
  files=$(git diff --cached --name-only --diff-filter=ACMR)
fi
[ -z "$files" ] && exit 0

bad=0
name_re='(^|/)(\.env|\.env\.[^/]*|config\.properties|id_rsa|id_ed25519)$|\.(keystore|jks|p12|p8|pfx|pem|key|mobileprovision)$|(^|/)service-account[^/]*\.json$'
content_re='sk-ant-[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{16,}|rk_live_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[abprs]-[A-Za-z0-9-]{10,}|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----|SERVICE_ROLE_KEY["'"'"']?[ ]*[:=][ ]*["'"'"']?eyJ[A-Za-z0-9_.-]{40,}'

while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in
    scripts/check-secrets.sh|docs/VERSION-CONTROL.md|*.example|*.sample) continue ;;
  esac
  if printf '%s\n' "$f" | grep -Eq "$name_re"; then
    echo "BLOCKED file name: $f (keys and signing files never go in git)"; bad=1; continue
  fi
  if [ "${1:-}" = "--all" ]; then src() { cat -- "$f"; }; else src() { git show ":$f"; }; fi
  hits=$(src 2>/dev/null | grep -InE "$content_re" 2>/dev/null | grep -v 'secrets-ok' | head -3)
  if [ -n "$hits" ]; then
    echo "BLOCKED possible secret in $f:"; printf '%s\n' "$hits" | cut -c1-80 | sed 's/^/  /'; bad=1
  fi
done <<< "$files"

if [ "$bad" -ne 0 ]; then
  echo "check-secrets: stopped. Move the value to the platform's secrets, or add 'secrets-ok' with a reason if it is a false positive."
  exit 1
fi
exit 0
