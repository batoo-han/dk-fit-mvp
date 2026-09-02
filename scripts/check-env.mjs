import { EnvValidationError, getServerEnv } from "../src/lib/config/env.ts";

try {
  getServerEnv();
} catch (error) {
  if (error instanceof EnvValidationError) {
    console.error(error.keys.join("\n"));
  } else {
    console.error("CONFIGURATION_ERROR");
  }
  process.exitCode = 1;
}
