#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---all}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cici-secret-check.XXXXXX")"
trap 'rm -rf "$TEMP_DIR"' EXIT

patterns=(
  'WeChat AppID|\bwx[0-9a-fA-F]{16}\b'
  'Tencent secret ID|\bAKID[0-9A-Za-z]{13,}\b'
  'AWS access key|\b(AKIA|ASIA)[0-9A-Z]{16}\b'
  'GitHub token|\bgh[pousr]_[A-Za-z0-9_]{20,}\b'
  'Slack token|\bxox[baprs]-[0-9A-Za-z-]{10,}\b'
  'Private key|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
  'Cloud environment value|(TARO_CLOUD_ENV_ID|TARO_CLOUD_STORAGE_BUCKET|CLOUD_ENV_ID|CLOUD_STORAGE_BUCKET)[[:space:]]*=[[:space:]]*["'"'"']?[A-Za-z0-9][A-Za-z0-9-]{3,}'
  'Credential assignment|(password|passwd|secret(_id|_key)?|api[_-]?key|access[_-]?key|auth[_-]?token)[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9/+_.-]{12,}'
  'Local user path|(/Us[e]rs/|/ho[m]e/)[^/<[:space:]]+/'
)

scan_file() {
  local file="$1"
  local content_file="$2"
  local entry label pattern

  if grep -Iq . "$content_file" 2>/dev/null; then
    for entry in "${patterns[@]}"; do
      label="${entry%%|*}"
      pattern="${entry#*|}"
      if grep -Ei -- "$pattern" "$content_file" |
        grep -Eivq '(<[^>]+>|test-|example|placeholder|dummy|fake)'; then
        printf 'Potential secret: %s (%s)\n' "$file" "$label" >&2
        return 1
      fi
    done
  fi
}

cd "$ROOT_DIR"
failed=0

case "$MODE" in
  --all)
    while IFS= read -r -d '' file; do
      [[ -f "$file" ]] || continue
      if git check-ignore -q --no-index "$file"; then
        continue
      fi
      scan_file "$file" "$file" || failed=1
    done < <(git ls-files -z)
    ;;
  --staged)
    while IFS= read -r -d '' file; do
      if ! git show ":$file" >"$TEMP_DIR/content" 2>/dev/null; then
        continue
      fi
      scan_file "$file" "$TEMP_DIR/content" || failed=1
    done < <(git diff --cached --name-only --diff-filter=ACMR -z)
    ;;
  *)
    printf 'Usage: %s [--all|--staged]\n' "$0" >&2
    exit 2
    ;;
esac

if [[ "$failed" -ne 0 ]]; then
  printf 'Secret check failed. Move private values to ignored local configuration.\n' >&2
  exit 1
fi

printf 'Secret check passed (%s).\n' "$MODE"
