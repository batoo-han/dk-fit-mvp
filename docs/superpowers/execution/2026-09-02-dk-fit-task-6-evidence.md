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

## Review fix evidence

- Root cause: completion previously used a non-atomic `GET` followed by `SET`,
  without proving that it still owned the original processing claim. A TTL expiry
  and re-claim could therefore let a delayed worker complete the replacement.
- Red: the expanded idempotency suite exited 1: completion returned `undefined`
  instead of the required stale-token `false`, and `releaseLead` was absent.
- Green: the suite exits 0 with 15 tests. A generated opaque token is stored in
  the technical claim record. Lua compare-and-set transitions require that token
  and `processing` status; completion uses `KEEPTTL`, while release atomically
  deletes only the matching processing record for retryable failures such as 429.
- The rate-limit Redis fake now preserves the original expiry after later
  `INCR` calls, matching the production Lua script where `EXPIRE` runs only for
  counter value 1 rather than turning a fixed window into a sliding one.

## Ruling

The idempotency record is written as the initial `SET NX EX` value, rather than
writing a marker and then metadata. This prevents a concurrent retry from
observing an incomplete claim. Redis stores only HMAC-SHA256 fingerprints,
opaque technical claim tokens, statuses and counters; no process-memory state
exists.
