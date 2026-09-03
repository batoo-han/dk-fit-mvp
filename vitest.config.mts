import { defineConfig } from "vitest/config";

const serverOnlyStub = new URL("./node_modules/server-only/empty.js", import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: {
      "server-only": serverOnlyStub,
    },
  },
  test: {
    environment: "jsdom",
    include: [
      "tests/unit/**/*.{test,spec}.{ts,tsx}",
      "tests/component/**/*.{test,spec}.{ts,tsx}",
      "tests/integration/**/*.{test,spec}.{ts,tsx}",
    ],
  },
});
