import { existsSync } from "node:fs";
import { join } from "node:path";
import type { TestProject } from "vitest/node";
import { requireActiveRun } from "../../scripts/test-stack/lock.mjs";
import { readTestStack } from "../../scripts/test-stack/read.mjs";
import type { ApiStack } from "../helpers/api-process";

declare module "vitest" {
  export interface ProvidedContext {
    apiStack: ApiStack;
  }
}

// The `api` project runs only under `npm test`, which holds the stack lock, registers this process as a writer and
// builds the API first. The stack comes from the test project's status after the host and Docker identity checks.
export default function setup(project: TestProject) {
  try {
    requireActiveRun({ command: "npm test" });
    const root = project.config.root;
    if (!existsSync(join(root, "dist", "backend", "src", "main.js"))) {
      throw new Error(
        "The API is not built (dist/backend/src/main.js). Run npm test, which builds it before the tests.",
      );
    }
    const { apiUrl, dbUrl, anonKey, serviceRoleKey } = readTestStack(root);
    project.provide("apiStack", { apiUrl, dbUrl, anonKey, serviceRoleKey });
  } catch (error) {
    // Vitest 5.0.5 hides the message of an error thrown from a global setup unless it has no stack frames.
    const failure = new Error(
      error instanceof Error ? error.message : String(error),
    );
    failure.stack = `Error: ${failure.message}`;
    throw failure;
  }
}
