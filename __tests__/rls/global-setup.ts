import type { TestProject } from "vitest/node";
import { requireActiveRun } from "../../scripts/test-stack/lock.mjs";
import { readTestStack } from "../../scripts/test-stack/read.mjs";
import { IDS } from "../e2e/accounts";

declare module "vitest" {
  export interface ProvidedContext {
    localStack: {
      apiUrl: string;
      dbUrl: string;
      anonKey: string;
      serviceRoleKey: string;
      tokens: Record<ActorName, string>;
    };
  }
}

type ActorName = "learner" | "student" | "admin";

// The passwords are the local test values written in supabase/seed.sql.
const ACTORS: Record<ActorName, { email: string; password: string }> = {
  learner: { email: "learner@devspace.test", password: "learner-local-pass-1" },
  student: { email: "student@devspace.test", password: "student-local-pass-1" },
  admin: { email: "admin@devspace.test", password: "admin-local-pass-1" },
};

async function signIn(apiUrl: string, anonKey: string, actor: ActorName): Promise<string> {
  const response = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(ACTORS[actor]),
  });
  const body = (await response.json().catch(() => ({}))) as { access_token?: string; msg?: string; error_code?: string; user?: { id?: string; email?: string } };
  if (!response.ok || !body.access_token) {
    throw new Error(
      `Signing in ${actor} on the local stack failed (HTTP ${response.status} ${body.error_code ?? body.msg ?? ""}). ` +
        "Run npx supabase db reset to reload the seed.",
    );
  }
  if (body.user?.id !== IDS[actor] || body.user.email !== ACTORS[actor].email) throw new Error(`Signing in ${actor} did not identify the required seed actor; fixture writes are blocked`);
  return body.access_token;
}

// Each actor signs in once per run (the local Auth limit is 30 sign-ins per 5 minutes) and the tokens are
// handed to the test files. The host and test-project checks inside readTestStack run before any request is sent.
export default async function setup(project: TestProject) {
  try {
    // Only npm test starts the run: it holds the stack lock and registers this process as a writer. Vitest run
    // directly would write to the test stack without either.
    requireActiveRun({ command: "npm test" });
    const stack = readTestStack(project.config.root);
    const tokens = {
      learner: await signIn(stack.apiUrl, stack.anonKey, "learner"),
      student: await signIn(stack.apiUrl, stack.anonKey, "student"),
      admin: await signIn(stack.apiUrl, stack.anonKey, "admin"),
    };
    project.provide("localStack", { ...stack, tokens });
  } catch (error) {
    // Vitest 5.0.5 crashes while source-mapping the stack of an error thrown from a global setup and hides the
    // message; a frame-less error prints it.
    const failure = new Error(error instanceof Error ? error.message : String(error));
    failure.stack = `Error: ${failure.message}`;
    throw failure;
  }
}
