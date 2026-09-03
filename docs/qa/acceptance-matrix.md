# D&K Fit — independent QA acceptance matrix

**Task:** Task 10 evidence plus final-review fix wave

**Date:** 2026-09-03

**Reviewed code commit:** `86a11f3`
**Verdict:** **Local automated gates pass; production remains NO-GO.**

The final-fix verification used Node 24 only after Vitest was configured with
`envDir: false`. Vitest therefore did not load root dotenv files. The browser
run used the controlled fixture harness: it quarantined only recognized root
dotenv filenames without reading their contents, restored them in `finally`,
mocked lead/Telegram navigation, and used an owned loopback port. No SMTP,
Redis, Telegram, webhook, deploy, Docker daemon, or user environment value was
contacted.

| Gate | Fresh evidence | Result | Owner / action |
| --- | --- | --- | --- |
| Final-review regressions | Targeted Node 24 run: 7 files, 69 tests passed. Covers standalone runner preflight, Vitest isolation, Telegram definite-failure retry/new Start and unknown-outcome suppression, trusted-proxy IP parsing, loopback Compose binding, Redis claim ownership, and goal-tab rejection. | PASS | — |
| Full Vitest roots | `tests/unit`, `tests/component`, and `tests/integration`: 21 files, 154 tests passed. `tests/e2e` remains Playwright-owned. | PASS | — |
| Full lint gate | Node 24 `eslint .` exited 0. The former `.d.mts` parsing finding is no longer a blocker. | PASS | — |
| Typecheck and assets | Node 24 `tsc --noEmit` exited 0; asset verifier reported four reviewed assets. | PASS | — |
| Controlled browser E2E | Current-tree harness reported 21 Playwright tests passed and confirmed its loopback port closed. Existing success/error/double-click/Back/keyboard, viewport, axe, and visual gates remain green. | PASS | — |
| Vitest dotenv isolation | Config regression proves `envDir: false`; the full Vitest run completed without the prior root-dotenv parse path. | PASS | — |
| Runner preflight artifact | A regression copied only the runner's `scripts/check-env.mjs` artifact into a temporary runner layout. Valid fixtures exited 0; an unsafe integer exited 1 with only its key name. No source TypeScript import was needed. | PASS (FIXTURE/STATIC) | Execute the built image entrypoint with production inputs on the release host. |
| Trusted proxy and rate-limit identity | Compose binds app to host loopback. One valid IPv4/IPv6 proxy value is accepted; missing, malformed, or comma-separated XFF values use the shared fail-closed `unknown` identity. | PASS (CODE/CONFIG) | Verify the deployed proxy overwrites XFF and public traffic cannot bypass it. |
| Docker Compose model | `docker compose --env-file .env.example config --no-interpolate --quiet` exited 0 without a daemon. | PASS (MODEL ONLY) | This does not prove image build, entrypoint, health, or production values. |
| Docker image build/runtime | Not run; raw build and Docker daemon use were outside this fix wave. | BLOCKED / NOT RUN | Platform/QA on a Docker-capable release host. |
| 200% zoom, reduced motion, screen-reader path | Not independently executed in this fix wave. Automated keyboard/focus/axe checks do not replace the manual release checklist. | OPEN | Complete before a production verdict. |
| Production SMTP / Telegram webhook / deploy | External effects and an HTTPS production endpoint were not authorized. | NOT AUTHORIZED | Task 11 with owner inputs and explicit authority. |

## Reproduction

Run from `dk-fit` with Node `v24.16.0`. Do not source or print a user
environment file:

```powershell
J:\AI\node-v24.16.0-win-x64\node.exe .\node_modules\vitest\vitest.mjs run
J:\AI\node-v24.16.0-win-x64\node.exe .\scripts\run-e2e.mjs --reporter=line
J:\AI\node-v24.16.0-win-x64\node.exe .\node_modules\eslint\bin\eslint.js .
J:\AI\node-v24.16.0-win-x64\node.exe .\node_modules\typescript\bin\tsc --noEmit
J:\AI\node-v24.16.0-win-x64\node.exe .\scripts\verify-assets.mjs
docker compose --env-file .env.example config --no-interpolate --quiet
```

`npm run verify` was not invoked because its raw build stage was explicitly
outside this fix wave. The controlled E2E harness performed its fixture-only
build safely. Compose model validation is intentionally reported separately
from an image build or daemon-backed runtime check.

## Remaining production blockers

There is no current lint blocker. Production remains NO-GO pending owner
inputs, Docker image/entrypoint verification, trusted-proxy deployment
verification, manual accessibility, authorized SMTP and Telegram smokes, HTTPS
deployment, privacy/log inspection, and broad review.

The earlier Task 10 snapshot is retained as historical evidence in
[`2026-09-03-task-10-rerun.md`](evidence/2026-09-03-task-10-rerun.md). The
current fix-wave evidence is
[`2026-09-03-final-review-fix-wave.md`](evidence/2026-09-03-final-review-fix-wave.md).
