import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const completeEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  PUBLIC_SITE_URL: "https://dk-fit.test",
  SITE_AUTHOR_FULL_NAME: "Тестовый Автор",
  SMTP_HOST: "smtp.dk-fit.test",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_USER: "fixture-user",
  SMTP_PASSWORD: "fixture-password",
  SMTP_FROM: "D&K Fit <no-reply@dk-fit.test>",
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

describe("container runner preflight", () => {
  it("runs from the single artifact copied into the production runner", async () => {
    const result = await runCopiedPreflight(completeEnvironment);

    expect({ status: result.status, stdout: result.stdout, stderr: result.stderr }).toEqual({
      status: 0,
      stdout: "",
      stderr: "",
    });
  });

  it("accepts a production STARTTLS configuration", async () => {
    const result = await runCopiedPreflight({ ...completeEnvironment, SMTP_SECURE: "false" });

    expect({ status: result.status, stdout: result.stdout, stderr: result.stderr }).toEqual({
      status: 0,
      stdout: "",
      stderr: "",
    });
  });

  it("copies and invokes that standalone artifact in the runner stage", async () => {
    const dockerfile = await readFile(resolve(process.cwd(), "Dockerfile"), "utf8");
    const runnerStage = dockerfile.split(" AS runner", 2)[1];

    expect(runnerStage).toContain("/app/scripts/check-env.mjs ./scripts/check-env.mjs");
    expect(runnerStage).toContain("node scripts/check-env.mjs && exec node server.js");
  });

  it("rejects unsafe integer text by key name without echoing its value", async () => {
    const unsafeValue = "9".repeat(400);
    const result = await runCopiedPreflight({
      ...completeEnvironment,
      SMTP_SOCKET_TIMEOUT_MS: unsafeValue,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe("SMTP_SOCKET_TIMEOUT_MS");
    expect(result.stderr).not.toContain(unsafeValue);
  });
});

async function runCopiedPreflight(environment: NodeJS.ProcessEnv) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "dk-fit-runner-preflight-"));
  const scriptsDirectory = join(temporaryRoot, "scripts");

  try {
    await mkdir(scriptsDirectory);
    await copyFile(
      resolve(process.cwd(), "scripts/check-env.mjs"),
      join(scriptsDirectory, "check-env.mjs"),
    );

    return spawnSync(process.execPath, [join("scripts", "check-env.mjs")], {
      cwd: temporaryRoot,
      encoding: "utf8",
      env: environment,
    });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
