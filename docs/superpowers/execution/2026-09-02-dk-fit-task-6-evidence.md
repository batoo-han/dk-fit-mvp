# Task 6 evidence — Redis idempotency and abuse limits

## TDD evidence

- Red: `npm test -- tests/unit/idempotency.test.ts tests/unit/rate-limit.test.ts`
  exited 1 because `src/lib/leads/idempotency` and `src/lib/leads/rate-limit`
  did not exist; Vitest reported failed import resolution for both suites.
- Green: the same command exited 0 with 12 passing tests. The tests cover first
  claim, processing, success replay, payload conflict, 24-hour TTL, unavailable
  Redis, the atomic shared marker claim, all four rate windows, and replay quota
  safety.

## Verification

- `npm run lint` — exit 0.
- `npm run typecheck` — exit 0.

## Ruling

The idempotency record is written as the initial `SET NX EX` value, rather than
writing a marker and then metadata. This prevents a concurrent retry from
observing an incomplete claim. Redis stores only HMAC-SHA256 fingerprints plus
technical status/counters; no process-memory state exists.
