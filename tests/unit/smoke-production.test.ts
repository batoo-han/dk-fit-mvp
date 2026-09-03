import { describe, expect, it, vi } from "vitest";

import {
  parseSmokeArguments,
  runPreflight,
  runSmtpSmoke,
} from "../../scripts/smoke-production.mjs";

const completeEnvironment = {
  NODE_ENV: "production",
  PUBLIC_SITE_URL: "https://dk-fit.test",
  SITE_AUTHOR_FULL_NAME: "Тестовый Автор",
  SMTP_HOST: "smtp.dk-fit.test",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_USER: "fixture-user",
  SMTP_PASSWORD: "fixture-password",
  SMTP_FROM: "D&K Fit <no-reply@dk-fit.test>",
  LEAD_RECIPIENT_EMAIL: "lead-recipient@example.test",
  SMTP_CONNECTION_TIMEOUT_MS: "10000",
  SMTP_SOCKET_TIMEOUT_MS: "15000",
  TELEGRAM_BOT_API_BASE_URL: "https://telegram-proxy.test/tg",
  TELEGRAM_BOT_TOKEN: "fixture-bot-token",
  TELEGRAM_BOT_USERNAME: "dk_fit_test_bot",
  TELEGRAM_WEBHOOK_SECRET: "w".repeat(32),
  REDIS_URL: "redis://127.0.0.1:6379",
  PII_HASH_SECRET: "p".repeat(32),
  LEGAL_OPERATOR_NAME: "Тестовый оператор",
  LEGAL_OPERATOR_CONTACT: "privacy@dk-fit.test",
};

describe("production SMTP smoke", () => {
  it("refuses to send until the caller supplies both a recipient and explicit confirmation", async () => {
    expect(() => parseSmokeArguments([])).toThrow("--to");
    expect(() => parseSmokeArguments(["--to", "release-recipient@example.test"])).toThrow("--confirm-send");

    const createTransport = vi.fn();
    await expect(
      runSmtpSmoke({
        arguments: ["--to", "release-recipient@example.test"],
        environment: completeEnvironment,
        createTransport,
      }),
    ).rejects.toThrow("--confirm-send");
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("reports invalid configuration by key names without returning environment values", () => {
    const result = runPreflight({ ...completeEnvironment, PUBLIC_SITE_URL: "http://invalid.test" });

    expect(result).toEqual({ ok: false, keys: ["PUBLIC_SITE_URL"] });
    expect(JSON.stringify(result)).not.toContain("invalid.test");
    expect(JSON.stringify(result)).not.toContain(completeEnvironment.SMTP_PASSWORD);
  });

  it.each([
    ["missing NODE_ENV", { NODE_ENV: undefined }, ["NODE_ENV"]],
    ["a development NODE_ENV", { NODE_ENV: "development" }, ["NODE_ENV"]],
    ["an HTTP public URL", { PUBLIC_SITE_URL: "http://dk-fit.test" }, ["PUBLIC_SITE_URL"]],
  ])("rejects %s during release preflight before SMTP side effects", async (_scenario, overrides, keys) => {
    const verify = vi.fn().mockResolvedValue(undefined);
    const sendMail = vi.fn().mockResolvedValue({ accepted: ["release-recipient@example.test"] });
    const createTransport = vi.fn().mockReturnValue({ verify, sendMail });
    const environment = { ...completeEnvironment, ...overrides };

    expect(runPreflight(environment)).toEqual({ ok: false, keys });
    await expect(
      runSmtpSmoke({
        arguments: ["--to", "release-recipient@example.test", "--confirm-send"],
        environment,
        createTransport,
      }),
    ).rejects.toThrow("CONFIGURATION_ERROR");
    expect(createTransport).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("verifies SMTP and treats delivery as successful only after the explicit recipient is accepted", async () => {
    const verify = vi.fn().mockResolvedValue(undefined);
    const sendMail = vi.fn().mockResolvedValue({ accepted: ["release-recipient@example.test"] });
    const createTransport = vi.fn().mockReturnValue({ verify, sendMail });

    await expect(
      runSmtpSmoke({
        arguments: ["--to", "release-recipient@example.test", "--confirm-send"],
        environment: completeEnvironment,
        createTransport,
      }),
    ).resolves.toEqual({ ok: true });

    expect(verify).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledWith({
      from: "D&K Fit <no-reply@dk-fit.test>",
      to: "release-recipient@example.test",
      subject: "D&K Fit — SMTP smoke",
      text: "D&K Fit SMTP smoke\n\nThis is an explicit release-readiness test message.\nNo lead was submitted.\n",
    });
  });

  it("uses authenticated STARTTLS when implicit TLS is disabled", async () => {
    const verify = vi.fn().mockResolvedValue(undefined);
    const sendMail = vi.fn().mockResolvedValue({ accepted: ["release-recipient@example.test"] });
    const createTransport = vi.fn().mockReturnValue({ verify, sendMail });

    await expect(
      runSmtpSmoke({
        arguments: ["--to", "release-recipient@example.test", "--confirm-send"],
        environment: { ...completeEnvironment, SMTP_SECURE: "false" },
        createTransport,
      }),
    ).resolves.toEqual({ ok: true });

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.dk-fit.test",
      port: 465,
      secure: false,
      requireTLS: true,
      tls: { rejectUnauthorized: true },
      auth: { user: "fixture-user", pass: "fixture-password" },
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
    });
  });

  it("does not report success when SMTP omits the explicit recipient from accepted", async () => {
    const createTransport = vi.fn().mockReturnValue({
      verify: vi.fn().mockResolvedValue(undefined),
      sendMail: vi.fn().mockResolvedValue({ accepted: ["other-recipient@example.test"] }),
    });

    await expect(
      runSmtpSmoke({
        arguments: ["--to", "release-recipient@example.test", "--confirm-send"],
        environment: completeEnvironment,
        createTransport,
      }),
    ).rejects.toThrow("SMTP_SMOKE_NOT_ACCEPTED");
  });
});
