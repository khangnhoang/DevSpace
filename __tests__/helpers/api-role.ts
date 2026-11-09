// The login role of the API (ADR 0008 D7) on a local stack. The migration creates it NOLOGIN; the local seed
// (supabase/seed.sql) sets LOGIN and this invented value, which exists only on the local stacks.
export const API_ROLE = "devspace_api";
export const API_ROLE_LOCAL_PASSWORD = "localapipassword123";

// The URL the API uses on a local stack: the stack's database URL with the user and password replaced. The host is
// the stack's own, already checked to be loopback by `readLocalStack`.
export function apiDatabaseUrl(stackDbUrl: string): string {
  const url = new URL(stackDbUrl);
  url.username = API_ROLE;
  url.password = API_ROLE_LOCAL_PASSWORD;
  return url.toString();
}
