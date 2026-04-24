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
  exit 1
fi

"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" run --rm certbot renew --webroot -w /var/www/certbot --quiet
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" exec nginx nginx -s reload

echo "HTTPS certificates renewed and nginx reloaded."

