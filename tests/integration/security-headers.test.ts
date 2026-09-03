import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import nextConfig from "../../next.config";
import RootLayout, { generateMetadata } from "../../src/app/layout";
import PrivacyPage from "../../src/app/privacy/page";

const serverEnvironment = {
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

beforeEach(() => {
  vi.stubEnv("NODE_ENV", serverEnvironment.NODE_ENV);
  for (const [key, value] of Object.entries(serverEnvironment)) {
    vi.stubEnv(key, value);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
});

describe("privacy and platform security", () => {
  it("renders configured legal operator details without invented entity data", () => {
    render(createElement(PrivacyPage));

    expect(screen.getByRole("heading", { name: "Политика обработки персональных данных" })).toBeTruthy();
    expect(screen.getByText(/Тестовый оператор/u)).toBeTruthy();
    expect(screen.getByText(/privacy@dk-fit\.test/u)).toBeTruthy();
    const privacyPolicy = screen.getByTestId("privacy-policy");
    expect(privacyPolicy.textContent).toContain("Имя, номер телефона, необязательная цель обращения и согласие");
    expect(privacyPolicy.textContent).toContain("связаться с вами по поводу персональных тренировок");
    expect(privacyPolicy.getAttribute("data-legal-approval")).toBe(
      "owner-legal-review-required",
    );
  });

  it("publishes exact metadata and canonical URL from server configuration", async () => {
    const metadata = await generateMetadata();
    const document = RootLayout({ children: createElement("p", undefined, "Содержимое") });

    expect(metadata.title).toBe("D&K Fit — персональные тренировки");
    expect(metadata.description).toBe("Персональные тренировки и консультация по записи.");
    expect(metadata.alternates?.canonical).toBe("https://dk-fit.test/");
    expect(metadata.icons).toEqual({ icon: "/brand/favicon-32.png", apple: "/brand/apple-touch-icon.png" });
    expect(document.props.lang).toBe("ru");
  });

  it("applies a restrictive security header policy to every production route", async () => {
    const headerRules = await nextConfig.headers?.();
    const headers = Object.fromEntries(headerRules?.at(0)?.headers.map(({ key, value }) => [key, value]) ?? []);

    expect(headerRules?.at(0)?.source).toBe("/:path*");
    expect(headers).toMatchObject({
      "Content-Security-Policy": expect.stringContaining("default-src 'self'"),
      "Strict-Transport-Security": expect.stringContaining("max-age="),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
    });
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  });
});
