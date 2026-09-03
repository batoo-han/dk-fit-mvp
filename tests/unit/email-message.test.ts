import { describe, expect, it } from "vitest";

import { formatLeadEmail } from "../../src/lib/leads/email-message";

const LEAD_RECIPIENT_EMAIL = "lead-recipient@example.test";

describe("lead email message", () => {
  it("formats the approved UTF-8 notification as an exact plain-text message", () => {
    const message = formatLeadEmail(
      {
        publicSiteUrl: new URL("https://dk-fit.test"),
        siteAuthorFullName: "Тестовый Автор",
        leadRecipientEmail: LEAD_RECIPIENT_EMAIL,
      },
      { name: "Анна Иванова", phone: "+7 900 000-00-00", goal: "Стать сильнее" },
    );

    expect(message).toEqual({
      to: LEAD_RECIPIENT_EMAIL,
      subject: "D&K Fit — новая заявка",
      text: [
        "Новая заявка с сайта https://dk-fit.test",
        "Автор: Тестовый Автор",
        "",
        "Данные из заявки:",
        "Имя: Анна Иванова",
        "Телефон: +7 900 000-00-00",
        "Цель тренировок: Стать сильнее",
      ].join("\n"),
    });
  });

  it("keeps applicant values in the plain-text body and never in message headers", () => {
    const message = formatLeadEmail(
      {
        publicSiteUrl: new URL("https://dk-fit.test"),
        siteAuthorFullName: "Тестовый Автор",
        leadRecipientEmail: LEAD_RECIPIENT_EMAIL,
      },
      { name: "Анна Иванова", phone: "+7 900 000-00-00", goal: undefined },
    );

    expect(message).toMatchObject({
      to: LEAD_RECIPIENT_EMAIL,
      subject: "D&K Fit — новая заявка",
    });
    expect(message.text).toContain("Цель тренировок: Не указана");
    expect(JSON.stringify({ to: message.to, subject: message.subject })).not.toContain("Анна Иванова");
    expect(JSON.stringify({ to: message.to, subject: message.subject })).not.toContain("900");
  });

  it("uses the approved fallback for an explicitly blank training goal", () => {
    const message = formatLeadEmail(
      {
        publicSiteUrl: new URL("https://dk-fit.test"),
        siteAuthorFullName: "Тестовый Автор",
        leadRecipientEmail: LEAD_RECIPIENT_EMAIL,
      },
      { name: "Анна Иванова", phone: "+7 900 000-00-00", goal: "" },
    );

    expect(message.text).toContain("Цель тренировок: Не указана");
  });
});
