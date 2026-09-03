import { runProductionE2e } from "./e2e-harness.mjs";

try {
  const { port } = await runProductionE2e(process.argv.slice(2));
  console.log(`Production E2E completed; loopback port ${port} is closed.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Production E2E failed");
  process.exitCode = 1;
}
