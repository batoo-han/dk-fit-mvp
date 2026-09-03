import { spawn } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const LOOPBACK_HOST = "127.0.0.1";
const NEXT_BIN = "node_modules/next/dist/bin/next";

export function createNextCommand(subcommand, args = []) {
  return {
    command: process.execPath,
    args: [NEXT_BIN, subcommand, ...args],
    shell: false,
  };
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
  const port = await findAvailableLoopbackPort();
  const baseUrl = `http://${LOOPBACK_HOST}:${port}`;

  await runCommand(createNextCommand("build"));

  const server = spawnOwnedServer(port);
  try {
    await waitForHttpReady({ url: `${baseUrl}/` });
    const playwrightOutput = await runCommand({
      command: process.execPath,
      args: ["node_modules/@playwright/test/cli.js", "test", ...playwrightArgs],
      shell: false,
      env: {
        ...process.env,
        DK_FIT_E2E_BASE_URL: baseUrl,
      },
    });
    reportPlaywrightSummary(playwrightOutput);
  } finally {
    await stopOwnedServer(server);
    await waitForPortToClose({ port });
  }

  return { port };
}

function spawnOwnedServer(port) {
  const nextStart = createNextCommand("start", ["--hostname", LOOPBACK_HOST, "--port", String(port)]);
  return spawn(nextStart.command, nextStart.args, {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production" },
    shell: nextStart.shell,
    stdio: "ignore",
    windowsHide: true,
  });
}

async function runCommand({ command, args, shell, env = process.env }) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
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
    throw new Error(`E2E prerequisite exited with code ${exitCode ?? "unknown"}`);
  }

  return output;
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
