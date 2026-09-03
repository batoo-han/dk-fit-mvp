# Task 9: platform and privacy evidence

## Automated checks

- `npm test -- tests/integration/security-headers.test.ts` — 3 passed.
- `npm run lint` — exit 0.
- `npm run typecheck` — exit 0.
- `npm run build` — exit 0; `/`, `/privacy` and API routes are dynamic server-rendered routes.
- `docker compose config --no-interpolate` — exit 0. The no-interpolate mode keeps external runtime configuration from being rendered in evidence output.

## Runtime smoke check

A locally built standalone server was started with complete non-production fixture configuration. `GET /privacy` returned HTTP 200 and included CSP, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Frame-Options: DENY`.

The first localhost probe returned a proxy-generated 503. Direct probing with proxy bypass (`--noproxy 127.0.0.1`) returned the application response, so this is a local proxy setting rather than an application failure.

## Release limits

- The local host supplies Node 22.15.0 although `.nvmrc` requires Node 24; the build is therefore not a Node 24 verification.
- Docker CLI is installed but its daemon is unavailable, so no Docker image build or container healthcheck was run.
- No production deployment, SMTP message, Telegram webhook update, or production-env preflight was performed.
- Legal operator details render from server environment and still require owner/legal confirmation before public release.
