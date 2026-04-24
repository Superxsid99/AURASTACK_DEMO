#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/deploy/vps/.env.vps}"
COMPOSE_FILE="$ROOT_DIR/docker-compose.vps.yml"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "Neither 'docker compose' nor 'docker-compose' is available."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  echo "Create it from deploy/vps/.env.vps.example"
  exit 1
fi

# Ensure shell-exported DATABASE_URL doesn't accidentally override container config.
unset DATABASE_URL

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "Building latest API image for fresh seed..."
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" build --no-cache api

echo "Running database seed using API container..."
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" run --rm api npm run db:seed --workspace @smart-case-buddy/api

echo "Seed completed."

