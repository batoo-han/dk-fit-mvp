import { z } from "zod";

import "server-only";

const MIN_SECRET_LENGTH = 32;

const requiredText = z.string().trim().min(1);
const safeEmail = z
  .string()
  .min(3)
  .max(254)
  .refine((value) => value === value.trim(), "Email cannot include surrounding whitespace")
  .pipe(z.email());
const serverSecret = z
  .string()
  .min(MIN_SECRET_LENGTH)
  .refine((value) => !/\s/u.test(value), "Secret cannot contain whitespace");
const positiveIntegerText = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().positive());

const rawEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).optional(),
    PUBLIC_SITE_URL: requiredText,
    SITE_AUTHOR_FULL_NAME: requiredText,
    SMTP_HOST: requiredText,
    SMTP_PORT: positiveIntegerText.pipe(z.number().max(65_535)),
    SMTP_SECURE: z.enum(["true", "false"]),
    SMTP_USER: requiredText,
    SMTP_PASSWORD: requiredText,
    SMTP_FROM: requiredText,
    LEAD_RECIPIENT_EMAIL: safeEmail,
    SMTP_CONNECTION_TIMEOUT_MS: positiveIntegerText,
    SMTP_SOCKET_TIMEOUT_MS: positiveIntegerText,
    TELEGRAM_BOT_TOKEN: requiredText,
    TELEGRAM_BOT_USERNAME: z
      .string()
      .trim()
      .min(1)
      .regex(/^[^@\s]+$/),
    TELEGRAM_WEBHOOK_SECRET: serverSecret,
    REDIS_URL: requiredText,
    PII_HASH_SECRET: serverSecret,
    LEGAL_OPERATOR_NAME: requiredText,
    LEGAL_OPERATOR_CONTACT: requiredText,
  });

type RawEnvironment = z.input<typeof rawEnvironmentSchema>;
type ParsedEnvironment = z.output<typeof rawEnvironmentSchema>;

export type ServerEnv = {
  publicSiteUrl: URL;
  siteAuthorFullName: string;
  leadRecipientEmail: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
    connectionTimeoutMs: number;
    socketTimeoutMs: number;
  };
  telegram: { token: string; username: string; webhookSecret: string };
  redisUrl: string;
  piiHashSecret: string;
  legalOperatorName: string;
  legalOperatorContact: string;
};

export class EnvValidationError extends Error {
  readonly keys: string[];

  constructor(keys: string[]) {
    super(`Invalid server environment: ${keys.join(", ")}`);
    this.name = "EnvValidationError";
    this.keys = keys;
  }
}

function invalidKeys(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => String(issue.path[0])))].sort();
}

function parsePublicSiteUrl(environment: ParsedEnvironment): URL {
  try {
    const url = new URL(environment.PUBLIC_SITE_URL);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Unsupported protocol");
    }
    if (environment.NODE_ENV === "production" && url.protocol !== "https:") {
      throw new Error("Production requires HTTPS");
    }

    return url;
  } catch {
    throw new EnvValidationError(["PUBLIC_SITE_URL"]);
  }
}

function parseRedisUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
      throw new Error("Unsupported protocol");
    }
    return value;
  } catch {
    throw new EnvValidationError(["REDIS_URL"]);
  }
}

export function getServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const result = rawEnvironmentSchema.safeParse(source as RawEnvironment);
  if (!result.success) {
    throw new EnvValidationError(invalidKeys(result.error));
  }

  const environment = result.data;

  return {
    publicSiteUrl: parsePublicSiteUrl(environment),
    siteAuthorFullName: environment.SITE_AUTHOR_FULL_NAME,
    leadRecipientEmail: environment.LEAD_RECIPIENT_EMAIL,
    smtp: {
      host: environment.SMTP_HOST,
      port: environment.SMTP_PORT,
      secure: environment.SMTP_SECURE === "true",
      user: environment.SMTP_USER,
      password: environment.SMTP_PASSWORD,
      from: environment.SMTP_FROM,
      connectionTimeoutMs: environment.SMTP_CONNECTION_TIMEOUT_MS,
      socketTimeoutMs: environment.SMTP_SOCKET_TIMEOUT_MS,
    },
    telegram: {
      token: environment.TELEGRAM_BOT_TOKEN,
      username: environment.TELEGRAM_BOT_USERNAME,
      webhookSecret: environment.TELEGRAM_WEBHOOK_SECRET,
    },
    redisUrl: parseRedisUrl(environment.REDIS_URL),
    piiHashSecret: environment.PII_HASH_SECRET,
    legalOperatorName: environment.LEGAL_OPERATOR_NAME,
    legalOperatorContact: environment.LEGAL_OPERATOR_CONTACT,
  };
}
