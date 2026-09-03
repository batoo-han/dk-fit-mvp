# D&K Fit rollback

Use this procedure only with release-owner authority. It is required for a
lost or duplicate lead, false success, PII/secret exposure, broken mobile
form, or a broad SMTP/Telegram webhook failure.

1. Stop further public rollout and preserve sanitized timestamps, release image
   identifiers, request IDs, and error classes. Never copy credentials, lead
   content, raw phone numbers, or full Telegram updates into incident notes.
2. Select the last known-good immutable image and its matching server-only
   environment. Do not roll back code while leaving an incompatible environment
   in place.
3. Redeploy that image with Redis health checked, then confirm the homepage is
   available over HTTPS.
4. Rebind the Telegram webhook to the restored HTTPS URL with
   `scripts/set-telegram-webhook.mjs`. Confirm the configured URL, pending
   updates, and last error using sanitized evidence only.
5. Re-run non-sending preflight (`npm run check:env` and
   `npm run smoke:smtp -- --preflight`). A real SMTP or lead smoke needs its
   own explicit authority.
6. Record the rollback image identifiers, webhook result, incident trigger,
   owner, time, and remaining risks in `docs/qa/release-verdict.md` or its
   release evidence. Keep the verdict NO-GO until the affected acceptance gates
   have been rechecked.
