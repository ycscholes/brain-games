#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(dirname -- "$SCRIPT_DIR")"
GENERATOR_BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/traffic-escape-generator.XXXXXX")"

cleanup() {
  rm -rf "$GENERATOR_BUILD_DIR"
}
trap cleanup EXIT HUP INT TERM

cd "$PROJECT_ROOT"
npm exec -- tsc \
  --target ES2020 \
  --module commonjs \
  --moduleResolution node \
  --strictNullChecks \
  --skipLibCheck \
  --esModuleInterop \
  --types node \
  --rootDir "$PROJECT_ROOT" \
  --outDir "$GENERATOR_BUILD_DIR" \
  scripts/generate-traffic-escape-hard-puzzles.ts

node "$GENERATOR_BUILD_DIR/scripts/generate-traffic-escape-hard-puzzles.js"
