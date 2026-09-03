import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const composePath = resolve(process.cwd(), "compose.yaml");

describe("production Compose configuration", () => {
  it("uses the local production env file by default and pins production mode", async () => {
    const compose = await readFile(composePath, "utf8");

    expect(compose).toContain("path: ${DK_FIT_ENV_FILE:-.env}");
    expect(compose).toContain("NODE_ENV: production");
  });

  it("binds the application port to loopback for trusted reverse-proxy ingress", async () => {
    const compose = await readFile(composePath, "utf8");

    expect(compose).toContain('"127.0.0.1:${DK_FIT_APP_PORT:-3000}:3000"');
    expect(compose).not.toContain('"3000:3000"');
  });
});
