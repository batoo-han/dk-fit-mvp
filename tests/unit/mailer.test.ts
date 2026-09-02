import { describe, expect, it, vi } from "vitest";

import { createLeadMailer, EmailUnavailableError } from "../../src/lib/leads/mailer";

const smtp = {
  host: "smtp.dk-fit.test",
  port: 465,
  secure: true,
  user: "test-user",
  password: "test-password",
  from: "D&K Fit <no-reply@dk-fit.test>",
  connectionTimeoutMs: 1_000,
  socketTimeoutMs: 1_000,
};

const message = {
  to: "superhumansmm@yandex.ru" as const,
  subject: "D&K Fit — новая заявка" as const,
  text: "Тестовое письмо",
};

describe("lead mailer", () => {
  it("accepts SMTP success only when the fixed recipient is in accepted", async () => {
    const sendMail = vi.fn().mockResolvedValue({ accepted: ["superhumansmm@yandex.ru"] });
    const createTransport = vi.fn().mockReturnValue({ sendMail });
    const mailer = createLeadMailer({ smtp }, createTransport);

    await expect(mailer.send(message)).resolves.toBeUndefined();
    expect(createTransport).toHaveBeenCalledWith({
      host: smtp.host,
      port: smtp.port,
      secure: true,
      auth: { user: smtp.user, pass: smtp.password },
      connectionTimeout: smtp.connectionTimeoutMs,
      socketTimeout: smtp.socketTimeoutMs,
    });
    expect(sendMail).toHaveBeenCalledWith({ from: smtp.from, ...message });
  });

  it("does not claim success when SMTP omits the fixed recipient", async () => {
    const mailer = createLeadMailer(
      { smtp },
      vi.fn().mockReturnValue({ sendMail: vi.fn().mockResolvedValue({ accepted: ["other@example.test"] }) }),
    );

    await expect(mailer.send(message)).rejects.toBeInstanceOf(EmailUnavailableError);
  });
});
