# AGENTS.md

Guidance for AI agents working in `dupli1-web`.

`dupli1-web` is the **customer-facing storefront** for the Dupli1 fashion-bag marketplace: a React Router 7 (React 19 + Vite + Tailwind v4) SSR app. The browser talks only to same-origin routes; the React Router server acts as a BFF and forwards `/api/v1/*` calls to the backend nginx gateway. Standard commands (`npm run dev`, `npm run build`, `npm run start`, `npm run typecheck`) and env vars are documented in [README.md](README.md).

## Cursor Cloud specific instructions

- Dependencies (`npm install`) are refreshed automatically by the cloud update script; no manual install needed on a fresh VM.
- Dev server: `npm run dev` (defaults to `http://localhost:5173`). The sibling admin app (`dupli1-manage-web`) also defaults to 5173, so if you run both at once, start one on another port, e.g. `npm run dev -- --port 5174`.
- This app needs the **`dupli1` backend running** (nginx gateway at `http://localhost:8080`). See `../dupli1/AGENTS.md` for starting Docker + `docker compose up`. Without it, pages that hit the API return errors.
- Env vars the SSR/BFF reads (set before `npm run dev`):
  - `DUPLI1_API_BASE_URL=http://localhost:8080` — the gateway.
  - `DUPLI1_WEB_SERVICE_TOKEN=<access_token>` — required only for **customer registration**. It's a short-lived (~15 min) access token for the seeded `dupli1-web@web.dupli1.com` service account. Mint one against the running backend: `POST /api/v1/auth/login` (email `dupli1-web@web.dupli1.com`, password `dupli1-web-dev-secret`) → take `refresh_token` → `POST /api/v1/auth/refresh` → use the returned `token`. Browsing/catalog does not need it.
