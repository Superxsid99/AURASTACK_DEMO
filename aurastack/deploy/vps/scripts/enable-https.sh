#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/deploy/vps/.env.vps}"
COMPOSE_FILE="$ROOT_DIR/docker-compose.vps.yml"
HTTP_TEMPLATE="$ROOT_DIR/deploy/vps/nginx/http.conf.template"
HTTPS_TEMPLATE="$ROOT_DIR/deploy/vps/nginx/https.conf.template"
TARGET_CONF="$ROOT_DIR/deploy/vps/nginx/default.conf"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
  LEGACY_COMPOSE=false
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
  LEGACY_COMPOSE=true
else
  echo "Neither 'docker compose' nor 'docker-compose' is available."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  echo "Create it from deploy/vps/.env.vps.example"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${APP_HOST:-}" ]]; then
  echo "APP_HOST is required in $ENV_FILE"
  exit 1
fi
API_HOST="${API_HOST:-$APP_HOST}"

if [[ -z "${LETSENCRYPT_EMAIL:-}" ]]; then
  echo "LETSENCRYPT_EMAIL is required in $ENV_FILE"
  exit 1
fi

sed -e "s/__APP_HOST__/${APP_HOST}/g" -e "s/__API_HOST__/${API_HOST}/g" "$HTTP_TEMPLATE" > "$TARGET_CONF"

if [[ "$LEGACY_COMPOSE" == "true" ]]; then
  echo "Legacy docker-compose detected; cleaning old web/proxy containers..."
  "${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" down --remove-orphans || true
  "${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" rm -fsv nginx web api || true
fi

"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" up -d nginx web api

DOMAIN_ARGS=("-d" "$APP_HOST")
if [[ "$API_HOST" != "$APP_HOST" ]]; then
  DOMAIN_ARGS+=("-d" "$API_HOST")
fi

"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  "${DOMAIN_ARGS[@]}" \
  --email "$LETSENCRYPT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive

sed -e "s/__APP_HOST__/${APP_HOST}/g" -e "s/__API_HOST__/${API_HOST}/g" "$HTTPS_TEMPLATE" > "$TARGET_CONF"
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" restart nginx

echo "HTTPS enabled: https://$APP_HOST"
if [[ "$API_HOST" != "$APP_HOST" ]]; then
  echo "HTTPS enabled: https://$API_HOST"
fi
echo "Set renewal cron:"
echo "0 3 * * * cd $ROOT_DIR && ENV_FILE=$ENV_FILE bash deploy/vps/scripts/renew-https.sh >> /var/log/smart-case-buddy-renew.log 2>&1"

