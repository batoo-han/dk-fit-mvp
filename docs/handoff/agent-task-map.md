# D&K Fit Agent Handoff Map

## Selected direction

Variant 2, **Editorial Strength**, is approved. The authoritative file is `docs/design/assets/editorial-strength-selected.png`.

SHA-256: `400B4F56F8D4826ED1B370298FD086389CE6872383293DCF10F5EF84CD88D1D9`.

Do not use the concept number from memory alone: open the file before visual implementation.

## Work waves

| Wave | Task | Agent profile | Depends on | Output gate |
|---|---|---|---|---|
| 0 | 1 | foundation-agent | — | repo, build, tests |
| 0 | 2 | foundation-agent | 1 | env and lead contract |
| 1 | 3 | visual-frontend-agent | 2 | approved assets/content |
| 1 | 6 | lead-integration-agent | 2 | Redis contract/tests |
| 1 | 8 | telegram-agent | 2 | webhook/deep-link tests |
| 2 | 4 | visual-frontend-agent | 3 | two-screen design QA pass |
| 2 | 7 | lead-integration-agent | 6 | exact email + lead API |
| 3 | 5 | visual-frontend-agent | 4, 7 contract | complete form UX |
| 3 | 9 | platform-release-agent | 4, 7, 8 | secure production build |
| 4 | 10 | independent-qa-agent | 5, 9 | local/staging GO/NO-GO |
| 5 | 11 | platform-release-agent + QA witness | 10, owner inputs | production verdict |

Tasks 3, 6 and 8 may run in parallel. Every other transition is sequential. The controller dispatches a separate `task-reviewer` after every task.

## File ownership during permitted parallel wave

- Task 3: `public/`, `src/content/`, `scripts/verify-assets.mjs` only.
- Task 6: `src/lib/redis/`, `src/lib/security/fingerprint.ts`, `src/lib/security/request-id.ts`, `src/lib/leads/idempotency.ts`, `src/lib/leads/rate-limit.ts`, related unit tests only.
- Task 8: `src/lib/telegram/`, `src/app/api/telegram/webhook/`, `scripts/set-telegram-webhook.mjs`, Telegram tests only.

If an agent needs a file owned by another concurrent task, it must stop that edit and report the dependency to the controller.

## Inputs already fixed

- Brand: `D&K Fit`.
- Visual: Editorial Strength.
- Notification recipient: required server-only `LEAD_RECIPIENT_EMAIL`.
- Bot behavior: exact thanks on Start, then silence.
- Lead fields: name, phone, optional goal, consent.
- Active SMTP provider is configurable; no fallback.

## Owner inputs required before production

| Input | Used by | Blocks |
|---|---|---|
| production URL and hosting | env, canonical, webhook | Task 11 |
| full author name | email body | real SMTP smoke/release |
| SMTP host/port/TLS/user/password/from and `LEAD_RECIPIENT_EMAIL` | mailer | real lead flow |
| Telegram bot token and username | webhook/deep link | real Telegram smoke |
| legal operator name/contact | privacy page | public release |
| final trainer name/biography, if public | content | content approval only |
| rights to final photo/font assets | public assets | public release |

Development uses test fixtures such as `https://dk-fit.test` and `Тестовый Автор`; these values must never enter production.

## Acceptance evidence

QA collects:

- fresh `npm run verify` output;
- desktop/mobile screenshots and reference comparison;
- accessibility report plus manual keyboard/zoom check;
- sanitized golden email comparison;
- sanitized Telegram webhook/start evidence;
- production env preflight without values;
- deploy/rollback version identifiers;
- final verdict and accepted limitations.

## Explicit rulings

- Redis is included despite the small MVP because it prevents duplicate email/start side effects across multiple Node processes and restarts without storing raw PII.
- No database of leads is included; the mailbox is the only business record in MVP.
- SMTP acceptance is the success boundary. A provider timeout with unknown outcome returns an honest error and must not automatically resend through another provider.
- The landing remains two screens even though `/privacy` exists as a technical route; it is not a third section of the landing.
