import { apiDatabaseUrl } from "./api-role.ts";
import type { LocalStack } from "./local-stack";

export const DEV_PORT = 3000;
export const DEV_HOST = "127.0.0.1";
export const DEV_API_PORT = 4000;
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
    // The API `npm run dev` starts beside Next (DEV_API_PORT): `/api/*` is rewritten to it and the helper calls it.
    API_INTERNAL_URL: `http://${DEV_HOST}:${DEV_API_PORT}`,
    // The proof page is 404 unless this is exactly "1". The dev API does not enable the proof surfaces either, and an
    // empty value would be refilled from the environment file, so the value is an explicit "off".
    API_PROOF_ENABLED: "0",
  };
}

// The environment of the API on the dev stack. It starts from the inherited environment, which may hold hosted
// values, so every name the API reads is set here and never taken from the caller's shell. The database user is the
// API role with the local seed password (api-role.ts).
export function buildDevApiEnv(
  inherited: Record<string, string | undefined>,
  stack: LocalStack,
): Record<string, string | undefined> {
  return {
    ...inherited,
    HOST: DEV_HOST,
    PORT: String(DEV_API_PORT),
    RAILWAY_GIT_COMMIT_SHA: "dev",
    DATABASE_URL: apiDatabaseUrl(stack.dbUrl),
    SUPABASE_URL: stack.apiUrl,
    SUPABASE_ANON_KEY: stack.anonKey,
    ALLOWED_ORIGINS: DEV_ORIGIN,
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
