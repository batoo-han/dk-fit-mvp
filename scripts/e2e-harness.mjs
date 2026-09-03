import { spawn } from "node:child_process";
import { access, cp, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const LOOPBACK_HOST = "127.0.0.1";
const NEXT_BIN = "node_modules/next/dist/bin/next";
export const NEXT_LOCAL_ENV_FILENAMES = Object.freeze([
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
  ".env.test",
  ".env.test.local",
]);
export const standaloneRuntimeCopyOptions = Object.freeze({ dereference: true, recursive: true });
const FIXTURE_ENVIRONMENT = Object.freeze({
  DK_FIT_E2E_ALLOW_INSECURE_HTTP: "true",
  LEGAL_OPERATOR_CONTACT: "legal@dk-fit.test",
  LEGAL_OPERATOR_NAME: "Тестовый оператор",
  NODE_ENV: "production",
  PII_HASH_SECRET: "fixture-pii-hash-secret-for-e2e-12345",
  PUBLIC_SITE_URL: "https://dk-fit.test",
  REDIS_URL: "redis://127.0.0.1:6399",
  SITE_AUTHOR_FULL_NAME: "Тестовый Автор",
  SMTP_CONNECTION_TIMEOUT_MS: "5000",
  SMTP_FROM: "D&K Fit <no-reply@dk-fit.test>",
  SMTP_HOST: "smtp.dk-fit.test",
  LEAD_RECIPIENT_EMAIL: "lead-recipient@example.test",
  SMTP_PASSWORD: "fixture-smtp-password",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_SOCKET_TIMEOUT_MS: "5000",
  SMTP_USER: "fixture-user",
  TELEGRAM_BOT_TOKEN: "fixture-telegram-token",
  TELEGRAM_BOT_USERNAME: "test_bot",
  TELEGRAM_WEBHOOK_SECRET: "fixture-webhook-secret-for-e2e-12345",
});

export function assertNode24(nodeVersion = process.versions.node) {
  const major = Number.parseInt(nodeVersion.replace(/^v/u, "").split(".", 1)[0], 10);
  if (major !== 24) {
    throw new Error(`Node 24 is required for production E2E; found v${nodeVersion}`);
  }
}

export function createNextCommand(subcommand, args = []) {
  return {
    command: process.execPath,
    args: [path.resolve(NEXT_BIN), subcommand, ...args],
    shell: false,
  };
}

export function createStandaloneRuntimeLayout({ buildDirectory, runtimeDirectory }) {
  return [
    { from: path.join(buildDirectory, ".next", "standalone"), to: runtimeDirectory },
    { from: path.join(buildDirectory, ".next", "static"), to: path.join(runtimeDirectory, ".next", "static") },
    { from: path.join(buildDirectory, "public"), to: path.join(runtimeDirectory, "public") },
  ];
}

export function createStandaloneServerCommand({ port, runtimeDirectory }) {
  return {
    command: process.execPath,
    args: ["server.js"],
    cwd: runtimeDirectory,
    env: {
      ...FIXTURE_ENVIRONMENT,
      HOSTNAME: LOOPBACK_HOST,
      PORT: String(port),
    },
    shell: false,
  };
}

export function getNextLocalEnvironmentPaths({ projectRoot = process.cwd() } = {}) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  return NEXT_LOCAL_ENV_FILENAMES.map((filename) => path.join(resolvedProjectRoot, filename));
}

export async function findAvailableLoopbackPort() {
  const reservation = net.createServer();

  await new Promise((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, LOOPBACK_HOST, resolve);
  });

  const address = reservation.address();
  if (!address || typeof address === "string") {
    await closeServer(reservation);
    throw new Error("Could not reserve a loopback port for E2E");
  }

  await closeServer(reservation);
  return address.port;
}

export async function waitForHttpReady({
  url,
  timeoutMs = 30_000,
  intervalMs = 150,
  request = (target) => fetch(target),
}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      if ((await request(url)).ok) {
        return;
      }
    } catch {
      // The owned production server is allowed to be unavailable while it starts.
    }
    await delay(intervalMs);
  }

  throw new Error(`Timed out waiting for the owned E2E server at ${url}`);
}

export async function waitForPortToClose({ port, timeoutMs = 10_000, intervalMs = 100 }) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!(await isPortListening(port))) {
      return;
    }
    await delay(intervalMs);
  }

  throw new Error(`E2E server still owns loopback port ${port} after cleanup`);
}

