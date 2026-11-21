# CLAUDE.md

Guidance for Claude Code in `dupli1-web`, the customer storefront (React Router 7, React 19, Vite, Tailwind v4, SSR; the server is a BFF to the backend gateway).

The full agent guidance is in [AGENTS.md](AGENTS.md) and env setup is in [README.md](README.md); read them before changing anything. This file only adds the working agreements.

## Commands

```bash
npm install
npm run dev          # http://localhost:5173 (needs the ../dupli1 backend for API pages)
npm test             # vitest run
npm run typecheck    # react-router typegen + tsc
npm run build
```

There is no lint script. CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, then a Docker build.

## Working agreements

- **Verify before done.** Run the `verify-change` skill and say which checks ran and which did not.
- **Contract first.** API shapes come from `../dupli1` docs and handlers. Money is `*_won` (whole KRW, never divide by 100); the only live `*_krw` fallback is `shipping_fee_won ?? shipping_fee_krw` in `app/lib/checkout.ts`.
- **Three languages, Korean first.** New copy goes into all of `en`, `ko`, `zh` in `app/lib/i18n.tsx`; follow the Korean naming rules in README.
- **No tokens in the browser.** Authenticated calls go through `/auth/session/gateway`; only auth's `401`/`403` on refresh ends a session.
- **Before committing**, ask the `reviewer` agent to look at the diff.
- Never skip, disable or weaken a test to get green.
