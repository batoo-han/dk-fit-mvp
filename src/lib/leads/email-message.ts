import type { LeadSubmitRequest } from "../contracts/lead";

import "server-only";

export const LEAD_RECIPIENT = "superhumansmm@yandex.ru";
export const LEAD_EMAIL_SUBJECT = "D&K Fit — новая заявка";

export type LeadEmailMessage = {
  to: typeof LEAD_RECIPIENT;
  subject: typeof LEAD_EMAIL_SUBJECT;
  text: string;
};

type EmailEnvironment = {
  publicSiteUrl: URL;
  siteAuthorFullName: string;
};

type EmailLead = Pick<LeadSubmitRequest, "name" | "phone" | "goal">;

export function formatLeadEmail(environment: EmailEnvironment, lead: EmailLead): LeadEmailMessage {
  return {
    to: LEAD_RECIPIENT,
    subject: LEAD_EMAIL_SUBJECT,
    text: [
      `Новая заявка с сайта ${environment.publicSiteUrl.toString().replace(/\/$/u, "")}`,
      `Автор: ${environment.siteAuthorFullName}`,
      "",
      "Данные из заявки:",
      `Имя: ${lead.name}`,
      `Телефон: ${lead.phone}`,
      `Цель тренировок: ${lead.goal || "Не указана"}`,
    ].join("\n"),
  };
}
