# Task 4 design QA — Editorial Strength

## Comparison target

- Source visual truth: `docs/design/assets/editorial-strength-selected.png` (1122×1402 px).
- Required current implementation capture: `/` at 1440×900 CSS px, browser default zoom, `deviceScaleFactor: 1`, no interaction state, animations disabled.
- Last desktop snapshot: `tests/e2e/visual.spec.ts-snapshots/editorial-strength-desktop-desktop-win32.png` (1440×1915 px, captured 2026-09-02). It predates the current 7/5 grid and copy-contract fixes and is retained only as historical evidence, not as the accepted baseline for this revision.

## Current capture status

The current implementation could not be browser-rendered in this sandbox. On 2026-09-03, the desktop command

```powershell
npx --yes node@24 node_modules/@playwright/test/cli.js test tests/e2e/visual.spec.ts --project=desktop
```

exited `1` after the configured Next dev `webServer` timed out waiting for `http://127.0.0.1:3210` for 60 seconds. This is the existing local-preview/localhost blocker; no screenshot was produced and no snapshot was updated. The separately reported sandbox localhost 503 condition remains unresolved, so this report does not claim a successful Playwright or visual-comparison run.

## Fixed review findings awaiting visual recapture

- [P1 fixed in code; visual confirmation blocked] The second screen now uses an outer 12-column-equivalent `7fr / 5fr` grid. The left 7-part region nests the approach/process tracks, while the form slot occupies the outer 5-part region.
- [P1 fixed in code; visual confirmation blocked] The unsupported visible labels `Как это работает` and `Заявка` were removed. All remaining visible public copy is supplied by `landingContent`; the approved form heading remains `Оставьте заявку`.

## Required fidelity surfaces

- Fonts and typography: current browser rendering was not available; re-check display/body hierarchy and line wrapping at 1440×900 after the local-preview blocker is fixed.
- Spacing and layout rhythm: current browser rendering was not available; specifically verify the outer 7/5 split, nested left-column rhythm and form-column width.
- Colors and tokens: unchanged by this revision, but not re-captured.
- Image quality and asset fidelity: unchanged by this revision, but not re-captured.
- Copy and content: component test confirms the two removed unsupported labels are absent; browser verification remains blocked.

## Implementation checklist

- [x] Use a genuine outer 7/5 second-screen grid with nested left content.
- [x] Remove unsupported visible process/form labels rather than inventing replacements.
- [x] Add a regression test for the unapproved labels.
- [ ] Recreate the 1440×900 desktop snapshot after the local-preview blocker is resolved.
- [ ] Compare the current desktop capture and source side-by-side; then update the snapshot and this report with the evidence.

final result: blocked
