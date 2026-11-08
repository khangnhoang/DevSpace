import { appendFileSync } from "node:fs";
import { startApp } from "../src/bootstrap";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
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

// When E2E_API_REQUEST_FILE is set, every request is recorded when its answer ends: method, path without the query,
// status. A test reads it to show which calls reached the API and which did not (AC11). It records no header, cookie
// or body, and it exists only in this entry point.
function requestRecord(): ((app: NestExpressApplication) => void) | undefined {
  const file = process.env.E2E_API_REQUEST_FILE;
  if (!file) return undefined;
  return (app) => {
    app.use((request: Request, response: Response, next: NextFunction) => {
      response.on("finish", () => {
        appendFileSync(
          file,
          `${JSON.stringify({
            method: request.method,
            path: request.originalUrl.split("?")[0],
            status: response.statusCode,
            time: Date.now(),
          })}
`,
        );
      });
      next();
    });
  };
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
    requestRecord(),
  );
}

main().catch((error: unknown) => {
  const known =
    error instanceof EnvError || error instanceof DatabaseIdentityError;
  console.error(known ? `api: ${error.message}` : error);
  process.exit(1);
});
