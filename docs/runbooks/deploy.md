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
2. Obtain the owner-provided author full name, one SMTP account, one lead
   recipient address, Telegram bot credentials, legal operator details, and
   asset-rights confirmation. Do not place any secret value in a command,
   terminal capture, or ticket.
3. In the target deployment environment, run `npm run check:env`.
   The standalone script has no source-TypeScript imports and is the same
   artifact executed by the container entrypoint before `server.js`. It prints
   only invalid or missing key names. Any output or a non-zero exit is a
   **NO-GO**; do not substitute fixture values.
4. Run `npm run smoke:smtp -- --preflight` as the same runtime user. This is a
   second sanitized configuration check; it makes no network request and sends
   no email.
5. Review the pending manual gates: 200% zoom, reduced motion, screen-reader
   pass, provider/hosting readiness, legal inputs, and final asset rights.

For a daemon-free Compose model check, use a controlled non-secret env template
and suppress rendered output:

```powershell
docker compose --env-file .env.example config --no-interpolate --quiet
```

An exit `0` validates the Compose model only. It does not build the image,
contact a Docker daemon, execute the runner preflight, or validate production
environment values.

## Transfer to the server: server-only configuration

Perform these steps only after release-owner authority. They configure the
server but do not send email, bind a Telegram webhook, or publish the service.

1. Keep the repository checkout and image free of `.env` files. On the target
   host, create an owner-controlled file outside the checkout, for example
   `/etc/dk-fit/dk-fit.env`, with permissions restricted to the runtime owner
   (for a root-owned file: `sudo install -m 600 -o root -g root /dev/null
   /etc/dk-fit/dk-fit.env`, then `sudoedit /etc/dk-fit/dk-fit.env`). Do not
   copy, commit, paste into tickets, or capture the file in terminal output.
2. In that server-only file, set `PUBLIC_SITE_URL=https://dnk.batoohan.ru` and
   set one owner-approved address as `LEAD_RECIPIENT_EMAIL`. Do not use a
   `NEXT_PUBLIC_` name and do not place the recipient in client code or a
   reverse-proxy config.
3. Set the remaining owner-provided SMTP values. For a STARTTLS provider use
   `SMTP_SECURE=false` and its STARTTLS port; do not set an implicit-TLS port
   with that mode. The application keeps `requireTLS=true` and
   `rejectUnauthorized=true`, so a plaintext-only server or invalid certificate
   is a hard failure. For implicit TLS, set `SMTP_SECURE=true` (normally port
   465). Never add `NODE_TLS_REJECT_UNAUTHORIZED=0`.
4. Set `DK_FIT_ENV_FILE=/etc/dk-fit/dk-fit.env` only in the deployment shell or
   protected service manager configuration, then use the existing Compose file.
   Compose injects that file into the app while overriding `NODE_ENV=production`
   and the internal Redis URL. Do not change `compose.yaml` to embed secrets.
5. Before any container start, run the sanitized `npm run check:env` and
   `npm run smoke:smtp -- --preflight` as the same runtime user. They may print
   invalid key names only; any output or non-zero exit is a NO-GO. Do not repair
   a failed preflight by substituting fixture values.

## Trusted reverse-proxy boundary

The default Compose mapping exposes the app only as
`127.0.0.1:${DK_FIT_APP_PORT:-3000}` and assumes a trusted reverse proxy on the
same host. The proxy must overwrite `X-Forwarded-For` with exactly one client IP;
it must not forward a client-provided value or use an append-style setting such
as `proxy_add_x_forwarded_for`. For nginx, the relevant contract is:

```nginx
proxy_set_header X-Forwarded-For $remote_addr;
```

The application accepts only one syntactically valid IPv4 or IPv6 address from
that header. Missing, malformed, or comma-separated values share the
fail-closed `unknown` rate-limit identity. If the proxy runs in another
container, attach it to a private Docker network and remove the host port rather
than exposing the app publicly; preserve the same overwrite contract.

## Explicit SMTP smoke

### TLS transport contract

Set `SMTP_SECURE=true` for implicit TLS (normally port 465). Set
`SMTP_SECURE=false` only for a provider that supports STARTTLS: both the lead
mailer and this smoke tool require the TLS upgrade and fail closed if the server
would use plaintext SMTP. Certificate validation is explicitly enabled in both
modes; do not set `NODE_TLS_REJECT_UNAUTHORIZED=0` or add a certificate-bypass
option. The public lead recipient remains the required server-only
`LEAD_RECIPIENT_EMAIL` value.

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

1. Build and publish an immutable image from the approved release commit. Verify
   that the image entrypoint reports a successful sanitized preflight before the
   application starts.
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
