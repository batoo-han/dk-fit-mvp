# D&K Fit release verdict

**Verdict: NO-GO for production** — refreshed 2026-09-03 after code commit
`86a11f3`. No production action was authorized or performed.

Local automated code gates are green; the remaining blockers require owner
inputs, a Docker-capable release host, manual QA, or separately authorized
external smoke.

## Evidence and gates

| Gate | Status | Evidence / required next step |
| --- | --- | --- |
| Vitest dotenv isolation | PASS LOCALLY | `envDir: false` is covered by a config regression test. Node 24 full Vitest: 21 files, 154 tests passed without loading root dotenv through Vitest. |
| Code quality | PASS LOCALLY | Node 24 ESLint and `tsc --noEmit` exited 0 on the final-fix code commit. The earlier declaration-file lint blocker is resolved. |
| Controlled browser E2E | PASS LOCALLY | Fixture-only harness: 21 Playwright tests passed; its owned loopback port closed and its dotenv filename quarantine was restored. No external provider was contacted. |
| Runner environment preflight | FIXTURE PASS / PRODUCTION NOT RUN | A runner-layout regression test copies only `scripts/check-env.mjs` and executes it successfully with fixture inputs. The real production environment was not inspected or validated. |
| Trusted ingress topology | CONFIGURED / DEPLOYMENT CHECK PENDING | Compose binds app to host loopback and the lead route accepts only one valid trusted-proxy IP header value. The deployed reverse proxy must overwrite `X-Forwarded-For` and must not expose the app port publicly. |
| Docker Compose model | PASS LOCALLY | `docker compose --env-file .env.example config --no-interpolate --quiet` exited 0 without contacting a daemon. This is syntax/model validation only. |
| Docker image build and runner | NOT RUN | Docker daemon/image build was outside this fix wave. Build the image and execute the entrypoint/preflight on the release host. |
| Safe production preflight | NOT RUN | Run the sanitized preflight against owner-supplied production values on the release host; record key names/status only, never values. |
| SMTP verify and explicit smoke | NOT RUN | No external SMTP verification or email send was authorized. The smoke tool still requires an explicit recipient and `--confirm-send`. |
| HTTPS deploy and Telegram webhook | NOT RUN | No hosting/production URL approval or external action was authorized. |
| Manual accessibility | PENDING | 200% zoom, reduced-motion, and screen-reader checks remain to be witnessed. |
| Legal/operator inputs | PENDING | Owner must supply production legal operator name and contact. |
| Asset rights | PENDING | Owner must confirm final hero-photo and font rights. |
| Privacy/log review | PENDING | Complete only against the deployed release with sanitized evidence. |

## Release conditions

Do not change this verdict until every production blocker has supporting
sanitized evidence. A GO requires the owner inputs listed in the spec, an image
build and runner preflight on Node 24, verified trusted-proxy behavior,
authorized SMTP/Telegram smokes, deployment checks, manual accessibility and
privacy/log review, plus a broad code review.

The public `/api/leads` recipient remains exactly
`superhumansmm@yandex.ru`. This release-only smoke utility does not modify that
handler.
