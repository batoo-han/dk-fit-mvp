import { defineConfig, devices } from "@playwright/test";

const localPreviewHosts = ["127.0.0.1", "localhost"];
const noProxyHosts = new Set(
  `${process.env.NO_PROXY ?? ""},${process.env.no_proxy ?? ""}`
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
);

for (const host of localPreviewHosts) {
  noProxyHosts.add(host);
}

process.env.NO_PROXY = [...noProxyHosts].join(",");
process.env.no_proxy = process.env.NO_PROXY;

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3212",
  },
  webServer: {
    command:
      "node ./node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3212",
    port: 3212,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});
