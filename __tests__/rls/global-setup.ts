import type { TestProject } from "vitest/node";
import { readLocalStack } from "../helpers/local-stack";
import { startManagedRun, awaitWritersExit } from "../helpers/managed-run.mjs";
import { releaseRun, closeRun, runEnvironment } from "../helpers/run-ownership.mjs";
import { trackedFetch } from "../helpers/fixture-ownership";
import { IDS } from "../e2e/accounts";

declare module "vitest" {
  export interface ProvidedContext {
    ownership: Awaited<ReturnType<typeof startManagedRun>>;
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

async function signIn(apiUrl: string, anonKey: string, actor: ActorName, request: typeof fetch): Promise<string> {
  const response = await request(`${apiUrl}/auth/v1/token?grant_type=password`, {
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
// handed to the test files. The host check inside readLocalStack runs before any request is sent.
export default async function setup(project: TestProject) {
  let ref: Awaited<ReturnType<typeof startManagedRun>> | undefined;
  try {
    const stack = readLocalStack(project.config.root);
    ref = await startManagedRun(stack, "rls", project.config.root);
    project.provide("ownership", ref);
    const request = trackedFetch(ref, () => "setup");
    const tokens = {
      learner: await signIn(stack.apiUrl, stack.anonKey, "learner", request),
      student: await signIn(stack.apiUrl, stack.anonKey, "student", request),
      admin: await signIn(stack.apiUrl, stack.anonKey, "admin", request),
    };
    project.provide("localStack", { ...stack, tokens });
    const prior = process.env.DEVSPACE_OWNERSHIP;
    process.env.DEVSPACE_OWNERSHIP = runEnvironment(ref).DEVSPACE_OWNERSHIP;
    return async () => {
      if (prior === undefined) delete process.env.DEVSPACE_OWNERSHIP;
      else process.env.DEVSPACE_OWNERSHIP = prior;
      // Vitest 5.0.5 runs this teardown before it awaits exit of the last isolated worker, so that worker can
      // still be registered and alive here. Fence admission, give it a bounded time to exit, then let
      // releaseRun decide; a writer still alive at the deadline keeps ownership.
      closeRun(ref);
      await awaitWritersExit(ref);
      releaseRun(ref);
    };
  } catch (error) {
    const messages = [error instanceof Error ? error.message : String(error)];
    if (ref) {
      try { releaseRun(ref); }
      catch (cleanup) { messages.push(`ownership retained: ${cleanup instanceof Error ? cleanup.message : String(cleanup)}`); }
    }
    // Vitest 5.0.5 crashes while source-mapping the stack of an error thrown from a global setup
    // ("code.charCodeAt is not a function") and then hides the message. A frame-less error prints it.
    const failure = new Error(messages.join("; "));
    failure.stack = `Error: ${failure.message}`;
    throw failure;
  }
}
