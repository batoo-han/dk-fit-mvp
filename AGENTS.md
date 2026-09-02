# D&K Fit Agent Rules

## Binding sources

Read in this order before changing code:

1. `docs/superpowers/specs/2026-09-02-dk-fit-landing-design.md`
2. `docs/superpowers/plans/2026-09-02-dk-fit-implementation.md`
3. `docs/handoff/agent-task-map.md`
4. the brief for your assigned role under `.agents/`
5. `docs/design/assets/editorial-strength-selected.png` for visual work

The spec is binding. The plan is the execution argument. If they conflict, stop only when every safe interpretation changes the product contract; otherwise record a ruling in the execution ledger and follow the spec.

## Process

- Use `superpowers:subagent-driven-development` for execution in one session or `superpowers:executing-plans` in a separate session.
- Use `superpowers:test-driven-development` for every code task.
- Use `product-design:image-to-code` for visual Tasks 3–4.
- Use `superpowers:verification-before-completion` before any success claim.
- Use a separate reviewer after every task and a broad reviewer before release.
- Work on `feature/dk-fit-mvp`; never implement directly on `main`.
- One task equals one independently reviewable commit.
- Do not push, deploy, set a real Telegram webhook or send a real production email without explicit authority for that external action.

## Scope guards

- Exactly two top-level sections in `<main>`.
- No CRM, database of leads, admin UI, analytics, payments or bot dialogue beyond `/start` thanks.
- No unverified trainer facts or promised results.
- No secrets or PII in repository, logs, browser storage, screenshots or review reports.
- Do not replace selected Editorial Strength direction with a nearby design.
- Do not use CSS/div/SVG drawings instead of required raster brand/hero assets.
- Do not redirect to Telegram before SMTP acceptance.

## Review contract

Each implementer report must include:

- files changed;
- tests written first and the observed failing reason;
- exact verification commands and exit/result summary;
- commit SHA;
- known limitations or rulings.

Reviewers report Critical, Important and Minor findings. Critical/Important findings block the next dependent task until fixed and re-reviewed.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
