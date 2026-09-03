# D&K Fit — независимая QA acceptance matrix

**Task:** 10
**Date:** 2026-09-03
**Verdict:** **NO-GO for local/staging and production**

All browser runs use only non-production fixture configuration in the process
environment. No user `.env` values were read, logged or changed; SMTP and
Telegram requests were intercepted in the browser tests.

| Gate | Evidence | Result | Owner / action |
| --- | --- | --- | --- |
| Valid lead, one request, exact `t.me` redirect | Desktop mocked browser flow: 8/8 passed | PASS | — |
| 422, 429, 503 and offline retain data and stay on page | Desktop mocked browser flow: 8/8 passed | PASS | — |
| Double click / Back / keyboard-only | Desktop mocked browser flow: 8/8 passed | PASS | — |
| Mobile lead form | iPhone 13 profile navigates natively to `/?name=...&phone=...` instead of executing the intercepted `POST /api/leads` | **P0 BLOCKER** | Task 5 owner: make the hydrated form prevent native submission on mobile, then rerun all mobile flow cases. |
| Two sections, visible CTA/form, focus visibility, no horizontal overflow | CSS-pixel matrix (320x568, 390x844, 768x1024, 1440x900) passed in Desktop Chrome profile | PASS | — |
| axe critical/serious | Landing axe gate passed in desktop and iPhone profiles | PASS | — |
| Desktop selected baseline | Approved 1440x900 baseline passed | PASS | — |
| Mobile selected baseline | Approved 390x844 CSS-pixel baseline has 2.315% visibly different pixels | **P1 BLOCKER** | Task 4 owner: inspect current 390 CSS-pixel render against the selected reference, resolve or explicitly approve a renderer-specific residual. |
| Manual keyboard / 200% zoom / reduced motion / screen reader | Not claimable while the mobile form gate is broken. Repeat after the P0 fix; document a real screen-reader path. | BLOCKED | QA witness after Task 5 fix |
| Node 24 local verification | `npm.cmd run verify` ran under Node 24: lint/typecheck passed, then Vitest collected all Playwright `tests/e2e/*.spec.ts` and failed with four `Playwright Test did not expect test()` suite errors. | **P1 BLOCKER** | Foundation/tooling owner: exclude `tests/e2e/` from Vitest collection; rerun full verify after P0/P1 fixes. |
| Docker image build / healthcheck | Docker daemon is unavailable (`//./pipe/docker_engine` missing), so `docker compose build` exits 1. `docker compose config --no-interpolate` exits 0. | BLOCKED | Platform / QA |
| Staging SMTP / Telegram webhook | Not run: requires owner inputs, HTTPS staging endpoint and explicit authority for external effects. | NOT AUTHORIZED | Task 11 |

## Reproduction

Use Node `v24.16.0` and complete non-production fixture values in the invoking
process. Do not load or print a user production environment.

```powershell
$env:DK_FIT_E2E_BASE_URL = 'http://127.0.0.1:3222'
J:\AI\node-v24.16.0-win-x64\node.exe .\node_modules\@playwright\test\cli.js test tests/e2e/lead-form.spec.ts --project=desktop --reporter=line
```

The desktop run must report `8 passed`. The equivalent `--project=mobile` run
currently reproduces the P0 native-form navigation. The CSS-pixel visual gate
uses the Desktop Chrome profile and manually sets the required 1440x900 and
390x844 viewports so the 72-DPI reference files are not compared to an
iPhone device-pixel screenshot.

## Findings needing re-review

1. **P0 — mobile form native navigation.** The navigation includes entered
   fields in the URL, violating the no-client-storage/no-unsafe-submit flow and
   preventing the required success/error behavior. This blocks staging and
   production.
2. **P1 — mobile visual drift.** The 390 CSS-pixel baseline has a visible
   mismatch ratio of `0.023152061613600075` against
`editorial-strength-mobile-mobile-win32.png`; the allowed QA threshold is
`0.003`. This blocks the visual gate until a visual owner investigates it.
3. **P1 — aggregate verify is not runnable.** `vitest.config.mts` includes
   `tests/**/*.{test,spec}.{ts,tsx}`, so it imports Playwright E2E specs during
   `npm test`. This makes `npm run verify` stop before its build/assets/E2E
   stages. Exclude the E2E folder from the Vitest glob and re-run the whole
   script after the functional fixes.
4. **Configuration note.** The production runtime rejects `SMTP_SECURE=false`;
   the QA fixture used `SMTP_PORT=465` and `SMTP_SECURE=true`. Confirm the final
   SMTP provider settings before release, especially if using port 587.

## Commands and observed results

- `J:\AI\node-v24.16.0-win-x64\node.exe .\scripts\run-e2e.mjs tests/e2e/lead-form.spec.ts --project=desktop --reporter=line`
  — exit `0`, `Playwright: 8 passed`, loopback port `61654` closed.
- The same Node 24 harness command with `--project=mobile` — exit `1` after
  `70.5s`; the directly reported Playwright reproduction shows native
  `/?name=...` navigation for all seven form cases (one keyboard case skipped).
- `J:\AI\node-v24.16.0-win-x64\node.exe .\node_modules\eslint\bin\eslint.js tests/e2e/landing.spec.ts tests/e2e/lead-form.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/visual.spec.ts`
  — exit `0`.
- `npm.cmd run verify` with Node 24 first on `PATH` and fixture-only env — exit
  `1`: lint/typecheck passed; `npm test` had `124 passed` unit/component tests
  but failed on four Playwright suite collection errors.
- `docker compose build` — exit `1` because the Docker daemon is unavailable.
  `docker compose config --no-interpolate` — exit `0` with output suppressed.
