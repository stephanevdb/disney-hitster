#!/bin/sh
set -eu

CERT_DIR=/etc/nginx/certs
FULLCHAIN="${CERT_DIR}/fullchain.pem"
PRIVKEY="${CERT_DIR}/privkey.pem"
TLS_CN="${TLS_CN:-localhost}"
SONGS_PATH="${SONGS_PATH:-/data/songs.json}"

mkdir -p "${CERT_DIR}"
mkdir -p "$(dirname "${SONGS_PATH}")"

if [ ! -f "${FULLCHAIN}" ] || [ ! -f "${PRIVKEY}" ]; then
  echo "No TLS certificates found — generating self-signed cert for CN=${TLS_CN}"
  openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout "${PRIVKEY}" \
    -out "${FULLCHAIN}" \
    -subj "/CN=${TLS_CN}"
fi

if [ -n "${ADMIN_PASSWORD:-}" ]; then
  echo "Starting admin API on port ${ADMIN_API_PORT:-3001}"
  SONGS_PATH="${SONGS_PATH}" ADMIN_PASSWORD="${ADMIN_PASSWORD}" ADMIN_API_PORT="${ADMIN_API_PORT:-3001}" \
    npx tsx /app/server/admin-api.ts &
else
  echo "ADMIN_PASSWORD not set — admin API disabled"
fi

exec nginx -g "daemon off;"
