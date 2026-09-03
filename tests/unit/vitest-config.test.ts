import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Vitest configuration", () => {
  it("does not load dotenv files from the repository root", async () => {
    const configModule = await import(pathToFileURL(resolve(process.cwd(), "vitest.config.mts")).href) as {
      default: { envDir?: string | false };
    };

    expect(configModule.default.envDir).toBe(false);
  });
});
