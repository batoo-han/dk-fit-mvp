# Task 4 design QA — Editorial Strength

## Comparison target and rendered evidence

- Source visual truth: `docs/design/assets/editorial-strength-selected.png` — 1122×1402 px at 72 DPI.
- Desktop implementation: `tests/e2e/visual.spec.ts-snapshots/editorial-strength-desktop-desktop-win32.png` — 1440×1890 px at 72 DPI; captured on 2026-09-03 by Playwright at a 1440×900 CSS-px viewport, `deviceScaleFactor: 1`, default zoom, no interaction state and disabled animations.
- Mobile implementation: `tests/e2e/visual.spec.ts-snapshots/editorial-strength-mobile-mobile-win32.png` — 390×2423 px at 72 DPI; captured at 390×844 CSS px with the same state.
- Full-view evidence: the source was resized to 1440 px wide and compared side-by-side with the desktop Playwright capture. This preserves source geometry for composition review; it is not a pixel-diff because the source is a 1122×1402 editorial board rather than a browser capture.
- Focused review: the desktop hero and second-screen columns were reviewed separately in that comparison. A separate mobile capture was reviewed for stacking, crop and overflow. No further focused crop is needed while the form slot is empty.

## Preview diagnosis and test evidence

The prior `webServer.url: "http://127.0.0.1:3210"` readiness check was routed through the environment's `HTTP_PROXY` because neither `NO_PROXY` nor `no_proxy` was set. Playwright's own type contract confirms that `webServer.port` waits for a socket on `127.0.0.1` or `::1`, avoiding that HTTP request path. The config now uses `port: 3210`; `use.baseURL` remains the explicit `http://127.0.0.1:3210` used by browser tests.

With `NO_PROXY=127.0.0.1,localhost,::1` and Node 24, the following command completed with exit 0:

```powershell
npx --yes node@24 node_modules/@playwright/test/cli.js test tests/e2e/landing.spec.ts tests/e2e/visual.spec.ts --update-snapshots
```

Result: 4 passed in 15.4 s. It regenerated the desktop and mobile snapshots above from the actual Next render. The `NODE_TLS_REJECT_UNAUTHORIZED=0` warning is inherited from the local environment; it is not introduced by this project or the Playwright configuration.

## Findings

- [P1] The second-screen lead column is visually empty.
  Location: `TrainerProcessSection` form slot, desktop and mobile captures.
  Evidence: the reference uses the right column for labels, fields, submit CTA and Telegram note. The current capture contains only `Оставьте заявку` and a decorative empty area.
  Impact: the primary conversion surface is absent in the visual comparison.
  Fix: integrate the accessible `LeadForm` owned by Task 5, then recapture the same desktop and mobile states. This cannot be solved truthfully by a decorative placeholder.

- [P1] Editorial hierarchy differs materially from the selected hero reference.
  Location: hero portrait and `FIT` decorative type.
  Evidence: in the reference, the oversized `FIT` sits behind a portrait that dominates the center/right composition. In the rendered capture, the portrait occupies a smaller right-hand region and the `FIT` word overlays the foreground at the bottom.
  Impact: the first screen reads as a different composition even though its approved text, palette and real portrait asset are present.
  Fix: once Task 4 UI changes are back in scope, revise the portrait/type stacking and crop against the reference at 1440×900, then rerun this comparison.

## Expected reference differences

- The source board contains navigation and descriptive approach/process copy that cannot be recreated without adding unapproved public text. The binding spec and content contract permit neither invented descriptions nor the previously removed unsupported labels. These differences are intentionally not fixed here.
- The reference is a 1122×1402 design board while browser evidence is a full-page 1440×1890 capture. Review normalized the source width and judged actual content regions rather than browser chrome or density.

## Required fidelity surfaces

- Fonts and typography: display/body hierarchy is present, but the hero's scale and visual hierarchy remain P1-different from the reference.
- Spacing and layout rhythm: the real 7/5 outer grid renders and the landing overflow checks pass, but the empty form column and hero composition remain P1-different.
- Colors and tokens: the dark, burgundy, gold and warm-text token family matches the approved direction; no actionable color mismatch was found in this review.
- Image quality and asset fidelity: real raster portrait and brand assets render without placeholder substitution; the hero crop/layering remains covered by the P1 composition finding.
- Copy and content: all visible current public copy comes from `landingContent`; source-only descriptive/navigation copy is intentionally excluded by the approved content contract.

## Comparison history

1. 2026-09-03: browser capture had previously been blocked by a proxy-routed `webServer.url` readiness check. The `port` readiness change produced the real desktop/mobile captures above.
2. 2026-09-03: source and desktop capture were compared side-by-side. The empty conversion column and hero portrait/type composition produced the P1 findings above. No UI change was made during this preview/QA-only task, so a passing visual iteration does not exist.

## Implementation checklist

- [ ] Schedule the Task 5 accessible form integration before accepting the second-screen visual baseline.
- [ ] Return the hero composition P1 to the Task 4 visual owner when production UI changes are authorized.
- [ ] Capture and compare revised 1440×900 and 390×844 states without `--update-snapshots` masking a mismatch.

final result: blocked
