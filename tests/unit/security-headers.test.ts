import { afterEach, describe, expect, it, vi } from "vitest";

const e2eInsecureHttpKey = "DK_FIT_E2E_ALLOW_INSECURE_HTTP";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function contentSecurityPolicy() {
  const { default: nextConfig } = await import("../../next.config");
  const configuredHeaders = await nextConfig.headers?.();
  const policy = configuredHeaders?.[0]?.headers.find((header) => header.key === "Content-Security-Policy")?.value;

  expect(policy).toBeDefined();
  return policy!;
}

describe("security headers", () => {
  it("allows React Fast Refresh evaluation only in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(contentSecurityPolicy()).resolves.toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it("never exposes unsafe-eval in the production policy", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(contentSecurityPolicy()).resolves.not.toContain("'unsafe-eval'");
  });

  it("retains upgrade-insecure-requests for normal production builds", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(e2eInsecureHttpKey, undefined);

    await expect(contentSecurityPolicy()).resolves.toContain("upgrade-insecure-requests");
  });

  it("omits only upgrade-insecure-requests for the controlled HTTP E2E fixture", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(e2eInsecureHttpKey, "true");

    const policy = await contentSecurityPolicy();
    expect(policy).not.toContain("upgrade-insecure-requests");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("form-action 'self'");
  });
});
