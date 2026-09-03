import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertNode24,
  cleanupProductionE2eWorkspace,
  createNextCommand,
  createStandaloneRuntimeLayout,
  createStandaloneServerCommand,
  findAvailableLoopbackPort,
  materializeStandaloneRuntime,
  standaloneRuntimeCopyOptions,
  waitForHttpReady,
  waitForPortToClose,
  withQuarantinedEnvironment,
} from "../../scripts/e2e-harness.mjs";

describe("production E2E harness", () => {
  it("rejects a non-24 Node runtime before E2E prerequisites can start", () => {
    expect(() => assertNode24("22.15.0")).toThrow("Node 24 is required for production E2E; found v22.15.0");
  });

  it("accepts a Node 24 runtime", () => {
    expect(() => assertNode24("24.16.0")).not.toThrow();
  });

  it("uses an absolute Next CLI path when the controlled build uses the project working directory", () => {
    expect(createNextCommand("build")).toEqual({
      command: process.execPath,
      args: [path.resolve("node_modules/next/dist/bin/next"), "build"],
      shell: false,
    });
  });

  it("keeps the package E2E entrypoint available for the test:e2e script", async () => {
    await expect(access(path.resolve("scripts/run-e2e.mjs"))).resolves.toBeUndefined();
  });

  it("atomically hides a user environment file only for the controlled build and restores it", async () => {
    const temporaryRoot = await mkdtemp(path.join(process.cwd(), ".e2e-harness-env-"));
    const environmentPath = path.join(temporaryRoot, ".env");
    await writeFile(environmentPath, "owner-controlled-value");

    try {
      await withQuarantinedEnvironment({ environmentPath, quarantineDirectory: temporaryRoot }, async () => {
        await expect(access(environmentPath)).rejects.toThrow();
      });
      await expect(access(environmentPath)).resolves.toBeUndefined();
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });

  it("cleans up the owned temporary production E2E runtime", async () => {
    const temporaryRoot = await mkdtemp(path.join(process.cwd(), ".e2e-harness-cleanup-"));
    await writeFile(path.join(temporaryRoot, "owned-runtime.txt"), "temporary");

    try {
      await cleanupProductionE2eWorkspace({ temporaryRoot });
      await expect(access(temporaryRoot)).rejects.toThrow();
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });

  it("materializes the standalone server with its static chunks and public assets", async () => {
    const temporaryRoot = await mkdtemp(path.join(process.cwd(), ".e2e-harness-runtime-"));
    const buildDirectory = path.join(temporaryRoot, "build");
    const runtimeDirectory = path.join(temporaryRoot, "runtime");

    await mkdir(path.join(buildDirectory, ".next", "standalone"), { recursive: true });
    await mkdir(path.join(buildDirectory, ".next", "static", "chunks"), { recursive: true });
    await mkdir(path.join(buildDirectory, "public"), { recursive: true });
    await writeFile(path.join(buildDirectory, ".next", "standalone", "server.js"), "server");
    await writeFile(path.join(buildDirectory, ".next", "static", "chunks", "app.js"), "client-chunk");
    await writeFile(path.join(buildDirectory, "public", "hero.webp"), "hero-asset");

    try {
      await materializeStandaloneRuntime({ buildDirectory, runtimeDirectory });
      await expect(readFile(path.join(runtimeDirectory, ".next", "static", "chunks", "app.js"), "utf8")).resolves.toBe("client-chunk");
      await expect(readFile(path.join(runtimeDirectory, "public", "hero.webp"), "utf8")).resolves.toBe("hero-asset");
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });

  it("makes the expected standalone server command", () => {
    const runtimeDirectory = "C:/tmp/dk-fit-runtime";
    const buildDirectory = "C:/tmp/dk-fit-build";

    expect(createStandaloneRuntimeLayout({ buildDirectory, runtimeDirectory })).toEqual([
      { from: path.join(buildDirectory, ".next", "standalone"), to: runtimeDirectory },
      { from: path.join(buildDirectory, ".next", "static"), to: path.join(runtimeDirectory, ".next", "static") },
      { from: path.join(buildDirectory, "public"), to: path.join(runtimeDirectory, "public") },
    ]);
    expect(createStandaloneServerCommand({ port: 4123, runtimeDirectory })).toMatchObject({
      command: process.execPath,
      args: ["server.js"],
      cwd: runtimeDirectory,
      env: expect.objectContaining({
        DK_FIT_E2E_ALLOW_INSECURE_HTTP: "true",
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
        PORT: "4123",
      }),
      shell: false,
    });
  });

  it("dereferences linked standalone dependencies while materializing the Docker-equivalent runtime", () => {
    expect(standaloneRuntimeCopyOptions).toEqual({ dereference: true, recursive: true });
  });

  it("waits for a successful HTTP response instead of treating an early failure as ready", async () => {
    let attempts = 0;

    await expect(
      waitForHttpReady({
        url: "http://127.0.0.1:1/",
        timeoutMs: 100,
        intervalMs: 1,
        request: async () => {
          attempts += 1;
          return { ok: attempts === 3 };
        },
      }),
    ).resolves.toBeUndefined();
    expect(attempts).toBe(3);
  });

  it("detects when a loopback port has closed after the owned server exits", async () => {
    const port = await findAvailableLoopbackPort();
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));

    const closing = new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await closing;

    await expect(waitForPortToClose({ port, timeoutMs: 100, intervalMs: 1 })).resolves.toBeUndefined();
  });
});
