# D&K Fit Task 8 execution evidence

## Scope and commit

Task 8 from `docs/superpowers/plans/2026-09-02-dk-fit-implementation.md` implements the registration-only Telegram deep link and webhook.

- Commit: `4a4fba31f763dc29624d211c5698302fd825cb00` (`feat: add registration-only Telegram bot`).
- Production files: `src/lib/telegram/{client,command,dedupe,deep-link}.ts`, `src/app/api/telegram/webhook/route.ts`, and `scripts/set-telegram-webhook.mjs`.
- Tests: `tests/unit/telegram-command.test.ts` and `tests/integration/telegram-webhook.test.ts`.

The webhook accepts the protected private-chat registration Start forms only, sends the exact `Спасибо за регистрацию!` text once, and uses the Task 6 atomic Redis claim with a HMAC chat fingerprint. Raw chat IDs and full update payloads are not written to Redis or logs by Task 8.

## TDD RED evidence

Before Telegram production modules existed, this focused command exited `1`:

```powershell
npm test -- tests/unit/telegram-command.test.ts tests/integration/telegram-webhook.test.ts
```

Vitest reported both expected missing-module failures:

- `Failed to resolve import "../../src/lib/telegram/command"` from `tests/unit/telegram-command.test.ts`;
- `Failed to resolve import "../../src/app/api/telegram/webhook/route"` from `tests/integration/telegram-webhook.test.ts`.

This established that parser/deep-link and webhook behavior was absent rather than already passing.

## GREEN verification

The Node 24 executable was launched with `npx --yes node@24`; its reported version was `v24.20.0`.

```powershell
npx --yes node@24 node_modules/eslint/bin/eslint.js .
npx --yes node@24 node_modules/typescript/bin/tsc --noEmit
npx --yes node@24 node_modules/vitest/vitest.mjs run tests/unit/telegram-command.test.ts tests/integration/telegram-webhook.test.ts
```

All three commands exited `0`. Focused Vitest reported `2 passed` files and `16 passed` tests. The suite covers fixed PII-free deep-link construction; valid and invalid Start parsing; absent/wrong secret rejection; first Start delivery; repeated update and repeated-chat suppression; non-Start/group/non-message silence; and timeout handling without logging the raw update.

`node scripts/set-telegram-webhook.mjs` was also run with no environment values. It exited `1`, printed only the names `PUBLIC_SITE_URL`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_WEBHOOK_SECRET`, and made no network request.

## Limitations and remaining release checks

- No real Telegram webhook was bound and no real bot token was used; production binding remains Task 11 authority.
- Redis and Telegram Bot API were test-injected at the route boundary. A deployed HTTPS + Redis + Telegram smoke test remains required before release.
- The focused Task 8 suite does not run a whole-site build, browser flow, or external webhook delivery; those belong to later platform and QA tasks.
- The verification runtime emitted a host-level `NODE_TLS_REJECT_UNAUTHORIZED=0` warning. Task 8 does not set or rely on that variable; production TLS/environment review remains a release gate.
