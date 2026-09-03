export const SMTP_SMOKE_SUBJECT: "D&K Fit — SMTP smoke";
export const SMTP_SMOKE_TEXT: "D&K Fit SMTP smoke\n\nThis is an explicit release-readiness test message.\nNo lead was submitted.\n";

export type SmokeArguments =
  | { mode: "preflight" }
  | { mode: "send"; recipient: string };

export type SmokePreflightResult =
  | { ok: true }
  | { ok: false; keys: string[] };

export type SmokeTransport = {
  verify(): Promise<unknown>;
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<{ accepted?: unknown[] }>;
};

export function parseSmokeArguments(argumentsList: string[]): SmokeArguments;
export function runPreflight(environment?: Record<string, string | undefined>): SmokePreflightResult;
export function runSmtpSmoke(options: {
  arguments: string[];
  environment?: Record<string, string | undefined>;
  createTransport?: (options: {
    host: string;
    port: number;
    secure: boolean;
    requireTLS: true;
    tls: { rejectUnauthorized: true };
    auth: { user: string; pass: string };
    connectionTimeout: number;
    socketTimeout: number;
  }) => SmokeTransport;
}): Promise<{ ok: true }>;
export function main(argumentsList?: string[], environment?: Record<string, string | undefined>): Promise<number>;
