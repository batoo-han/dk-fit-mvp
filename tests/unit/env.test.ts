import { describe, expect, it } from "vitest";

import { getServerEnv } from "../../src/lib/config/env";

const validEnvironment = {
  NODE_ENV: "production",
  PUBLIC_SITE_URL: "https://dk-fit.test",
  SITE_AUTHOR_FULL_NAME: "Тестовый Автор",
  SMTP_HOST: "smtp.test",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_USER: "fixture-user",
  SMTP_PASSWORD: "fixture-password",
  SMTP_FROM: "D&K Fit <no-reply@dk-fit.test>",
  LEAD_RECIPIENT_EMAIL: "lead-recipient@example.test",
  SMTP_CONNECTION_TIMEOUT_MS: "10000",
  SMTP_SOCKET_TIMEOUT_MS: "15000",
  TELEGRAM_BOT_TOKEN: "fixture-bot-token",
  TELEGRAM_BOT_USERNAME: "dk_fit_test_bot",
  TELEGRAM_WEBHOOK_SECRET: "w".repeat(32),
  REDIS_URL: "redis://127.0.0.1:6379",
  PII_HASH_SECRET: "p".repeat(32),
  LEGAL_OPERATOR_NAME: "Тестовый оператор",
  LEGAL_OPERATOR_CONTACT: "privacy@dk-fit.test",
};

function environment(overrides: Record<string, string | undefined> = {}) {
  return { ...validEnvironment, ...overrides };
}

describe("getServerEnv", () => {
  it("returns typed server-only values from a complete environment", () => {
    const env = getServerEnv(environment());

    expect(env.publicSiteUrl.href).toBe("https://dk-fit.test/");
    expect(env.smtp).toMatchObject({ port: 465, secure: true });
    expect(env.leadRecipientEmail).toBe("lead-recipient@example.test");
    expect(env.telegram.username).toBe("dk_fit_test_bot");
  });

  it("fails with the missing required key name", () => {
    expect(() => getServerEnv(environment({ SMTP_HOST: undefined }))).toThrow("SMTP_HOST");
  });

  it.each([
    undefined,
    "lead recipient@example.test",
    "lead-recipient@example.test, other@example.test",
    "Lead recipient <lead-recipient@example.test>",
    "lead-recipient@example.test\r\nBcc: attacker@example.test",
  ])("rejects an unsafe LEAD_RECIPIENT_EMAIL", (LEAD_RECIPIENT_EMAIL) => {
    expect(() => getServerEnv(environment({ LEAD_RECIPIENT_EMAIL }))).toThrow("LEAD_RECIPIENT_EMAIL");
  });

  it("rejects a non-HTTPS public URL in production", () => {
    expect(() => getServerEnv(environment({ PUBLIC_SITE_URL: "http://dk-fit.test" }))).toThrow(
      "PUBLIC_SITE_URL",
    );
  });

  it("rejects a bot username that includes @", () => {
    expect(() => getServerEnv(environment({ TELEGRAM_BOT_USERNAME: "@dk_fit_test_bot" }))).toThrow(
      "TELEGRAM_BOT_USERNAME",
    );
  });

  it.each(["0", "65536", "not-a-port"])("rejects SMTP port %s", (SMTP_PORT) => {
    expect(() => getServerEnv(environment({ SMTP_PORT }))).toThrow("SMTP_PORT");
  });

  it.each([
    ["PII_HASH_SECRET", "p".repeat(31)],
    ["TELEGRAM_WEBHOOK_SECRET", "w".repeat(31)],
    ["PII_HASH_SECRET", " ".repeat(32)],
    ["TELEGRAM_WEBHOOK_SECRET", "w".repeat(31) + " "],
  ])("rejects a too-short %s", (key, value) => {
    expect(() => getServerEnv(environment({ [key]: value }))).toThrow(key);
  });

  it("permits STARTTLS for SMTP in production", () => {
    expect(getServerEnv(environment({ SMTP_SECURE: "false" })).smtp).toMatchObject({ secure: false });
  });

  it.each(["LEGAL_OPERATOR_NAME", "LEGAL_OPERATOR_CONTACT"])("requires %s", (key) => {
    expect(() => getServerEnv(environment({ [key]: "" }))).toThrow(key);
  });
});
