#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---check}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/asset-backups/cloudbase-images"
CLOUD_DIR="${CLOUDBASE_IMAGE_CLOUD_DIR:-assets}"
ENV_ID="${TARO_CLOUD_ENV_ID:-${CLOUD_ENV_ID:-}}"

required_files=(
  "pets/cat-idle.png"
  "pets/cat-feed.png"
  "pets/cat-cuddle.png"
  "pets/cat-hungry.png"
  "pets/dog-idle.png"
  "pets/dog-feed.png"
  "pets/dog-cuddle.png"
  "pets/dog-hungry.png"
  "pets/rabbit-idle.png"
  "pets/rabbit-feed.png"
  "pets/rabbit-cuddle.png"
  "pets/rabbit-hungry.png"
  "pets/bear-idle.png"
  "pets/bear-feed.png"
  "pets/bear-cuddle.png"
  "pets/bear-hungry.png"
  "pets/panda-idle.png"
  "pets/panda-feed.png"
  "pets/panda-cuddle.png"
  "pets/panda-hungry.png"
  "pets/gecko-idle.png"
  "pets/gecko-feed.png"
  "pets/gecko-cuddle.png"
  "pets/gecko-hungry.png"
  "pets/turtle-idle.png"
  "pets/turtle-feed.png"
  "pets/turtle-cuddle.png"
  "pets/turtle-hungry.png"
  "previews/pet-sheet-preview.png"
  "app-icons/app-icon-daily-brain-training.png"
  "app-icons/app-icon-daily-brain-training-line.png"
)

check_assets() {
  local missing=0

  for file in "${required_files[@]}"; do
    if [[ ! -s "$BACKUP_DIR/$file" ]]; then
      printf 'Missing asset backup: %s\n' "$BACKUP_DIR/$file" >&2
      missing=1
    fi
  done

  if [[ "$missing" -ne 0 ]]; then
    return 1
  fi

  printf 'Asset backup check passed: %s\n' "$BACKUP_DIR"
}

upload_assets() {
  check_assets

  if [[ -z "$ENV_ID" ]]; then
    printf 'Set TARO_CLOUD_ENV_ID or CLOUD_ENV_ID before uploading.\n' >&2
    return 1
  fi

  if ! command -v tcb >/dev/null 2>&1; then
    printf 'CloudBase CLI "tcb" is required. Install and login before uploading.\n' >&2
    return 1
  fi

  while IFS= read -r local_file; do
    relative_path="${local_file#$BACKUP_DIR/}"
    tcb storage upload "$local_file" "$CLOUD_DIR/$relative_path" --env-id "$ENV_ID"
  done < <(find "$BACKUP_DIR" -type f ! -name 'README.md' | sort)

  printf 'Uploaded %s to CloudBase storage path: %s\n' "$BACKUP_DIR" "$CLOUD_DIR"
}

case "$MODE" in
  --check)
    check_assets
    ;;
  --upload)
    upload_assets
    ;;
  *)
    printf 'Usage: %s [--check|--upload]\n' "$0" >&2
    exit 2
    ;;
esac
