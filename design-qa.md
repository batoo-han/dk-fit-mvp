# Task 4 Hero corrective QA — Editorial Strength

## Comparison target and fresh rendered evidence

- Source visual truth: `docs/design/assets/editorial-strength-selected.png` — 1122×1402 px at 72 DPI.
- Desktop baseline: `tests/e2e/visual.spec.ts-snapshots/editorial-strength-desktop-desktop-win32.png` — 1440×2013 px at 72 DPI. It is a full-page capture taken at a 1440×900 CSS-px viewport, default zoom, no interaction state and disabled animations.
- Mobile baseline: `tests/e2e/visual.spec.ts-snapshots/editorial-strength-mobile-mobile-win32.png` — 390×3003 px at 72 DPI. It is a full-page capture taken at a 390×844 CSS-px viewport with the same state.
- Both baselines were regenerated from the production Next renderer after visual inspection. They contain neither the former burgundy `FIT` bleed through the portrait nor a Next development overlay.

## Root-cause correction and regression coverage

The previous computed `z-index` assertion did not describe the rendered result: `mix-blend-mode: screen` on the higher-z portrait composited the burgundy decorative type through the trainer. At the overlapping desktop pixel (820, 400), the failing render had RGB `96/39/54` (red-green delta 57).

`HeroSection.module.css` now uses the normal opaque image compositing path. The new Playwright regression renders the page, reads that overlap pixel from a real screenshot via Sharp, and requires a grayscale delta no larger than 12. It also requires that `nextjs-portal` is absent.

The former `1 Issue` capture was produced by the Next development runtime. `playwright.config.ts` now accepts an external base URL and has no Playwright-owned `webServer`. The Node 24 production E2E harness rebuilds immediately before each run, starts Next directly on a newly reserved loopback port, waits for HTTP readiness and verifies that the port closes during bounded cleanup. It no longer uses `next dev` as the capture server. A direct Node 24 production-render verification confirmed the desktop baseline is pixel-identical at 1440×2013 and has no portal. Both fresh baseline images were separately opened and inspected.

## Current form status

The second screen is no longer an empty form slot. The current rendered baseline contains the Task 5 `LeadForm`: visible name, phone and optional goal fields, consent control, submit button and Telegram note on desktop and mobile. This Hero-only correction does not change the form or claim its interaction/accessibility gates; those remain owned by Task 5/Task 10.

## Findings

No P0/P1/P2 mismatch remains in the Task 4 Hero scope. The portrait is the central/right visual mass, the enlarged `FIT` stays decorative behind it, and the left copy and CTA remain readable. The current form is present, so the prior empty-column P1 is obsolete.

## Verification record

With `J:\AI\node-v24.16.0-win-x64\node.exe`:

```powershell
node .\scripts\run-e2e.mjs tests/e2e/visual.spec.ts --reporter=line
node .\scripts\run-e2e.mjs tests/e2e/visual.spec.ts --reporter=line
node .\scripts\run-e2e.mjs tests/e2e/landing.spec.ts --reporter=line
```

Every command performs a fresh production build and starts an externally owned Next server. The first and second no-update visual runs both exited `0` with `Playwright: 6 passed`; their temporary loopback ports (`58107`, `53997`) were confirmed closed by the harness after cleanup. The no-update landing run exited `0` with `Playwright: 2 passed` and closed its temporary port (`52158`). A combined landing-plus-visual run was also executed twice: both exited `0` with `Playwright: 8 passed` and confirmed ports `55165` and `58484` closed. No snapshot update flag was used for these gates.

The production E2E harness now rejects every non-24 Node major before selecting a port, building Next, starting the owned server or launching Playwright. Under the workspace's default Node `v22.15.0`, `npm run test:e2e` exits `1` with `Node 24 is required for production E2E; found v22.15.0`. A fresh no-update visual gate under `J:\AI\node-v24.16.0-win-x64\node.exe` exited `0` with `Playwright: 6 passed` and confirmed loopback port `65452` closed.

## Scope ruling

- [x] The Hero bleed and dev-overlay findings are corrected and covered by a rendered-output regression.
- [x] Current screenshot dimensions, density and form presence are recorded from the fresh baselines.
- [x] Scoped Task 4 visual QA: obtain two exit-0 no-update visual runs from a fresh production renderer.
- [ ] Independent release QA: Task 10 accessibility and complete flow gates remain required before a global delivery claim.

final result: passed
