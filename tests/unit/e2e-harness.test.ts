import net from "node:net";
import { describe, expect, it } from "vitest";

import {
  createNextCommand,
  findAvailableLoopbackPort,
  waitForHttpReady,
  waitForPortToClose,
} from "../../scripts/e2e-harness.mjs";

describe("production E2E harness", () => {
  it("uses the current Node executable for direct Next commands", () => {
    expect(createNextCommand("build")).toEqual({
      command: process.execPath,
      args: ["node_modules/next/dist/bin/next", "build"],
      shell: false,
    });
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
