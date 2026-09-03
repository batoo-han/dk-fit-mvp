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
