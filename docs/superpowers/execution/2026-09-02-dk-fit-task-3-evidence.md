# Task 3 — Visual assets and public content evidence

## Reference inspected

- Selected direction: `docs/design/assets/editorial-strength-selected.png`.
- Reference SHA-256 is recorded in `docs/handoff/agent-task-map.md`.
- Target treatment: high-contrast monochrome editorial athlete portrait; dark neutral backdrop; face and torso remain within the mobile-safe centre crop; muted-gold geometric diamond mark.

## Asset inventory

| File | Verified dimensions | Purpose |
| --- | --- | --- |
| `public/images/hero-trainer.avif` | 1200x1400 | Optimized hero portrait |
| `public/images/hero-trainer.webp` | 1200x1400 | Compatible hero portrait |
| `public/brand/favicon-32.png` | 32x32 | Favicon source |
| `public/brand/apple-touch-icon.png` | 180x180 | Apple touch icon source |

`npm run verify:assets` failed before the assets were created with the expected missing `public/images/hero-trainer.avif` error, then passed after export with all four reviewed files.

## Provenance and rights limitation

Both final source images were created with the built-in ImageGen tool on 2026-09-02. The hero prompt requested an original fictional adult athlete, explicitly excluding any real-person likeness, text, logo, watermark, brand insignia, or props. The mark prompt requested an original abstract diamond geometry, with no text, initials, or existing-brand logo. The first mark attempt was rejected because it did not have the requested removable flat background; the accepted source used a flat chroma-key green background and was converted locally to alpha PNG before raster exports.

This evidence records generation provenance, not a legal clearance. Public production release remains blocked until the owner accepts the final imagery and confirms that the generated assets and selected fonts are appropriate for the intended use, as required by the binding specification.