export async function runProductionE2e(playwrightArgs) {
  assertNode24();
  const port = await findAvailableLoopbackPort();
  const baseUrl = `http://${LOOPBACK_HOST}:${port}`;
  const temporaryRoot = await mkdtemp(path.join(process.cwd(), ".dk-fit-production-e2e-"));
  const runtimeDirectory = path.join(temporaryRoot, "runtime");
  const nextEnvPath = path.resolve("next-env.d.ts");
  const nextEnvBackupPath = path.join(temporaryRoot, "next-env.d.ts");
  const recoveryDirectory = path.resolve(".dk-fit-e2e-recovery");

  let cleanupTemporaryRoot = true;
  try {
    await withQuarantinedEnvironment({
      environmentPaths: getNextLocalEnvironmentPaths(),
      quarantineDirectory: temporaryRoot,
      recoveryDirectory,
    }, async () => {
      await cp(nextEnvPath, nextEnvBackupPath);
      try {
        await runCommand({
          ...createNextCommand("build"),
          env: FIXTURE_ENVIRONMENT,
        });
      } finally {
        await cp(nextEnvBackupPath, nextEnvPath);
      }
    });
    await materializeStandaloneRuntime({ buildDirectory: process.cwd(), runtimeDirectory });

    const server = spawnOwnedServer({ port, runtimeDirectory });
    try {
      try {
        await waitForHttpReady({ url: `${baseUrl}/` });
      } catch (error) {
        const output = redactFixtureValues(server.e2eOutput ?? "").trim().slice(-2_000);
        const processState = server.exitCode === null ? "still running" : `exited with code ${server.exitCode}`;
        const spawnError = server.e2eError ? `; spawn error: ${server.e2eError}` : "";
        throw new Error(`${error instanceof Error ? error.message : "E2E server was not ready"} (${processState})${spawnError}${output ? `: ${output}` : ""}`);
      }
      const playwrightOutput = await runCommand({
        command: process.execPath,
        args: ["node_modules/@playwright/test/cli.js", "test", ...playwrightArgs],
        shell: false,
        env: {
          ...FIXTURE_ENVIRONMENT,
          DK_FIT_E2E_BASE_URL: baseUrl,
        },
      });
      reportPlaywrightSummary(playwrightOutput);
    } finally {
      await stopOwnedServer(server);
      await waitForPortToClose({ port });
    }
  } catch (error) {
    if (error && typeof error === "object" && error.preserveTemporaryRoot === true) {
      cleanupTemporaryRoot = false;
    }
    throw error;
  } finally {
    if (cleanupTemporaryRoot) {
      await cleanupProductionE2eWorkspace({ temporaryRoot });
    } else {
      console.error(`Controlled E2E temporary workspace retained for environment recovery: ${temporaryRoot}`);
    }
  }

  return { port };
}

export async function materializeStandaloneRuntime({ buildDirectory, runtimeDirectory }) {
  for (const entry of createStandaloneRuntimeLayout({ buildDirectory, runtimeDirectory })) {
    await cp(entry.from, entry.to, standaloneRuntimeCopyOptions);
  }
}

export async function withQuarantinedEnvironment({
  environmentPaths,
  quarantineDirectory,
  recoveryDirectory = path.resolve(".dk-fit-e2e-recovery"),
  renameFile = rename,
  pathExists: doesPathExist = pathExists,
}, run) {
  await mkdir(quarantineDirectory, { recursive: true });
  const quarantined = [];

  for (const [index, environmentPath] of environmentPaths.entries()) {
    const quarantinePath = path.join(quarantineDirectory, `.env.e2e-quarantine-${index}-${path.basename(environmentPath)}`);
    try {
      await renameFile(environmentPath, quarantinePath);
      quarantined.push({ environmentPath, quarantinePath });
    } catch (error) {
      if (!hasErrorCode(error, "ENOENT")) {
        await preserveQuarantinedEnvironment({ quarantined, recoveryDirectory, renameFile, pathExists: doesPathExist, restorationError: error });
      }
    }
  }

  try {
    return await run();
  } finally {
    await restoreQuarantinedEnvironment({ quarantined, recoveryDirectory, renameFile, pathExists: doesPathExist });
  }
}

async function restoreQuarantinedEnvironment({ quarantined, recoveryDirectory, renameFile, pathExists }) {
  for (const entry of [...quarantined].reverse()) {
    try {
      if (await pathExists(entry.environmentPath)) {
        throw new Error(`Refusing to overwrite a new file at ${path.basename(entry.environmentPath)}`);
      }
      await renameFile(entry.quarantinePath, entry.environmentPath);
      quarantined.splice(quarantined.indexOf(entry), 1);
    } catch (error) {
      await preserveQuarantinedEnvironment({ quarantined, recoveryDirectory, renameFile, pathExists, restorationError: error });
    }
  }
}

