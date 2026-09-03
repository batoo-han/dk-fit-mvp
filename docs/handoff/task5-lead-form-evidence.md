# Task 5 — lead form evidence

## Test-first record

Before production files were created, the new focused suite was run:

```text
FAIL tests/component/lead-form.test.tsx
Failed to resolve import ../../src/features/lead-form/LeadForm

FAIL tests/unit/lead-form-state.test.ts
Failed to resolve import ../../src/features/lead-form/state
```

The expected RED state established that the tests covered the absent form and state reducer rather than an existing implementation.

## Fresh verification

Run on Node 24 after implementation:

```text
npm run typecheck                                      exit 0
npm test -- tests/component/landing-page.test.tsx \
  tests/unit/lead-form-state.test.ts \
  tests/component/lead-form.test.tsx                   18 passed, exit 0
npm run lint                                           exit 0
npm run build                                          exit 0
```

The focused suite covers the client states, first-invalid focus, labels and autocomplete, consent/privacy link, one pending submit, UUID reuse after a network failure, 201-only redirect, 422/429/503 retention, and no submit on a Back-style remount. The request-adapter test asserts a timeout abort and the accepted API headers without recording request data.

## Browser-check boundary

The desktop instance of `tests/e2e/landing.spec.ts` passed. A concurrent mobile run rendered no main sections, and its serial rerun did not complete before the browser-check timeout; this is recorded as a shared preview-runtime limitation, not a Task 5 visual-QA pass. Task 10 remains responsible for the full browser and accessibility gate.

## Review-fix cycle

The Task 5 reviewer identified client-side contract gaps. New focused component
tests were written before the implementation change and failed against the old
form for the intended reasons: form time began only at submit, retries replaced
that time, the honeypot was always serialized as an empty string, a generic
`422` left the live status empty, an edited retry reused the old idempotency key,
and the consent controls did not declare 44px targets/focus styling.

The minimal repair keeps the mount-time `startedAt` through an unchanged network
retry, transports the actual honeypot value for server-side rejection, resets the
idempotency key on an edit, announces field-less `422` responses, and makes both
the consent checkbox and privacy link 44px touch targets with visible focus.

Fresh scoped verification, confirmed by the reviewer under the project's Node 24
executable, `J:\AI\node-v24.16.0-win-x64\node.exe` (`v24.16.0`):

```text
npm test -- tests/component/lead-form.test.tsx tests/unit/lead-form-state.test.ts
20 passed, exit 0
npm run typecheck
exit 0
npm run lint
exit 0
git diff --check
exit 0
```

The scoped Task 5 suite passed with 20 tests; typecheck, lint, and
`git diff --check` also exited `0`. Task 7's separate lead-route verification
recorded 16 passing route/email tests before its later review-fix additions; that
route evidence remains outside Task 5 and is not evidence that Task 5 changed
server-route behavior.

Commit `4a7ec93` contains only the Task 5 form, reducer, adapter, focused tests,
and this evidence document; it contains no visual or preview files. The hero,
Playwright configuration, visual test, design-QA record, and screenshot baselines
belong to the immediately preceding, separate commit `2429ba9`
(`fix: align Editorial Strength hero composition`). Therefore this review-fix
does not claim a visual-QA pass or attribute predecessor visual work to Task 5.
