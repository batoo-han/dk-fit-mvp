# Controlled E2E hydration readiness evidence

**Date:** 2026-09-03
**Scope:** Task 10 follow-up: production-like Node 24 E2E runtime only.

## Root cause

The controlled harness deliberately serves its fixture-only standalone runtime
over loopback HTTP. The production CSP included `upgrade-insecure-requests`,
so Chromium upgraded relative `/_next/static` and `/_next/image` requests to
HTTPS on that loopback port. Those requests failed with `SSL connect error`.
The server-rendered form was consequently visible but React never hydrated it;
an immediate browser fill and submit used the native GET form behavior.

The first red reproduction asserted a client-ready marker immediately after
`networkidle`; it failed in every mobile lead-form case. A second safe browser
diagnostic confirmed failed upgraded Next asset requests. No application API,
SMTP, Telegram, or other external request was made.

## Fix and safety boundary

- The controlled fixture supplies `DK_FIT_E2E_ALLOW_INSECURE_HTTP=true` for
  both the build and owned standalone server.
- Only in that fixture mode, `next.config.ts` omits
  `upgrade-insecure-requests`; the normal production CSP test proves the
  directive remains present.
- `LeadForm` adds `data-client-ready="true"` only after its client effect has
  run. The E2E helper requires this marker before it fills or submits the form.
- The harness continues to use Node 24, fixture-only values, an isolated
  materialized standalone runtime, and owned port/temp cleanup.

## Environment recovery hardening

- Before a controlled build, the harness quarantines only by root filename:
  `.env`, `.env.local`, `.env.development`, `.env.development.local`,
  `.env.production`, `.env.production.local`, `.env.test`, and
  `.env.test.local`. It never reads or logs their contents.
- Restoration runs in reverse order in `finally` and refuses to overwrite a
  newly-created root filename.
- If restoration fails, every still-quarantined file is moved before temporary
  cleanup to a unique directory below `.dk-fit-e2e-recovery/`; the failure
  reports only the filename and recovery path. If that move itself fails, the
  temporary workspace is deliberately retained rather than recursively
  deleting a directory that may contain a user environment file.
- The recovery directory is ignored by Git so a recovered local environment
  file cannot be staged accidentally.

## Fresh results

- Node 24 harness-recovery units: **12 passed**.
- Node 24 controlled no-update visual gate: **3 passed**; loopback port
  `58243` was confirmed closed.
- Header/harness units: **13 passed**.
- Full unit suite: **132 passed**.
- Controlled mobile lead E2E: **7 passed** twice; exact one mocked POST and no
  native local GET navigation.
- No-update DPR1 visual gate: **3 passed**.
- Full controlled browser E2E: **21 passed**, **2 skipped**; loopback port
  `49946` was confirmed closed.

The 390px baseline was refreshed from the accepted controlled production
renderer. It is 390x3003 at DPR 1, preserves the approved mobile composition,
and replaces a stale renderer capture that differed by 2.28% despite no
visible layout or accessibility regression.

No user `.env` value was read or logged. The harness restored the filename in
its `finally` path on every run. No SMTP, Telegram webhook, deploy, or other
external action was performed.
