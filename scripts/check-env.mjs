const REQUIRED_TEXT_KEYS = [
  "PUBLIC_SITE_URL",
  "SITE_AUTHOR_FULL_NAME",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
  "LEAD_RECIPIENT_EMAIL",
  "TELEGRAM_BOT_TOKEN",
  "LEGAL_OPERATOR_NAME",
  "LEGAL_OPERATOR_CONTACT",
];

const POSITIVE_INTEGER_KEYS = [
  "SMTP_PORT",
  "SMTP_CONNECTION_TIMEOUT_MS",
  "SMTP_SOCKET_TIMEOUT_MS",
];

const SECRET_KEYS = ["TELEGRAM_WEBHOOK_SECRET", "PII_HASH_SECRET"];

export function invalidEnvironmentKeys(environment = process.env) {
  const invalid = new Set();

  for (const key of REQUIRED_TEXT_KEYS) {
    if (!hasText(environment[key])) {
      invalid.add(key);
    }
  }

  for (const key of POSITIVE_INTEGER_KEYS) {
    if (!isPositiveIntegerText(environment[key])) {
      invalid.add(key);
    }
  }

  const smtpPort = Number(environment.SMTP_PORT);
  if (Number.isFinite(smtpPort) && smtpPort > 65_535) {
    invalid.add("SMTP_PORT");
  }

  if (environment.NODE_ENV !== undefined && !["development", "test", "production"].includes(environment.NODE_ENV)) {
    invalid.add("NODE_ENV");
  }
  if (!["true", "false"].includes(environment.SMTP_SECURE ?? "")) {
    invalid.add("SMTP_SECURE");
  }
  const telegramUsername = environment.TELEGRAM_BOT_USERNAME?.trim();
  if (!telegramUsername || !/^[^@\s]+$/u.test(telegramUsername)) {
    invalid.add("TELEGRAM_BOT_USERNAME");
  }

  for (const key of SECRET_KEYS) {
    const secret = environment[key];
    if (typeof secret !== "string" || secret.length < 32 || /\s/u.test(secret)) {
      invalid.add(key);
    }
  }

  if (!isUrlWithProtocols(environment.PUBLIC_SITE_URL, ["http:", "https:"])) {
    invalid.add("PUBLIC_SITE_URL");
  } else if (environment.NODE_ENV === "production" && new URL(environment.PUBLIC_SITE_URL.trim()).protocol !== "https:") {
    invalid.add("PUBLIC_SITE_URL");
  }

  if (!isUrlWithProtocols(environment.REDIS_URL, ["redis:", "rediss:"])) {
    invalid.add("REDIS_URL");
  }
  if (!isSafeEmail(environment.LEAD_RECIPIENT_EMAIL)) {
    invalid.add("LEAD_RECIPIENT_EMAIL");
  }

  return [...invalid].sort();
}

export function main(environment = process.env) {
  const invalidKeys = invalidEnvironmentKeys(environment);
  if (invalidKeys.length === 0) {
    return 0;
  }

  console.error(invalidKeys.join("\n"));
  return 1;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveIntegerText(value) {
  if (typeof value !== "string" || !/^\d+$/u.test(value)) {
    return false;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0;
}

function isUrlWithProtocols(value, protocols) {
  if (!hasText(value)) {
    return false;
  }

  try {
    return protocols.includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}

function isSafeEmail(value) {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    value.length <= 254 &&
    /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/u.test(value)
  );
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  process.exitCode = main();
}
