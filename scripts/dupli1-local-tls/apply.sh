#!/usr/bin/env bash
# Wire local TLS into the sibling dupli1 nginx gateway (elug3/dupli1#48).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

DUPLI1_REPO="${DUPLI1_REPO:-}"
if [[ -z "$DUPLI1_REPO" ]]; then
  if [[ -d "$WEB_ROOT/../dupli1/api" ]]; then
    DUPLI1_REPO="$(cd "$WEB_ROOT/../dupli1" && pwd)"
  elif [[ -d /tmp/dupli1/api ]]; then
    DUPLI1_REPO="/tmp/dupli1"
  else
    echo "error: cannot find dupli1 checkout. Set DUPLI1_REPO=/path/to/dupli1" >&2
    exit 1
  fi
fi

if [[ ! -d "$DUPLI1_REPO/api" || ! -d "$DUPLI1_REPO/certs" ]]; then
  echo "error: $DUPLI1_REPO does not look like the dupli1 backend (need api/ and certs/)" >&2
  exit 1
fi

echo "==> Using dupli1 at $DUPLI1_REPO"

BACKUP="$DUPLI1_REPO/api/nginx.conf.bak.$(date +%Y%m%d%H%M%S)"
cp "$DUPLI1_REPO/api/nginx.conf" "$BACKUP"
echo "==> Backed up nginx.conf -> $BACKUP"

cp "$SCRIPT_DIR/nginx.conf" "$DUPLI1_REPO/api/nginx.conf"
echo "==> Installed dual-mode HTTP+HTTPS nginx.conf"

if ! command -v openssl >/dev/null 2>&1; then
  echo "warn: openssl not found; leaving existing certs/ as-is" >&2
else
  echo "==> Regenerating certs/server.{crt,key} with localhost SAN"
  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "$DUPLI1_REPO/certs/server.key" \
    -out "$DUPLI1_REPO/certs/server.crt" \
    -days 825 \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
    >/dev/null 2>&1
  chmod 644 "$DUPLI1_REPO/certs/server.crt"
  chmod 600 "$DUPLI1_REPO/certs/server.key"
fi

cat <<EOF

Done. Rebuild and verify the gateway:

  cd $DUPLI1_REPO
  sudo docker compose up -d --build dupli1-proxy
  curl -k https://localhost:443/gateway/health
  curl http://localhost:8080/gateway/health

Point dupli1-web at HTTPS (optional):

  DUPLI1_API_BASE_URL=https://localhost:443
  DUPLI1_API_CA_FILE=$DUPLI1_REPO/certs/server.crt

Commit the nginx.conf + cert changes in the dupli1 repo to close
https://github.com/elug3/dupli1/issues/48 (this agent cannot push there).

EOF
