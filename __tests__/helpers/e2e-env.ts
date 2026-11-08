import { apiDatabaseUrl } from "./api-role.ts";
import type { LocalStack } from "./local-stack";

// The E2E server uses a distinct port, but managed dev and tests contend for the same local database.
export const E2E_PORT = 3100;
export const E2E_ORIGIN = `http://127.0.0.1:${E2E_PORT}`;
// The API the e2e run serves beside Next (TM-U3 AC16): the e2e build with the test-only routes, on its own port. Next
// reaches it through API_INTERNAL_URL; a test reaches it directly where a row needs to.
export const E2E_API_PORT = 3101;
export const E2E_API_ORIGIN = `http://127.0.0.1:${E2E_API_PORT}`;
// The seed user whose session the temporary proof routes answer in the e2e run (`student@devspace.test`).
export const E2E_PROOF_USER_ID = "33333333-3333-4333-8333-333333333333";

// Every variable that `app`, `lib` and `proxy.ts` read, set non-empty for both `next build` (it inlines the
// NEXT_PUBLIC_* values into the client bundle) and `next start`. `@next/env` lets a non-empty process value win
// over the local environment file (which points at hosted) but deletes an empty one and refills it from the file, so no value
// here may be empty. The unit test `e2e-env.test.ts` fails when code reads a variable that is missing from this map.
export function buildE2eEnv(stack: LocalStack): Record<string, string> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: stack.apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey,
    NEXT_PUBLIC_BASE_URL: E2E_ORIGIN,
    VERCEL_URL: `127.0.0.1:${E2E_PORT}`,
    // Placeholders: the smoke never sends mail or calls Gemini, and the module-scope clients only need a value.
    GMAIL_USER: "e2e-placeholder@devspace.test",
    GMAIL_PASS: "e2e-placeholder-not-a-password",
    GEMINI_API_KEY: "e2e-placeholder-not-a-key",
    NEXT_TELEMETRY_DISABLED: "1",
    API_INTERNAL_URL: E2E_API_ORIGIN,
    // Read by next.config.ts: the page extension that makes the test-only fixture routes exist in this build only.
    E2E_NEXT_FIXTURES: "1",
  };
}

// The environment of the e2e API process. Every name the API reads is set here and none is taken from the caller's
// shell, so a shell that holds hosted values cannot reach it. `requestFile` is where the API records its requests.
export function buildE2eApiEnv(
  stack: LocalStack,
  requestFile: string,
): Record<string, string> {
  return {
    HOST: "127.0.0.1",
    PORT: String(E2E_API_PORT),
    RAILWAY_GIT_COMMIT_SHA: "e2e",
    DATABASE_URL: apiDatabaseUrl(stack.dbUrl),
    SUPABASE_URL: stack.apiUrl,
    SUPABASE_ANON_KEY: stack.anonKey,
    ALLOWED_ORIGINS: E2E_ORIGIN,
    API_PROOF_ENABLED: "1",
    API_PROOF_USER_ID: E2E_PROOF_USER_ID,
    E2E_API_REQUEST_FILE: requestFile,
  };
}
