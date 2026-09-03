import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

describe("ESLint configuration", () => {
  it("excludes the E2E harness TypeScript declaration contract from JavaScript parsing", async () => {
    const eslint = new ESLint({ cwd: process.cwd() });

    await expect(eslint.isPathIgnored(path.resolve("scripts/e2e-harness.d.mts"))).resolves.toBe(true);
  }, 15_000);
});
