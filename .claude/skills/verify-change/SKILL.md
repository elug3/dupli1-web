---
name: verify-change
description: Run the same checks CI runs on dupli1-web (unit tests, typecheck, build). Use before saying a change is done, before committing, or when asked to "verify" or "check CI".
---

# Verify a dupli1-web change

CI (`.github/workflows/ci.yml`) runs these, in this order. Run them the same way and stop at the first failure.

```bash
npm test             # vitest run
npm run typecheck    # react-router typegen + tsc
npm run build        # when routes, config, BFF/SSR or i18n changed
```

There is no lint script and no browser test suite here; do not claim either was run. For UI changes, say plainly that the rendering was not exercised unless you actually ran `npm run dev` against the `../dupli1` backend and looked at it.

Also check by reading the diff:

- Every new string exists in `en`, `ko` and `zh` in `app/lib/i18n.tsx`.
- Prices display as whole KRW; no `*_krw` / `*_cents` added.
- No token or session id reaches client code.

Report what ran and what did not. If something fails, show the output and the cause; never skip or weaken a test to get green.
