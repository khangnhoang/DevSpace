import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { expect, inject } from "vitest";

const stack = inject("localStack");

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

function clientWith(token?: string): SupabaseClient {
  return createClient(stack.apiUrl, stack.anonKey, {
    ...clientOptions,
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

// One client per actor. Each request under test goes through one of these, so RLS and grants apply.
export const anon = clientWith();
export const learner = clientWith(stack.tokens.learner);
export const student = clientWith(stack.tokens.student);
export const admin = clientWith(stack.tokens.admin);

// A client that shares no session with the actors above: `signUp` keeps the new session in memory even with
// persistSession off, and a shared client would then send that user's token.
export const newAnonClient = () => clientWith();

// Service role: bypasses RLS. Only for preparing fixtures, reading state back to verify a result, and cleanup;
// never for the request under test.
export const fixtures = createClient(stack.apiUrl, stack.serviceRoleKey, clientOptions);

export const IDS = {
  learner: "11111111-1111-4111-8111-111111111111",
  admin: "22222222-2222-4222-8222-222222222222",
  student: "33333333-3333-4333-8333-333333333333",
} as const;

// Fails the test when a fixture, verification or cleanup query errors, so a broken setup never reads as a pass.
export function must<T>(result: { data: T; error: { message: string; code?: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(`fixture query failed: ${result.error.code ?? ""} ${result.error.message}`);
  // A write without `returning` has data null; a missing row for `.single()` is already an error above.
  return result.data as NonNullable<T>;
}

// 42501 is the RLS or privilege denial. A constraint error such as 23505 or 23503 means the policy was
// never reached, so it must not count as a denial.
export function expectDenied(error: { code?: string; message?: string } | null) {
  expect(error, "the request should have been denied").not.toBeNull();
  expect(error?.code, error?.message).toBe("42501");
}

export async function withPg<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: stack.dbUrl });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}
