import nodemailer from "nodemailer";

import type { ServerEnv } from "../config/env";
import type { LeadEmailMessage } from "./email-message";

import "server-only";

type SmtpTransport = {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<{ accepted?: string[] }>;
};

type CreateSmtpTransport = (options: {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  connectionTimeout: number;
  socketTimeout: number;
}) => SmtpTransport;

export class EmailUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("SMTP is unavailable", { cause });
    this.name = "EmailUnavailableError";
  }
}

export type LeadMailer = {
  send(message: LeadEmailMessage): Promise<void>;
};

export function createLeadMailer(
  environment: Pick<ServerEnv, "smtp">,
  createTransport: CreateSmtpTransport = nodemailer.createTransport as unknown as CreateSmtpTransport,
): LeadMailer {
  const transport = createTransport({
    host: environment.smtp.host,
    port: environment.smtp.port,
    secure: environment.smtp.secure,
    auth: { user: environment.smtp.user, pass: environment.smtp.password },
    connectionTimeout: environment.smtp.connectionTimeoutMs,
    socketTimeout: environment.smtp.socketTimeoutMs,
  });

  return {
    async send(message) {
      try {
        const result = await transport.sendMail({
          from: environment.smtp.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
        });

        if (!result.accepted?.some((recipient) => recipient.trim().toLowerCase() === message.to)) {
          throw new Error("Required recipient was not accepted");
        }
      } catch (error) {
        throw new EmailUnavailableError(error);
      }
    },
  };
}
