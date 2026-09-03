# Task 10 QA evidence

Evidence is deliberately sanitized:

- browser lead API responses are mocked;
- the only Telegram link is the fixture URL `https://t.me/test_bot?start=registered`;
- no SMTP, Redis or Telegram provider is contacted;
- screenshots and test artifacts contain no submitted PII.

The authoritative status and exact reproducible commands are in
[`../acceptance-matrix.md`](../acceptance-matrix.md). The latest independent
rerun is [`2026-09-03-task-10-rerun.md`](2026-09-03-task-10-rerun.md): the
former E2E P0/P1 findings have passed, but a fresh aggregate lint P1 leaves the
current local/staging verdict at **NO-GO**.
