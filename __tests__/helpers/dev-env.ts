import type { LocalStack } from "./local-stack";

export const DEV_PORT = 3000;
export const DEV_HOST = "127.0.0.1";
// Same origin as the local Auth `site_url` in supabase/config.toml, so sign-up and reset redirects and cookies
// stay on one host (the pages build their redirect from `window.location.origin`).
export const DEV_ORIGIN = `http://${DEV_HOST}:${DEV_PORT}`;

// The one variable the dev server may take from the Owner's environment file: with a key there, AI features
// work locally. It reaches no Supabase data, so it is the only name left out of `buildDevEnv`.
export const AI_KEY_VARIABLE = "GEMINI_API_KEY";

// Every variable that `app`, `lib` and `proxy.ts` read except the AI key, non-empty. `@next/env` refills a
// missing or empty value from the local environment file, which points at hosted, so no value here may be empty.
// The unit test `dev-env.test.ts` fails when code reads a variable that is neither here nor the AI key.
export function buildDevEnv(stack: LocalStack): Record<string, string> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: stack.apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey,
    NEXT_PUBLIC_BASE_URL: DEV_ORIGIN,
    VERCEL_URL: `${DEV_HOST}:${DEV_PORT}`,
    // Placeholders: `sendMail` fails and is logged, so no real mail leaves the machine (backlog FEAT-016).
    GMAIL_USER: "dev-placeholder@devspace.test",
    GMAIL_PASS: "dev-placeholder-not-a-password",
  };
}

// The environment handed to `next dev`. The local values override anything inherited, and an inherited AI key
// is removed so that Next takes it only from the environment file.
export function buildDevProcessEnv(
  inherited: Record<string, string | undefined>,
  stack: LocalStack,
): Record<string, string | undefined> {
  const env = { ...inherited, ...buildDevEnv(stack) };
  delete env[AI_KEY_VARIABLE];
  return env;
}
