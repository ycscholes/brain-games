#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---check}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/asset-backups/cloudbase-images"
ASSET_MANIFEST="$ROOT_DIR/config/remote-assets.json"
CLOUD_DIR="${CLOUDBASE_IMAGE_CLOUD_DIR:-assets}"
ENV_ID="${TARO_CLOUD_ENV_ID:-${CLOUD_ENV_ID:-}}"
PET_ASSET_VERSION="$(
  node -e 'const manifest = require(process.argv[1]); process.stdout.write(manifest.petAssetVersion)' "$ASSET_MANIFEST"
)"

required_files=(
  "pets/cat-idle.png"
  "pets/cat-feed.png"
  "pets/cat-cuddle.png"
  "pets/cat-hungry.png"
  "pets/cat-reference-sheet.png"
  "pets/pose-reference-sheet.png"
  "pets/dog-idle.png"
  "pets/dog-feed.png"
  "pets/dog-cuddle.png"
  "pets/dog-hungry.png"
  "pets/food-apple.png"
  "pets/food-bamboo-rice.png"
  "pets/food-beef-bone.png"
  "pets/food-berry.png"
  "pets/food-biscuit.png"
  "pets/food-carrot.png"
  "pets/food-cricket-cup.png"
  "pets/food-fish.png"
  "pets/food-greens.png"
  "pets/food-honey-jar.png"
  "pets/food-meat.png"
  "pets/food-pumpkin.png"
  "pets/food-salmon.png"
  "pets/food-shrimp-greens.png"
  "pets/food-strawberry-basket.png"
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

  if [[ ! "$PET_ASSET_VERSION" =~ ^v[0-9]+$ ]]; then
    printf 'Invalid pet asset version in %s: %s\n' "$ASSET_MANIFEST" "$PET_ASSET_VERSION" >&2
    return 1
  fi

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

  tcb env use "$ENV_ID" >/dev/null

  while IFS= read -r local_file; do
    relative_path="${local_file#$BACKUP_DIR/}"
    cloud_path="$CLOUD_DIR/$relative_path"
    if [[ "$relative_path" == pets/* ]]; then
      cloud_path="$CLOUD_DIR/$PET_ASSET_VERSION/$relative_path"
    fi
    tcb storage upload "$local_file" "$cloud_path"
  done < <(find "$BACKUP_DIR" -type f ! -name 'README.md' | sort)

  printf 'Uploaded pet assets to CloudBase storage path: %s/%s/pets\n' "$CLOUD_DIR" "$PET_ASSET_VERSION"
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
