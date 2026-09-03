# D&K Fit Task 1 execution evidence

## Scope and source

- Task: `docs/superpowers/plans/2026-09-02-dk-fit-implementation.md`, Task 1 (reproducible project and quality gates).
- Binding specification: `docs/superpowers/specs/2026-09-02-dk-fit-landing-design.md`.
- Ignored working ledger: `.superpowers/sdd/2026-09-02-dk-fit-implementation/progress.md`.

## Recorded ruling: Next version

The plan requested `next@19`. On 2026-09-02, `npm install next@19` returned `ETARGET`, and `npm view next@19 version` returned `E404` (`No match found for version 19`); `npm view next version` returned `16.3.4`.

Ruling: pin `next@16.3.4`, the registry-available stable release, with React 19. The binding specification requires a Next.js App Router project but does not specify a Next major version, so this preserves the product contract without inventing a registry source or using an unreviewed tarball. Compatibility risk: behavior can differ from the unavailable planned major; re-evaluate if a required Next 19 release becomes available. The pinned package-lock and Node 24 range keep the verified dependency/runtime combination explicit; no credentials or secrets were used.

## TDD evidence

Before `src/app/page.tsx` existed, the first component test was run:

```powershell
npm test -- tests/component/landing-page.test.tsx
```

It exited `1`. Vitest reported: `Failed to resolve import "../../src/app/page" from "tests/component/landing-page.test.tsx". Does the file exist?` This showed that `Home` and its semantic shell were absent. After the minimal two-section shell was added, the same test passed with one passing test.

## Node 24 clean verification

Runtime used:

```text
J:\AI\node-v24.16.0-win-x64\node.exe
v24.16.0
```

With that directory first in `PATH`, the following command passed:

```powershell
npm ci --ignore-scripts --no-audit
npm run lint
npm run typecheck
npm test -- tests/component/landing-page.test.tsx
npm run build
```

Results: clean install completed; lint and typecheck exited `0`; the targeted Vitest run reported `1 passed`; and Next 16.3.4 production build exited `0`. `.nvmrc` is `24`, while `package.json` and the lockfile require `>=24 <25`.

## Playwright readiness

`playwright.config.ts` defines a direct executable command, a dedicated port, and the matching URL:

```text
node ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3210
http://127.0.0.1:3210
```

The desktop and mobile projects remain configured. Under Node 24, the server logged `Ready in 1032ms`; a Node 24 `fetch('http://127.0.0.1:3210')` returned HTTP `200`.

`npx playwright test --list` loads the configuration but currently reports `Total: 0 tests in 0 files` and exits `1` with `No tests found`. This is expected until the later visual/e2e tasks add their owned specs; no Task 4 or Task 10 test was added here.

An earlier PowerShell HTTP probe was intercepted by the sandbox proxy and returned a proxy-shaped `503` with `Proxy-Connection: close`. The Node 24 direct fetch above is the reachability proof used instead.
