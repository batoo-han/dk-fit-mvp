import { afterEach, describe, expect, it, vi } from "vitest";

const e2eInsecureHttpKey = "DK_FIT_E2E_ALLOW_INSECURE_HTTP";
const originalE2eInsecureHttp = process.env[e2eInsecureHttpKey];

afterEach(() => {
  if (originalE2eInsecureHttp === undefined) {
    delete process.env[e2eInsecureHttpKey];
  } else {
    process.env[e2eInsecureHttpKey] = originalE2eInsecureHttp;
  }
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
  it("retains upgrade-insecure-requests for normal production builds", async () => {
    delete process.env[e2eInsecureHttpKey];

    await expect(contentSecurityPolicy()).resolves.toContain("upgrade-insecure-requests");
  });

  it("omits only upgrade-insecure-requests for the controlled HTTP E2E fixture", async () => {
    process.env[e2eInsecureHttpKey] = "true";

    const policy = await contentSecurityPolicy();
    expect(policy).not.toContain("upgrade-insecure-requests");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("form-action 'self'");
  });
});
