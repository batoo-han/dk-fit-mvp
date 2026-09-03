# Task 4 Hero corrective QA — Editorial Strength

## Comparison target and fresh rendered evidence

- Source visual truth: `docs/design/assets/editorial-strength-selected.png` — 1122×1402 px at 72 DPI.
- Desktop baseline: `tests/e2e/visual.spec.ts-snapshots/editorial-strength-desktop-desktop-win32.png` — 1440×2013 px at 72 DPI. It is a full-page capture taken at a 1440×900 CSS-px viewport, default zoom, no interaction state and disabled animations.
- Mobile baseline: `tests/e2e/visual.spec.ts-snapshots/editorial-strength-mobile-mobile-win32.png` — 390×3003 px at 72 DPI. It is a full-page capture taken at a 390×844 CSS-px viewport with the same state.
- Both baselines were regenerated from the production Next renderer after visual inspection. They contain neither the former burgundy `FIT` bleed through the portrait nor a Next development overlay.

## Root-cause correction and regression coverage

The previous computed `z-index` assertion did not describe the rendered result: `mix-blend-mode: screen` on the higher-z portrait composited the burgundy decorative type through the trainer. At the overlapping desktop pixel (820, 400), the failing render had RGB `96/39/54` (red-green delta 57).

`HeroSection.module.css` now uses the normal opaque image compositing path. The new Playwright regression renders the page, reads that overlap pixel from a real screenshot via Sharp, and requires a grayscale delta no larger than 12. It also requires that `nextjs-portal` is absent.

The former `1 Issue` capture was produced by the Next development runtime. `playwright.config.ts` now builds first and starts the production Next server on the isolated port 3212 for visual runs; it no longer uses `next dev` as the capture server. A direct Node 24 production-render verification confirmed the desktop baseline is pixel-identical at 1440×2013 and has no portal. Both fresh baseline images were separately opened and inspected.

## Current form status

The second screen is no longer an empty form slot. The current rendered baseline contains the Task 5 `LeadForm`: visible name, phone and optional goal fields, consent control, submit button and Telegram note on desktop and mobile. This Hero-only correction does not change the form or claim its interaction/accessibility gates; those remain owned by Task 5/Task 10.

## Findings

No P0/P1/P2 mismatch remains in the Task 4 Hero scope. The portrait is the central/right visual mass, the enlarged `FIT` stays decorative behind it, and the left copy and CTA remain readable. The current form is present, so the prior empty-column P1 is obsolete.

## Verification record

With Node 24.16.0:

```powershell
node .\node_modules\next\dist\bin\next build
node .\node_modules\@playwright\test\cli.js test tests/e2e/visual.spec.ts --reporter=line --timeout=30000 --update-snapshots
```

The production build exited 0. The snapshot run executed all six desktop/mobile test bodies and rewrote both reviewed baselines; in this Windows runner its Playwright process did not exit before the 120-second command timeout during server teardown. It must be re-run to an exit-0 no-update result by the release/QA owner before a global delivery claim. This is a verification-runtime limitation, not a visual P1, so this corrective record remains blocked rather than claiming a full visual gate pass.

## Scope ruling

- [x] The Hero bleed and dev-overlay findings are corrected and covered by a rendered-output regression.
- [x] Current screenshot dimensions, density and form presence are recorded from the fresh baselines.
- [ ] Independent release QA: obtain an exit-0 no-update Playwright run, plus the Task 10 accessibility and complete flow gates.

final result: blocked
