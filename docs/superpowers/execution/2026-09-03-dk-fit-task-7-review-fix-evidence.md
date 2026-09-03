# Task 7 review-fix evidence — lead request preflight

## Scope

This review-fix addresses only the Task 7 findings:

- an omitted optional `website` honeypot field was treated as spam;
- an explicitly blank `goal` produced an empty email line rather than the approved fallback;
- production `POST` initialized server environment and Redis before it could return the prescribed safe 400/403 request errors.

## TDD evidence

- Red: `node --version; npm test -- tests/unit/email-message.test.ts tests/integration/lead-route.test.ts`
  ran under `v22.15.0` and exited `1` with three expected failures. The blank-goal
  email contained `Цель тренировок: `; an omitted `website` returned `422` rather
  than `201`; and exported production `POST` returned `503` rather than `400`
  when configuration was unavailable.
- Green: `npm test -- tests/unit/email-message.test.ts tests/integration/lead-route.test.ts`
  exited `0` with 19 passing tests. The production-handler regression stubs both
  `getServerEnv()` and `getRedisClient()` as unavailable and verifies that malformed
  content type/body return `400` and an invalid origin returns `403` without calling
  either dependency.

## Verification

- `npm run typecheck` — exit `0`.
- `npx eslint src/app/api/leads/route.ts src/lib/leads/email-message.ts tests/integration/lead-route.test.ts tests/unit/email-message.test.ts` — exit `0`.
- `npm test` — not a Task 7 regression: 95 tests passed, but Vitest also collected
  the Playwright suites under `tests/e2e/` and reported two framework errors
  (`Playwright Test did not expect test() to be called here`). This is outside Task 7
  ownership and pre-exists this review fix.

## Runtime limitation

The repository pins Node `>=24 <25`, but this workspace exposes only Node `v22.15.0`
at `C:\Program Files\nodejs\node.exe`; no `nvm`, `fnm`, `volta`, or alternate Node 24
binary is installed. Therefore a Node 24 green result cannot be honestly recorded in
this workspace. Re-run the Green command above under Node 24 before release.

## Ruling

Production `POST` now applies a dependency-free deny-only preflight in the specified
order: JSON content type/body size and parse, then request-origin validation against
the incoming request URL. It then initializes the server dependencies and retains the
existing configured-origin check before schema, bot, idempotency, rate-limit and SMTP
processing. The configured-origin check remains the authorization boundary; the
preflight only guarantees safe early rejections when configuration or Redis is down.
