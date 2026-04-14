#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
CLOUDBASE_CLI="${CLOUDBASE_CLI:-cloudbase}"
RUNTIME="${CLOUD_FUNCTION_RUNTIME:-Nodejs18.15}"
DEPLOY_MODE="${CLOUD_FUNCTION_DEPLOY_MODE:-zip}"
INCLUDE_SHARED_PACKAGE="${CLOUD_FUNCTION_INCLUDE_PACKAGE:-true}"
FUNCTIONS=("login" "getUserData" "syncUserData")
SHARED_PACKAGE_FILE="$ROOT_DIR/cloudfunctions/package.json"
STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/xiaoyuyuan-cloudfunctions.XXXXXX")"

cleanup() {
  rm -rf "$STAGING_DIR"
}

trap cleanup EXIT

read_env_value() {
  local key="$1"
  local file="$2"

  if [[ ! -f "$file" ]]; then
    return 0
  fi

  grep -E "^${key}=" "$file" | tail -n 1 | sed -E "s/^${key}=//; s/^\"//; s/\"$//"
}

ENV_ID="${TARO_CLOUD_ENV_ID:-$(read_env_value "TARO_CLOUD_ENV_ID" "$ENV_FILE")}"

if [[ -z "$ENV_ID" ]]; then
  echo "Missing TARO_CLOUD_ENV_ID. Set TARO_CLOUD_ENV_ID or configure it in $ENV_FILE." >&2
  exit 1
fi

if ! command -v "$CLOUDBASE_CLI" >/dev/null 2>&1; then
  echo "CloudBase CLI not found. Install it with: npm install -g @cloudbase/cli" >&2
  exit 1
fi

if [[ ! -f "$SHARED_PACKAGE_FILE" ]]; then
  echo "Missing shared cloud function package file: $SHARED_PACKAGE_FILE" >&2
  exit 1
fi

cd "$ROOT_DIR"

echo "Deploying CloudBase functions to env: $ENV_ID"

for function_name in "${FUNCTIONS[@]}"; do
  function_dir="cloudfunctions/$function_name"
  staged_function_dir="$STAGING_DIR/$function_name"

  if [[ ! -d "$function_dir" ]]; then
    echo "Missing function directory: $function_dir" >&2
    exit 1
  fi

  mkdir -p "$staged_function_dir"
  find "$function_dir" -mindepth 1 -maxdepth 1 \
    ! -name "node_modules" \
    ! -name "package.json" \
    ! -name "package-lock.json" \
    -exec cp -R {} "$staged_function_dir/" \;
  if [[ "$INCLUDE_SHARED_PACKAGE" == "true" ]]; then
    cp "$SHARED_PACKAGE_FILE" "$staged_function_dir/package.json"
  fi

  echo "Deploying $function_name..."
  (
    cd "$staged_function_dir"
    "$CLOUDBASE_CLI" --env-id "$ENV_ID" --yes fn deploy "$function_name" \
      --force \
      --runtime "$RUNTIME" \
      --deployMode "$DEPLOY_MODE"
  )
done

echo "CloudBase functions deployed successfully."
