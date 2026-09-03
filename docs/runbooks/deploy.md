# D&K Fit production deployment

This runbook is a release gate, not permission to deploy. Do not deploy, send
SMTP mail, or set the Telegram webhook without explicit owner authority.

## Current verdict

The current release verdict is **NO-GO**. Read
[`../qa/release-verdict.md`](../qa/release-verdict.md) before attempting any
production action.

## Preflight

1. Use Node 24 (`node --version` must report a v24 release) with an explicit
   `NODE_ENV=production`. The release-only smoke rejects a missing or non-production
   value before it constructs an SMTP transport.
2. Obtain the owner-provided production URL/hosting, author full name, one SMTP
   account, Telegram bot credentials, legal operator details, and asset-rights
   confirmation. Do not place any value in a command, terminal capture, or
   ticket.
3. In the target deployment environment, run `npm run check:env`.
   It prints only invalid or missing key names. Any output or a non-zero exit is
   a **NO-GO**; do not substitute fixture values.
4. Run `npm run smoke:smtp -- --preflight` as the same runtime user. This is a
   second sanitized configuration check; it makes no network request and sends
   no email.
5. Review the pending manual gates: 200% zoom, reduced motion, screen-reader
   pass, provider/hosting readiness, legal inputs, and final asset rights.

## Explicit SMTP smoke

The smoke tool is intentionally separate from `/api/leads`; it never changes
the public lead recipient or posts a lead. It will not send until both CLI
arguments are present:

```powershell
npm run smoke:smtp -- --to <owner-approved-test-recipient> --confirm-send
```

It first calls Nodemailer's `verify()`, then sends the fixed marked message:

```text
Subject: D&K Fit — SMTP smoke

D&K Fit SMTP smoke

This is an explicit release-readiness test message.
No lead was submitted.
```

Treat the smoke as passed only when the command reports
`SMTP_SMOKE_ACCEPTED` and the owner confirms inbox/spam-folder delivery. The
script prints neither configuration values nor SMTP failure details. A failed,
timed-out, or ambiguous send is a **NO-GO**: do not retry automatically and do
not add a fallback provider.

## Deployment and external smoke

After all gates pass and explicit authority is recorded:

1. Build and publish an immutable image from the approved release commit.
2. Deploy the image with the matching server-only environment and Redis.
3. Confirm HTTPS before binding the Telegram webhook. Set the webhook only
   through `scripts/set-telegram-webhook.mjs`; verify its URL, pending updates,
   and last error without exposing the token.
4. Check homepage 200, canonical and security headers, and exactly two top-level
   landing sections at desktop and mobile widths.
5. With separate explicit authority, run one real lead and verify the exact
   Telegram redirect only after SMTP acceptance; then verify the bot is silent
   before Start, sends the exact thanks after Start, and ignores ordinary text.
6. Inspect the client bundle, server logs, and an error response for secrets,
   lead PII, and full Telegram updates. Record only sanitized evidence.
7. Run `npm run verify` in the controlled release environment, then update the
   release verdict to GO, GO WITH ACCEPTED RISKS, or NO-GO with evidence links.

Any lost/duplicate lead, false success, PII/secret exposure, broken mobile
form, or broad SMTP/webhook error requires the rollback procedure.
