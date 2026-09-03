# D&K Fit — independent QA acceptance matrix

**Task:** 10 rerun
**Date:** 2026-09-03
**Reviewed commit:** `2ee61b9`
**Verdict:** **NO-GO for local/staging.**

All browser runs used the controlled Node 24 fixture harness. It quarantines
only root `.env*` filenames during its owned build, never reads or logs their
contents, restores them in `finally`, and starts an isolated standalone runtime
on an owned loopback port. Browser API routes were intercepted; no SMTP, Redis,
Telegram, webhook, deployment, or user environment value was contacted.

| Gate | Fresh evidence | Result | Owner / action |
| --- | --- | --- | --- |
| Hydration and iPhone submission | The mobile profile waits for `data-client-ready`; all seven mobile lead cases passed. The success case asserts exactly one mocked `POST /api/leads` and zero native local GET navigations. | PASS | — |
| Valid lead / exact redirect | Desktop and mobile success cases passed. The only redirect target was the fixture URL `https://t.me/test_bot?start=registered`. | PASS | — |
| 422, 429, 503 and offline | Each browser error flow stayed on the form and retained entered data. | PASS | — |
| Double click, Back and keyboard flow | One pending double-click generated one mocked request; Back did not resubmit; desktop keyboard-only submit passed. | PASS | Mobile keyboard test is deliberately skipped because the desktop tab-order gate owns that check. |
| Two sections, visible CTA/form, focus and overflow | CSS-pixel matrix at 320x568, 390x844, 768x1024 and 1440x900 passed; focused name field was not clipped and `scrollWidth <= innerWidth`. | PASS | — |
| axe critical/serious | Public landing axe gate passed in both desktop and iPhone projects. | PASS | — |
| DPR 1 visual baseline | All three CSS-pixel visual tests passed, including 1440x900 and the accepted 390x844 baseline and the opaque hero/no-dev-overlay checks. | PASS | — |
| Full Vitest roots | `tests/unit`, `tests/component` and `tests/integration` collected cleanly: 17 files, 134 tests passed. Playwright specs are no longer collected by Vitest. | PASS | — |
| Full controlled browser E2E | Desktop, iPhone and CSS-pixel visual projects: 21 passed, 2 intentional skips. The owned loopback port was confirmed closed. | PASS | — |
| Full lint gate | `eslint .` exits 1 because `scripts/e2e-harness.d.mts:7` is parsed as JavaScript and reports `Missing initializer in const declaration`. `npm run verify` therefore cannot pass. | **P1 BLOCKER** | Foundation/tooling owner: configure ESLint TypeScript parsing for `.mts` declaration files or exclude that declaration file, then independently rerun lint and QA. |
| Typecheck and assets | `tsc --noEmit` and `scripts/verify-assets.mjs` both exited 0; asset verifier reported four reviewed assets. | PASS | — |
| 200% zoom, reduced motion, screen-reader path | Not independently executed in this controlled rerun. Existing automated keyboard, focus-visible and axe checks do not substitute for this manual release checklist. | OPEN | Complete in staging/release QA before any production verdict. |
| Docker image build | Not run: the local Docker daemon is unavailable (`//./pipe/docker_engine` missing). `docker version` confirms the client but cannot connect to a server. | BLOCKED | Platform / QA on a host with Docker daemon. |
| Staging SMTP / Telegram webhook | Not run: external effects and an HTTPS staging endpoint are outside this Task 10 fixture-only QA scope. | NOT AUTHORIZED | Task 11 with owner inputs and explicit authority. |

## Reproduction

Run from `dk-fit` with Node `v24.16.0`; do not load, print, or source a user
environment file:

```powershell
J:\AI\node-v24.16.0-win-x64\node.exe .\node_modules\vitest\vitest.mjs run
J:\AI\node-v24.16.0-win-x64\node.exe .\scripts\run-e2e.mjs --reporter=line
J:\AI\node-v24.16.0-win-x64\node.exe .\node_modules\eslint\bin\eslint.js .
J:\AI\node-v24.16.0-win-x64\node.exe .\node_modules\typescript\bin\tsc --noEmit
J:\AI\node-v24.16.0-win-x64\node.exe .\scripts\verify-assets.mjs
```

`npm run verify` was intentionally not invoked: its raw `npm run build` stage
does not use the controlled quarantine harness and could load a root `.env`.
The isolated E2E harness did execute its own fixture-only production build;
that build and all browser checks passed. The independent direct lint run still
proves the aggregate script currently fails, without accessing a user env file.

## Blocking finding

1. **P1 — aggregate lint is failing.** `scripts/e2e-harness.d.mts` is a
   TypeScript declaration file but the current ESLint configuration parses it as
   JavaScript. This is a tooling defect, not evidence of a landing interaction
   regression, but it blocks the required all-green local verification gate.

The former mobile native-submit, stale 390px visual, and Vitest/Playwright
collection blockers were independently retested and are no longer present on
the reviewed commit. See
[`e2e-hydration-readiness.md`](evidence/2026-09-03-e2e-hydration-readiness.md)
for the earlier root-cause and remediation evidence, and
[`2026-09-03-task-10-rerun.md`](evidence/2026-09-03-task-10-rerun.md) for this
fresh run.
