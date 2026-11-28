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

// Holds the answer of the home course list for the number of milliseconds the cookie `e2e-api-delay-ms` names (TM-U4 AC8). The Next server
// forwards the visitor's cookies to the API, so a browser row can make this one read slow and watch the page show its
// fallback first, which Playwright cannot do to a server-side request any other way. A cap keeps a stray cookie from
// hanging a run, and src/ has nothing like it.
const SLOW_HOME_CAP_MS = 10_000;

function slowHome(app: NestExpressApplication) {
  app.use((request: Request, _response: Response, next: NextFunction) => {
    const match = /(?:^|;\s*)e2e-api-delay-ms=(\d+)/.exec(
      request.headers.cookie ?? "",
    );
    if (
      request.method !== "GET" ||
      !match ||
      !request.path.endsWith("/courses/home")
    ) {
      next();
      return;
    }
    setTimeout(() => next(), Math.min(Number(match[1]), SLOW_HOME_CAP_MS));
  });
}

// Makes one learn route fail for a caller that carries the cookie `e2e-learn-fault=<route>.<kind>`, route being outline,
// lesson or quiz and kind 500 or malformed (a 200 whose body is not the route's). It answers before the guards, so a
// browser row can fail the layout's outline read while the page's own read succeeds (TM-U5 AC10), which no other
// switch can do because both reads carry the same cookies. src/ has nothing like it.
function learnFault(app: NestExpressApplication) {
  app.use((request: Request, response: Response, next: NextFunction) => {
    const match =
      /(?:^|;\s*)e2e-learn-fault=(outline|lesson|quiz)\.(500|malformed)/.exec(
        request.headers.cookie ?? "",
      );
    if (
      request.method !== "GET" ||
      !match ||
      request.path !== `/api/learn/${match[1]}`
    ) {
      next();
      return;
    }
    if (match[2] === "500") response.status(500).json({ message: "fault" });
    else response.status(200).json({ unexpected: true });
  });
}

function configure(app: NestExpressApplication) {
  // The record goes first, so a request that the fault answers is recorded too.
  requestRecord()?.(app);
  learnFault(app);
  slowHome(app);
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
    configure,
  );
}

main().catch((error: unknown) => {
  const known =
    error instanceof EnvError || error instanceof DatabaseIdentityError;
  console.error(known ? `api: ${error.message}` : error);
  process.exit(1);
});
