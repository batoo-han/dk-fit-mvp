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
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
});
