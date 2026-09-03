# Vitest runner separation evidence

> Historical scoped evidence. Vitest now also sets `envDir: false`, and the
> later full lint/Vitest/controlled-E2E gates are green. See
> [`../../qa/evidence/2026-09-03-final-review-fix-wave.md`](../../qa/evidence/2026-09-03-final-review-fix-wave.md)
> for current results.

**Date:** 2026-09-03  
**Scope:** Foundation tooling follow-up for Task 10 QA finding P1.

## Change

`vitest.config.mts` now explicitly includes only the three Vitest-owned roots:

- `tests/unit/`
- `tests/component/`
- `tests/integration/`

Playwright-owned `tests/e2e/` specs are intentionally left to
`npm run test:e2e` and are no longer imported by `npm test`.

## Evidence

The previously recorded red state was Node 24 Vitest collecting all four
Playwright specs and reporting framework collection errors after 124 tests.

After the configuration change:

```powershell
J:\AI\node-v24.16.0-win-x64\node.exe .\node_modules\vitest\vitest.mjs run
```

Result: exit `0`; `Test Files 16 passed (16)` and `Tests 124 passed (124)`.

The Node 24 aggregate command then completed lint, typecheck, Vitest, Next
production build and visual-asset verification before reaching the separate
E2E stage. The initial aggregate runner had a 120-second external command
limit while E2E was in progress. A direct Node 24 `npm.cmd run test:e2e`
subsequently exited `1` after 258.4 seconds with:

```text
E2E prerequisite exited with code 1
```

This scoped change does not alter the E2E harness or any E2E specification.
The remaining E2E failure requires its owning QA/platform investigation.
