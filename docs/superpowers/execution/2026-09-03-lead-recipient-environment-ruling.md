# Lead recipient configuration ruling

## Ruling

The 2026-09-03 owner-authorized change supersedes the earlier fixed-recipient
wording in the D&K Fit specification and plan. `LEAD_RECIPIENT_EMAIL` is now a
required, validated, server-only configuration key. No recipient address is
stored in production source, public markup, or deployment documentation.

## Consequence if wrong

A missing or malformed value blocks preflight and lead handling instead of
silently routing a lead to an unintended recipient. Deployers must add the
owner-approved address to their protected server environment before release.
