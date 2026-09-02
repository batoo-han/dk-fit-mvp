# Task 4 design QA — Editorial Strength

## Comparison target

- Source visual truth: `docs/design/assets/editorial-strength-selected.png` (1122×1402 px).
- Implementation: `tests/e2e/visual.spec.ts-snapshots/editorial-strength-desktop-desktop-win32.png` (1440×1915 px, captured 2026-09-02).
- Desktop viewport/state: `/`, 1440×900 CSS px, browser default zoom, `deviceScaleFactor: 1`, no interaction state, animations disabled.
- Mobile supporting capture: `tests/e2e/visual.spec.ts-snapshots/editorial-strength-mobile-mobile-win32.png` (390×2514 px) at 390×844 CSS px.
- Density normalization: the source hero (1122×701 px) and the first 1440×900 px implementation viewport share a 1.60 aspect ratio. Both were downscaled to 720×450 px and placed side-by-side in `tests/e2e/evidence/editorial-strength-hero-comparison.png` before review.

## Evidence and interactions

- Full-view comparison: selected source hero versus desktop hero, normalized in `tests/e2e/evidence/editorial-strength-hero-comparison.png`.
- Focused region comparison: hero header, display heading, CTA, portrait crop, and the burgundy `FIT` typography were readable at the normalized hero size; no separate crop was needed.
- Browser checks: the primary CTA resolves to `#lead-form`; exactly two direct `main > section` elements render; desktop and 390 px tests found no horizontal overflow.
- Console: the Playwright run completed without reported page-console errors.

## Findings

No actionable P0/P1/P2 differences remain within Task 4 scope.

- The two-screen hierarchy, dark neutral palette, muted gold dividers, burgundy CTA/decorative type, serif display scale, portrait-led composition, and responsive linear second-screen order match the selected Editorial Strength direction.
- The source mock contains more navigation labels and a complete form. The approved public content source does not provide navigation labels, and Task 4 is explicitly limited to a safe form slot. Task 5 owns the form controls and submission states; neither item is a Task 4 visual defect.

## Required fidelity surfaces

- Fonts and typography: serif display text is limited to headings and decorative process numbers; body/CTA text uses the body sans stack. Hierarchy and wrapping are preserved at desktop and 390 px.
- Spacing and layout rhythm: desktop uses the specified 5/7 hero grid and a three-column second screen; tablet/mobile collapse without fixed viewport height or internal scrolling.
- Colors and tokens: implementation uses the exact specification tokens for background, text, muted text, burgundy, gold, border, focus, error and success colors.
- Image quality and asset fidelity: the approved raster portrait and raster brand mark are used directly; no logo, portrait, decorative mark, or icon is replaced with hand-drawn SVG/CSS art.
- Copy and content: visible public copy comes from `landingContent`; unsupported credentials, results, addresses, testimonials, and numerical claims are absent.

## Follow-up polish

- [P3] Task 5 will fill the intentionally reserved `#lead-form` visual region with the approved labels, accessible controls, and state feedback.
- [P3] Navigation labels remain absent until approved text and anchor behavior are supplied; no labels were invented to imitate the reference.

## Implementation checklist

- [x] Exactly two direct landing sections.
- [x] Header is inside the hero.
- [x] CTA target and process steps are semantic and keyboard reachable.
- [x] Reduced-motion and focus-visible styles are present.
- [x] Desktop and mobile screenshot baselines were captured.

final result: passed
