# D&K Fit Task 2 execution evidence

## Scope

Task 2 from `docs/superpowers/plans/2026-09-02-dk-fit-implementation.md`: server environment schema, shared lead contract, `.env.example`, and safe environment preflight. The binding lead constraints are in section 5 and the required environment keys are in section 10 of `docs/superpowers/specs/2026-09-02-dk-fit-landing-design.md`.

## TDD RED evidence

Before production modules existed, both test commands failed as expected under Node 24:

```powershell
npm test -- tests/unit/env.test.ts
npm test -- tests/unit/lead-contract.test.ts
```

The first exited `1` with `Failed to resolve import "../../src/lib/config/env"`; the second exited `1` with `Failed to resolve import "../../src/lib/contracts/lead"`. Each failure showed the intended production module was absent, rather than a test assertion passing against pre-existing behavior.

## Rulings

- `PII_HASH_SECRET` and `TELEGRAM_WEBHOOK_SECRET` require at least 32 characters. The specification requires both to reject short values but does not name a length; 32 is the minimum selected for the HMAC and webhook-secret boundary. Risk if the threshold changes: deployments with 32–N character secrets may need rotation or a config change.
- `getServerEnv()` reads `process.env` at each call and accepts an optional explicit environment record only for deterministic unit tests. Secrets are returned only in the server-side `ServerEnv` object and no `NEXT_PUBLIC_` key is read.
- `scripts/check-env.mjs` imports the schema through Node 24 native TypeScript stripping. The original TypeScript parameter property was incompatible with strip-only mode; it was replaced with an ordinary readonly assignment. The script prints only invalid key names, never values.

## GREEN and preflight verification

Runtime: `J:\AI\node-v24.16.0-win-x64\node.exe` (`v24.16.0`), selected by placing its directory first in `PATH`.

```powershell
npm test -- tests/unit/env.test.ts tests/unit/lead-contract.test.ts
npm run typecheck
```

Both commands exited `0`; Vitest reported 2 files and 30 passing tests.

With a complete fixture-only environment, `npm run check:env` exited `0` and emitted no values. With no required environment values, it exited `1` and printed only invalid key names. No external credentials, SMTP request, Redis connection, or Telegram request was made.

`npm run verify` is intentionally not a Task 2 gate: later Tasks 3 and 4 own `scripts/verify-assets.mjs` and e2e specifications, so it is not yet expected to complete.

## Review-fix cycle

The review requested four regressions. Before the fix, the expanded Task 2 unit suite exited `1`: 32 whitespace-only characters and a 31-character-plus-space secret were accepted; production accepted `SMTP_SECURE=false`; and leading/trailing CR/LF were removed by `trim()` before the lead schema inspected them. The suite reported 7 failing assertions and 31 passing assertions.

The schema now requires both server secrets to contain at least 32 characters and no whitespace, requires SMTP TLS in production, and validates raw name/phone/goal values before normalizing output with `trim()`. Ordinary goal LF and CRLF remain allowed and normalized only at the surrounding edges.

`server-only@0.0.1` is a direct dependency and `src/lib/config/env.ts` imports its marker. Vitest aliases the marker to its package-provided empty server export; the production `npm run build` does not use that alias and exited `0`. The standalone preflight runs Node with `--conditions=react-server`, so it uses the same package-provided server condition rather than the marker's client guard. A complete fixture-only preflight exited `0` with no values printed; an empty environment exits `1` and prints only invalid key names.
