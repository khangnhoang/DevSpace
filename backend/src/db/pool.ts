import type { PoolConfig } from "pg";

// One replica holds at most 5 connections, far under the session-pooler and direct limits (ADR 0008 D2).
export const POOL_MAX = 5;

// `sslmode=require` means "encrypt, do not verify the certificate" for libpq, the Supabase documentation and the
// URL the Owner copies from the dashboard. node-postgres reads the same value as verify-full, and the pooler's
// certificate chain is not in Node's store, so the parameter is turned into the matching option here. Other
// values (an absent `sslmode`, `disable`, `verify-full`) are left to pg.
export function poolConfig(databaseUrl: string): PoolConfig {
  const url = new URL(databaseUrl);
  const mode = url.searchParams.get("sslmode");
  const config: PoolConfig = {
    max: POOL_MAX,
    // Short idle timeouts let the pooler reclaim connections and keep a restart of the database cheap.
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  };
  if (mode === "require") {
    url.searchParams.delete("sslmode");
    config.ssl = { rejectUnauthorized: false };
  }
  config.connectionString = url.toString();
  return config;
}
