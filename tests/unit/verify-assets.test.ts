import { spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const probePath = path.join(process.cwd(), "public", "unreviewed-asset-probe.tmp");

async function runAssetVerifier() {
  return new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/verify-assets.mjs"], {
      cwd: process.cwd(),
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({ code, stderr });
    });
  });
}

afterEach(async () => {
  await rm(probePath, { force: true });
});

describe("verify-assets", () => {
  it("rejects an unreviewed file in the public root", async () => {
    await writeFile(probePath, "unreviewed");

    const result = await runAssetVerifier();

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("public/unreviewed-asset-probe.tmp is not in the reviewed asset inventory");
  });
});
