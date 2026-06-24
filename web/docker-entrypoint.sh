#!/bin/sh
set -eu

CERT_DIR=/etc/nginx/certs
FULLCHAIN="${CERT_DIR}/fullchain.pem"
PRIVKEY="${CERT_DIR}/privkey.pem"
TLS_CN="${TLS_CN:-localhost}"

mkdir -p "${CERT_DIR}"

if [ ! -f "${FULLCHAIN}" ] || [ ! -f "${PRIVKEY}" ]; then
  echo "No TLS certificates found — generating self-signed cert for CN=${TLS_CN}"
  openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout "${PRIVKEY}" \
    -out "${FULLCHAIN}" \
    -subj "/CN=${TLS_CN}"
fi

exec nginx -g "daemon off;"
