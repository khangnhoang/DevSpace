import type { TestProject } from "vitest/node";
import { readLocalStack } from "../helpers/local-stack";

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

type ActorName = "learner" | "admin";

// The passwords are the local test values written in supabase/seed.sql.
const ACTORS: Record<ActorName, { email: string; password: string }> = {
  learner: { email: "learner@devspace.test", password: "learner-local-pass-1" },
  admin: { email: "admin@devspace.test", password: "admin-local-pass-1" },
};

async function signIn(apiUrl: string, anonKey: string, actor: ActorName): Promise<string> {
  const response = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(ACTORS[actor]),
  });
  const body = (await response.json().catch(() => ({}))) as { access_token?: string; msg?: string; error_code?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(
      `Signing in ${actor} on the local stack failed (HTTP ${response.status} ${body.error_code ?? body.msg ?? ""}). ` +
        "Run npx supabase db reset to reload the seed.",
    );
  }
  return body.access_token;
}

// Each actor signs in once per run (the local Auth limit is 30 sign-ins per 5 minutes) and the tokens are
// handed to the test files. The host check inside readLocalStack runs before any request is sent.
export default async function setup(project: TestProject) {
  try {
    const stack = readLocalStack(project.config.root);
    const tokens = {
      learner: await signIn(stack.apiUrl, stack.anonKey, "learner"),
      admin: await signIn(stack.apiUrl, stack.anonKey, "admin"),
    };
    project.provide("localStack", { ...stack, tokens });
  } catch (error) {
    // Vitest 5.0.5 crashes while source-mapping the stack of an error thrown from a global setup
    // ("code.charCodeAt is not a function") and then hides the message. A frame-less error prints it.
    const failure = new Error(error instanceof Error ? error.message : String(error));
    failure.stack = `Error: ${failure.message}`;
    throw failure;
  }
}
