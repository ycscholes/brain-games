#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---check}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/asset-backups/cloudbase-audio/v1"
CLOUD_DIR="${CLOUDBASE_AUDIO_CLOUD_DIR:-assets/audio/v1}"
ENV_ID="${TARO_CLOUD_ENV_ID:-${CLOUD_ENV_ID:-}}"
required_files=("focus-ambient.m4a" "tap.m4a" "correct.m4a" "wrong.m4a" "complete.m4a")

check_assets() {
  local missing=0
  for file in "${required_files[@]}"; do
    if [[ ! -s "$BACKUP_DIR/$file" ]]; then
      printf 'Missing audio backup: %s\n' "$BACKUP_DIR/$file" >&2
      missing=1
    fi
  done
  [[ "$missing" -eq 0 ]] || return 1
  printf 'Audio backup check passed: %s\n' "$BACKUP_DIR"
}

upload_assets() {
  check_assets
  [[ -n "$ENV_ID" ]] || { printf 'Set TARO_CLOUD_ENV_ID or CLOUD_ENV_ID before uploading.\n' >&2; return 1; }
  command -v tcb >/dev/null || { printf 'CloudBase CLI "tcb" is required. Install and login before uploading.\n' >&2; return 1; }
  tcb env use "$ENV_ID" >/dev/null
  for file in "${required_files[@]}"; do
    tcb storage upload "$BACKUP_DIR/$file" "$CLOUD_DIR/$file"
  done
  printf 'Uploaded audio assets to CloudBase storage path: %s\n' "$CLOUD_DIR"
}

case "$MODE" in
  --check) check_assets ;;
  --upload) upload_assets ;;
  *) printf 'Usage: %s [--check|--upload]\n' "$0" >&2; exit 2 ;;
esac
