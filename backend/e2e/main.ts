import { startApp } from "../src/bootstrap";
import { EnvError, readServerEnv } from "../src/common/env";
import { DatabaseIdentityError } from "../src/db/db.service";
import { E2eModule } from "./e2e.module";

// The e2e entry point (AC20): the same application as src/main.ts plus the test-only routes. It is compiled only into
// dist-e2e. It is also the only place that can shorten the session cache and the handler time limit (AC6, AC9), so a
// test can observe expiry and the explicit timeout without waiting a minute; src/ reads no variable for either, so
// production cannot set them.
function shorter(name: string, limit: number): number {
  const value = process.env[name];
  if (value === undefined || value === "") return limit;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > limit) {
    throw new EnvError(`${name} must be an integer between 1 and ${limit}.`);
  }
  return parsed;
}

async function main() {
  const env = readServerEnv();
  await startApp(
    {
      ...env,
      sessionCacheTtlMs: shorter(
        "E2E_SESSION_CACHE_TTL_MS",
        env.sessionCacheTtlMs,
      ),
      requestTimeoutMs: shorter("E2E_REQUEST_TIMEOUT_MS", env.requestTimeoutMs),
    },
    [E2eModule.register()],
  );
}

main().catch((error: unknown) => {
  const known =
    error instanceof EnvError || error instanceof DatabaseIdentityError;
  console.error(known ? `api: ${error.message}` : error);
  process.exit(1);
});
