// Reads the process environment once, at startup, so a missing value stops the process before it listens.
// Names are listed here and nowhere else in the API: a new variable is added to this file and to the README of the
// instruction files that name the Railway settings.
export type ServerEnv = {
  host: string;
  port: number;
  // Identifies the build for /api/health. Railway sets RAILWAY_GIT_COMMIT_SHA for a GitHub deploy; ADR 0008 D10
  // step B compares it with the merged commit.
  commit: string;
};

export class EnvError extends Error {}

export function readServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  const rawPort = env.PORT ?? "4000";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EnvError("PORT must be an integer between 1 and 65535.");
  }
  return {
    // Railway must reach the process from outside; the local launchers pass HOST=127.0.0.1 explicitly.
    host: env.HOST || "0.0.0.0",
    port,
    commit: env.RAILWAY_GIT_COMMIT_SHA || "unknown",
  };
}
