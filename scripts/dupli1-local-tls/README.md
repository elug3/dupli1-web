# Wire local TLS into the Dupli1 nginx gateway

Implements [elug3/dupli1#48](https://github.com/elug3/dupli1/issues/48): self-signed certs in `certs/` are mounted into `dupli1-proxy`, but `api/nginx.conf` previously listened on HTTP only.

## What this does

1. Installs a dual-mode `api/nginx.conf` (HTTP `:80` + HTTPS `:443`) into a sibling `dupli1` checkout.
2. Regenerates `certs/server.crt` / `certs/server.key` with a `localhost` SAN (modern TLS clients reject CN-only certs).
3. Prints how to rebuild the proxy and point `dupli1-web` at HTTPS.

Production is unchanged: ALB terminates TLS; ECS tasks still use `http://proxy.dupli1.local`.

## Apply

From this repo (with `../dupli1` present, or `DUPLI1_REPO` set):

```bash
./scripts/dupli1-local-tls/apply.sh
```

Then rebuild the gateway:

```bash
cd ../dupli1   # or $DUPLI1_REPO
sudo docker compose up -d --build dupli1-proxy
curl -k https://localhost:443/gateway/health
curl http://localhost:8080/gateway/health   # still works (dual-mode)
```

## Point the storefront at HTTPS

In `dupli1-web` `.env` (or the shell):

```bash
DUPLI1_API_BASE_URL=https://localhost:443
DUPLI1_API_CA_FILE=../dupli1/certs/server.crt
```

`DUPLI1_API_CA_FILE` trusts the local gateway cert for BFF `fetch` without disabling TLS verification globally. HTTP (`http://localhost:8080`) remains the default and needs no CA file.
