import { pathToFileURL } from "node:url";

import nodemailer from "nodemailer";

import { EnvValidationError, getServerEnv } from "../src/lib/config/env.ts";

export const SMTP_SMOKE_SUBJECT = "D&K Fit — SMTP smoke";
export const SMTP_SMOKE_TEXT = "D&K Fit SMTP smoke\n\nThis is an explicit release-readiness test message.\nNo lead was submitted.\n";

function safeError(code) {
  return new Error(code);
}

export function parseSmokeArguments(argumentsList) {
  if (argumentsList.length === 1 && argumentsList[0] === "--preflight") {
    return { mode: "preflight" };
  }

  let recipient;
  let confirmed = false;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--to") {
      if (recipient !== undefined || index + 1 >= argumentsList.length) {
        throw safeError("A valid --to recipient is required");
      }
      recipient = argumentsList[index + 1];
      index += 1;
      continue;
    }
    if (argument === "--confirm-send" && !confirmed) {
      confirmed = true;
      continue;
    }

    throw safeError("Use --preflight or --to <recipient> --confirm-send");
  }

  if (typeof recipient !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(recipient)) {
    throw safeError("A valid --to recipient is required");
  }
  if (!confirmed) {
    throw safeError("--confirm-send is required before an SMTP message can be sent");
  }

  return { mode: "send", recipient };
}

export function runPreflight(environment = process.env) {
  if (environment.NODE_ENV !== "production") {
    return { ok: false, keys: ["NODE_ENV"] };
  }

  try {
    getServerEnv(environment);
    return { ok: true };
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return { ok: false, keys: error.keys };
    }
    return { ok: false, keys: ["CONFIGURATION_ERROR"] };
  }
}

export async function runSmtpSmoke({
  arguments: argumentsList,
  environment = process.env,
  createTransport = nodemailer.createTransport,
}) {
  const options = parseSmokeArguments(argumentsList);
  if (options.mode !== "send") {
    throw safeError("Use --to <recipient> --confirm-send to send an SMTP smoke message");
  }

  const preflight = runPreflight(environment);
  if (!preflight.ok) {
    throw safeError("CONFIGURATION_ERROR");
  }

  const serverEnvironment = getServerEnv(environment);
  const transport = createTransport({
    host: serverEnvironment.smtp.host,
    port: serverEnvironment.smtp.port,
    secure: serverEnvironment.smtp.secure,
    auth: { user: serverEnvironment.smtp.user, pass: serverEnvironment.smtp.password },
    connectionTimeout: serverEnvironment.smtp.connectionTimeoutMs,
    socketTimeout: serverEnvironment.smtp.socketTimeoutMs,
  });

  await transport.verify();
  const result = await transport.sendMail({
    from: serverEnvironment.smtp.from,
    to: options.recipient,
    subject: SMTP_SMOKE_SUBJECT,
    text: SMTP_SMOKE_TEXT,
  });
  const accepted = Array.isArray(result.accepted) && result.accepted.some(
    (value) => String(value).toLowerCase() === options.recipient.toLowerCase(),
  );

  if (!accepted) {
    throw safeError("SMTP_SMOKE_NOT_ACCEPTED");
  }

  return { ok: true };
}

function printPreflightResult(result) {
  if (result.ok) {
    console.log("PREFLIGHT_OK");
    return 0;
  }

  console.error(result.keys.join("\n"));
  return 1;
}

export async function main(argumentsList = process.argv.slice(2), environment = process.env) {
  let options;
  try {
    options = parseSmokeArguments(argumentsList);
  } catch {
    console.error("USAGE_ERROR");
    return 1;
  }

  if (options.mode === "preflight") {
    return printPreflightResult(runPreflight(environment));
  }

  const preflight = runPreflight(environment);
  if (!preflight.ok) {
    return printPreflightResult(preflight);
  }

  try {
    await runSmtpSmoke({ arguments: argumentsList, environment });
    console.log("SMTP_SMOKE_ACCEPTED");
    return 0;
  } catch {
    console.error("SMTP_SMOKE_FAILED");
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
