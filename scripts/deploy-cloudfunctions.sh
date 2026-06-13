#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
CLOUDBASE_CLI="${CLOUDBASE_CLI:-cloudbase}"
RUNTIME="${CLOUD_FUNCTION_RUNTIME:-Nodejs18.15}"
WORKER_RUNTIME="${CUSTOM_PET_WORKER_RUNTIME:-Nodejs20.19}"
DEPLOY_MODE="${CLOUD_FUNCTION_DEPLOY_MODE:-zip}"
INCLUDE_SHARED_PACKAGE="${CLOUD_FUNCTION_INCLUDE_PACKAGE:-true}"
DEFAULT_FUNCTIONS="login getUserData syncUserData customPetApi customPetWorker customPetRecovery"
read -r -a FUNCTIONS <<< "${CLOUD_FUNCTIONS:-$DEFAULT_FUNCTIONS}"
SHARED_PACKAGE_FILE="$ROOT_DIR/cloudfunctions/package.json"
SHARED_PACKAGE_LOCK_FILE="$ROOT_DIR/cloudfunctions/package-lock.json"
STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cici-brain-training-cloudfunctions.XXXXXX")"

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

for collection in custom_pet_jobs custom_pet_entitlements custom_pet_assets; do
  bootstrap_command="[{\"TableName\":\"$collection\",\"CommandType\":\"INSERT\",\"Command\":\"{\\\"insert\\\":\\\"$collection\\\",\\\"documents\\\":[{\\\"_id\\\":\\\"__bootstrap__\\\"}]}\"}]"
  cleanup_command="[{\"TableName\":\"$collection\",\"CommandType\":\"DELETE\",\"Command\":\"{\\\"delete\\\":\\\"$collection\\\",\\\"deletes\\\":[{\\\"q\\\":{\\\"_id\\\":\\\"__bootstrap__\\\"},\\\"limit\\\":1}]}\"}]"
  "$CLOUDBASE_CLI" --env-id "$ENV_ID" db nosql execute --command "$bootstrap_command" >/dev/null 2>&1 || true
  "$CLOUDBASE_CLI" --env-id "$ENV_ID" db nosql execute --command "$cleanup_command" >/dev/null 2>&1 || true
done

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
    if [[ -f "$SHARED_PACKAGE_LOCK_FILE" ]]; then
      cp "$SHARED_PACKAGE_LOCK_FILE" "$staged_function_dir/package-lock.json"
    fi
  fi
  if [[ -d "$ROOT_DIR/cloudfunctions/shared" ]]; then
    cp -R "$ROOT_DIR/cloudfunctions/shared" "$staged_function_dir/shared"
  fi

  timeout=30
  memory_size=256
  function_runtime="$RUNTIME"
  if [[ "$function_name" == "customPetWorker" ]]; then
    timeout=900
    memory_size=1024
    function_runtime="$WORKER_RUNTIME"
  elif [[ "$function_name" == "customPetRecovery" ]]; then
    timeout=120
  fi
  cat > "$staged_function_dir/cloudbaserc.json" <<EOF
{
  "\$schema": "https://static.cloudbase.net/cli/cloudbaserc.schema.json",
  "envId": "$ENV_ID",
  "functionRoot": ".",
  "functions": [
    {
      "name": "$function_name",
      "runtime": "$function_runtime",
      "handler": "index.main",
      "timeout": $timeout,
      "memorySize": $memory_size
    }
  ]
}
EOF

  echo "Deploying $function_name..."
  (
    cd "$staged_function_dir"
    "$CLOUDBASE_CLI" --env-id "$ENV_ID" --yes fn deploy "$function_name" \
      --force \
      --dir "." \
      --runtime "$function_runtime" \
      --deployMode "$DEPLOY_MODE"
  )
done

echo "Ensuring custom pet recovery timer..."
"$CLOUDBASE_CLI" --env-id "$ENV_ID" --yes fn trigger create customPetRecovery \
  --trigger-name custom-pet-recovery-every-five-minutes \
  --cron "0 */5 * * * * *" >/dev/null 2>&1 || true

echo "CloudBase functions deployed successfully."
