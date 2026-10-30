import type { LocalStack } from "./local-stack";

// The E2E server uses a distinct port, but managed dev and tests contend for the same local database.
export const E2E_PORT = 3100;
export const E2E_ORIGIN = `http://127.0.0.1:${E2E_PORT}`;

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
  };
}