async function preserveQuarantinedEnvironment({ quarantined, recoveryDirectory, renameFile, pathExists, restorationError }) {
  const remainingEntries = [];
  try {
    for (const entry of quarantined) {
      if (await pathExists(entry.quarantinePath)) {
        remainingEntries.push(entry);
      }
    }
  } catch (discoveryError) {
    throw createPreserveTemporaryRootError({
      quarantined,
      recoveryDirectory,
      restorationError,
      recoveryError: discoveryError,
    });
  }

  if (remainingEntries.length === 0) {
    throw restorationError;
  }

  const filenames = remainingEntries.map(({ environmentPath }) => path.basename(environmentPath));
  const recoveryPath = path.join(recoveryDirectory, `run-${randomUUID()}`);

  try {
    await mkdir(recoveryPath, { recursive: true });
    for (const entry of remainingEntries) {
      await renameFile(entry.quarantinePath, path.join(recoveryPath, path.basename(entry.environmentPath)));
      quarantined.splice(quarantined.indexOf(entry), 1);
    }
  } catch (recoveryError) {
    throw createPreserveTemporaryRootError({
      quarantined: remainingEntries,
      recoveryDirectory,
      restorationError,
      recoveryError,
    });
  }

  throw new Error(`Controlled E2E could not restore ${filenames.join(", ")}; files were recovered at ${recoveryPath}. Restore error code: ${errorCode(restorationError)}`);
}

function createPreserveTemporaryRootError({ quarantined, recoveryDirectory, restorationError, recoveryError }) {
  const filenames = quarantined.map(({ environmentPath }) => path.basename(environmentPath));
  const quarantinePath = quarantined[0] ? path.dirname(quarantined[0].quarantinePath) : "unknown";
  const error = new Error(`Controlled E2E could not safely recover ${filenames.join(", ") || "environment files"}; files may remain quarantined at ${quarantinePath}. Recovery directory was preserved at ${recoveryDirectory}. Temporary cleanup was skipped. Restore error code: ${errorCode(restorationError)}; recovery error code: ${errorCode(recoveryError)}`);
  error.preserveTemporaryRoot = true;
  return error;
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return false;
    }
    throw error;
  }
}

function hasErrorCode(error, expectedCode) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === expectedCode);
}

function errorCode(error) {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : "UNKNOWN";
}

export async function cleanupProductionE2eWorkspace({ temporaryRoot }) {
  await rm(temporaryRoot, { force: true, recursive: true });
}

function spawnOwnedServer({ port, runtimeDirectory }) {
  const standalone = createStandaloneServerCommand({ port, runtimeDirectory });
  const server = spawn(standalone.command, standalone.args, {
    cwd: standalone.cwd,
    env: standalone.env,
    shell: standalone.shell,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  server.e2eOutput = "";
  server.e2eError = undefined;
  server.once("error", (error) => {
    server.e2eError = error instanceof Error ? error.message : String(error);
  });
  for (const stream of [server.stdout, server.stderr]) {
    stream?.on("data", (chunk) => {
      server.e2eOutput += chunk;
    });
  }
  return server;
}

async function runCommand({ command, args, cwd = process.cwd(), shell, env }) {
  const child = spawn(command, args, {
    cwd,
    env,
    shell,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  const exitCode = await waitForExit(child);

  if (exitCode !== 0) {
    throw new Error(`E2E prerequisite exited with code ${exitCode ?? "unknown"}: ${redactFixtureValues(output).trim().slice(-2_000)}`);
  }

  return output;
}

function redactFixtureValues(output) {
  return Object.values(FIXTURE_ENVIRONMENT).reduce(
    (sanitized, value) => sanitized.replaceAll(value, "[redacted]"),
    output,
  );
}

function reportPlaywrightSummary(output) {
  const summary = output.match(/\b\d+\s+passed\b/u)?.[0];
  if (summary) {
    console.log(`Playwright: ${summary}`);
  }
}

async function stopOwnedServer(child, deadlineMs = 5_000) {
  if (child.exitCode !== null || child.pid === undefined) {
    return;
  }

  child.kill("SIGTERM");
  if (await exitsBefore(child, deadlineMs)) {
    return;
  }

  if (process.platform === "win32") {
    await runTaskkill(child.pid);
  } else {
    child.kill("SIGKILL");
  }

  if (!(await exitsBefore(child, deadlineMs))) {
    throw new Error("Owned E2E server did not stop before the cleanup deadline");
  }
}

async function runTaskkill(pid) {
  const child = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
    cwd: process.cwd(),
    shell: false,
    stdio: "ignore",
    windowsHide: true,
  });
  await exitsBefore(child, 5_000);
}

function waitForExit(child) {
  if (child.exitCode !== null) {
    return Promise.resolve(child.exitCode);
  }

  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code));
  });
}

async function exitsBefore(child, deadlineMs) {
  if (child.exitCode !== null) {
    return true;
  }

  return Promise.race([
    waitForExit(child).then(() => true),
    delay(deadlineMs).then(() => false),
  ]);
}

async function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: LOOPBACK_HOST, port });
    socket.setTimeout(250);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
