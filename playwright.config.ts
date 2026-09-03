import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.DK_FIT_E2E_BASE_URL ?? "http://127.0.0.1:3212";
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
    baseURL,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});
