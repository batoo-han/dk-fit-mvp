# Task 10 QA evidence

Evidence is deliberately sanitized:

- browser lead API responses are mocked;
- the only Telegram link is the fixture URL `https://t.me/test_bot?start=registered`;
- no SMTP, Redis or Telegram provider is contacted;
- screenshots and test artifacts contain no submitted PII.

The authoritative status and exact reproducible commands are in
[`../acceptance-matrix.md`](../acceptance-matrix.md). The latest evidence is
[`2026-09-03-final-review-fix-wave.md`](2026-09-03-final-review-fix-wave.md):
the full lint, typecheck, Vitest, controlled E2E, asset, and daemon-free Compose
model gates pass. Production remains **NO-GO** only for the separately listed
owner-input, Docker runtime, manual, and authorized external gates.

[`2026-09-03-task-10-rerun.md`](2026-09-03-task-10-rerun.md) is retained as a
historical snapshot of commit `2ee61b9`; its lint blocker was resolved later and
must not be treated as the current verdict.
