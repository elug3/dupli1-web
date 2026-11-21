# Agent notes

Short, verified lessons from past agent sessions. The planner reads this first. Add at most five bullets per run, each naming where it came from; delete lines that go stale. Standing rules belong in CLAUDE.md, proposed to a human, not written here.

## 2026-11-21: dead-code cleanup (stray files + 16 unused exports)
- Removal-only changes: a guard test that pins "symbol X is gone" fails first but adds no coverage; the reviewer rated it brittle (it blocks a legitimate re-add). Prove removals with `grep -rnw` over the repo plus `npm run typecheck` and `npm run build`, and skip the guard test.
- `npx tsc --noEmit --noUnusedLocals` shows two unused imports that predate any cleanup: `app/routes/pages/cart.tsx:34` (`formatCurrency`) and `app/routes/pages/product.tsx:38` (`useCart`). Good next candidates; do not blame a new change for them.
- Unused i18n keys in `app/lib/i18n.tsx`: counts disagree (about 115 vs about 221 per language) because `color.*`, `value.*`, `language.*` and `nav.*` look built at runtime. Resolve those prefixes by hand before deleting any key.
- The session's branch is fixed and `claude/determined-curie-0t8xn8` already has an open PR, so a pipeline push updates that PR rather than opening a new one.
