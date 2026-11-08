// Reads the process environment once, at startup, so a missing value stops the process before it listens.
// Names are listed here and nowhere else in the API; the Railway settings of the rollout (plan section 5, step 6)
// are exactly the required names below. A message names a variable and never prints a value.
export type ServerEnv = {
  host: string;
  port: number;
  // Identifies the build for /api/health. Railway sets RAILWAY_GIT_COMMIT_SHA for a GitHub deploy; ADR 0008 D10
  // step B compares it with the merged commit.
  commit: string;
  // The connection string of the role devspace_api (the session pooler on Railway, the local stack elsewhere).
  databaseUrl: string;
  // The Supabase Auth origin and the anon key the session guard sends with its token check.
  supabaseUrl: string;
  supabaseAnonKey: string;
  // Origins the CSRF guard accepts, as `URL.origin` values.
  allowedOrigins: string[];
};

export class EnvError extends Error {}

const REQUIRED = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "ALLOWED_ORIGINS",
] as const;

function parseOrigin(name: string, value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new EnvError(`${name} holds an entry that is not a URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new EnvError(`${name} holds an entry that is not an http(s) origin.`);
  }
  return url.origin;
}

export function readServerEnv(
  env: Record<string, string | undefined> = process.env,
): ServerEnv {
  const missing = REQUIRED.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new EnvError(`Missing required variable(s): ${missing.join(", ")}.`);
  }

  const rawPort = env.PORT ?? "4000";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EnvError("PORT must be an integer between 1 and 65535.");
  }

  const allowedOrigins = env
    .ALLOWED_ORIGINS!.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => parseOrigin("ALLOWED_ORIGINS", entry));
  if (allowedOrigins.length === 0) {
    throw new EnvError("ALLOWED_ORIGINS holds no origin.");
  }
  parseOrigin("SUPABASE_URL", env.SUPABASE_URL!);

  return {
    // Railway must reach the process from outside; the local launchers pass HOST=127.0.0.1 explicitly.
    host: env.HOST || "0.0.0.0",
    port,
    commit: env.RAILWAY_GIT_COMMIT_SHA || "unknown",
    databaseUrl: env.DATABASE_URL!,
    supabaseUrl: env.SUPABASE_URL!.trim().replace(/\/+$/, ""),
    supabaseAnonKey: env.SUPABASE_ANON_KEY!,
    allowedOrigins,
  };
}
