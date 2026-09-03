# Final-review fix wave evidence

**Date:** 2026-09-03

**Base commit:** `5fbff9e`

**Code commit:** `86a11f3`

## Scope and safety

This wave addressed only the final Important findings: production runner
preflight packaging, Vitest dotenv isolation, Telegram definite-failure retry
safety, trusted-proxy rate-limit identity, and the directly related goal-tab
and documentation corrections.

No root dotenv value was read or printed. No SMTP/Telegram provider, webhook,
deployment, raw build, or Docker daemon was invoked. The public lead-recipient
configuration and the release-only SMTP smoke contract were not changed.

## TDD evidence

- Before any Node 24 test invocation, a dependency-free PowerShell check exited
  1 with `RED: Vitest dotenv isolation is absent`. `envDir: false` was then added
  as the safety prerequisite.
- The first scoped Node 24 RED run reported 5 failing files and 9 expected
  failures: runner `ERR_MODULE_NOT_FOUND` for `src/lib/config/env.ts`, Telegram
  retry/new Start suppression, spoofable/malformed XFF acceptance, public
  Compose binding, and accepted goal tabs.
- A separate Redis ownership-release test failed because
  `releaseRedisKeysIfOwned` did not exist.
- After the minimal fixes, the targeted suite passed: 7 files, 69 tests.

## Fresh verification

| Command | Result |
| --- | --- |
| Node 24 full Vitest | exit 0; 21 files, 154 tests passed |
| Node 24 full ESLint | exit 0 |
| Node 24 `tsc --noEmit` | exit 0 |
| Node 24 controlled E2E harness | exit 0; 21 Playwright tests passed; owned loopback port 63338 closed |
| Node 24 asset verifier | exit 0; four reviewed assets |
| `docker compose --env-file .env.example config --no-interpolate --quiet` | exit 0; model validation only, no daemon |
| `git diff --check` before code commit | exit 0; only line-ending conversion warnings |

The first E2E attempt was aborted by an overly short shell timeout and is not
counted as evidence. The harness had moved the root dotenv filename into its
owned quarantine directory before termination. The filename was detected and
restored with an exact move without reading its contents; the generated
temporary directory was removed only after confirming no quarantined file
remained. The subsequent complete harness run restored normally. A final
filename-only check found the root dotenv files present and no E2E temporary or
recovery path.

## Result and limitations

- The runner now executes a single standalone, dependency-free preflight
  artifact before `exec node server.js`; the regression simulates that exact
  minimal runner layout. A real image build/entrypoint run remains pending.
- A definite `TelegramDeliveryError` releases only markers owned by its claim,
  enabling a retry or new Start. Unknown outcomes retain markers and suppress
  blind resend.
- Compose binds the app to loopback. The deployment remains responsible for a
  trusted proxy that overwrites XFF with one client IP.
- Compose model validation passed without a daemon; image build/runtime was not
  tested and is reported separately.
- Local automated gates are green, including lint. Production remains NO-GO
  for the external/manual gates listed in the release verdict.
