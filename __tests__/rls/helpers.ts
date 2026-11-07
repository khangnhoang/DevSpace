import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { expect, inject } from "vitest";
import {
  admitted,
  FixtureScope,
  guardedFetch,
  runCleanupHook,
  serviceRoleClients,
  sharedRunMarker,
  type HookContext,
} from "../helpers/fixture-ownership";

const stack = inject("localStack");
let currentScope: FixtureScope | undefined;

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

// Every request of a test body that can change data, from an actor or from the service-role `fixtures` client (RPC
// writes included), is admitted right before it is sent, so a timed-out test that resumes cannot write after the run
// turned unclean (QE-P8). Reads pass. Cleanup uses `cleanupFixtures` below, which is not guarded and must still run
// on an unclean run.
const actorFetch = guardedFetch(sharedRunMarker);

function clientWith(token?: string): SupabaseClient {
  return createClient(stack.apiUrl, stack.anonKey, {
    ...clientOptions,
    global: {
      fetch: actorFetch,
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    },
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
function serviceRoleClient(fetchWith: typeof fetch) {
  return createClient(stack.apiUrl, stack.serviceRoleKey, {
    ...clientOptions,
    global: { fetch: fetchWith },
  });
}
const serviceRole = serviceRoleClients(serviceRoleClient, sharedRunMarker);
export const fixtures = serviceRole.fixtures;

// The same service role for cleanup and its reconciliation only (the scope's cleanup, a finally block that removes
// what the test created): never guarded, so an unclean run can still clean up.
export const cleanupFixtures = serviceRole.cleanup;

export function startFixtureScope() {
  currentScope = new FixtureScope(cleanupFixtures, stack.dbUrl);
}
export function fixtureScope() {
  if (!currentScope) throw new Error("No RLS fixture scope");
  return currentScope;
}
// A timed-out test may leave a request in flight, so it makes the run unclean even when the cleanup succeeds, and a
// cleanup hook that times out marks the run before its pending operation settles. Register it as `afterEach(finishFixtureScope)`
// or call it with the hook's context; the context is required.
export async function finishFixtureScope(context: HookContext) {
  const scope = currentScope;
  await runCleanupHook(context, scope?.run ?? sharedRunMarker(), async () => {
    if (scope) await scope.cleanup();
  });
  currentScope = undefined;
}

export async function ownedInsert<V extends Record<string, unknown>, T>(
  table: string,
  values: V,
  run: (values: V) => PromiseLike<T>,
): Promise<T> {
  const columns: Record<string, string[]> = {
    courses: ["slug"],
    chapters: ["title"],
    lessons: ["slug"],
    reviews: ["user_id", "course_id"],
    comments: ["content"],
    notes: ["content"],
    user_progress: ["user_id", "lesson_id"],
    enrollments: ["user_id", "course_id"],
    payments: ["user_id", "course_id"],
    notifications: ["title"],
    profile_cards: ["id"],
  };
  if (!columns[table]) throw new Error(`No owned insert selector for ${table}`);
  const actualTable = table === "profile_cards" ? "profiles" : table;
  const where = Object.fromEntries(
    columns[table].map((key) => [key, values[key]]),
  ) as Record<string, string | number>;
  if (Object.values(where).some((value) => value === undefined))
    throw new Error("Incomplete ownership selector");
  const scope = fixtureScope();
  const intent = await scope.reserve(actualTable, where);
  // Checked after `reserve` resolved, the last await before the request.
  const result = await admitted(scope.run, () => run(values));
  // Resolve even a no-returning or unexpectedly successful denied write before assertions run. Adopt IDs
  // before a caller can rename its fixture; the initial intent covers a lost response/read-back failure.
  const rows = must(await fixtures.from(actualTable).select("id").match(where));
  if (rows.length > 1) throw new Error("Ambiguous inserted fixture ownership");
  if (rows.length && where.id !== rows[0].id) {
    scope.adopt(actualTable, rows[0].id, intent);
  }
  return result;
}

export const IDS = {
  learner: "11111111-1111-4111-8111-111111111111",
  admin: "22222222-2222-4222-8222-222222222222",
  student: "33333333-3333-4333-8333-333333333333",
} as const;

// Fails the test when a fixture, verification or cleanup query errors, so a broken setup never reads as a pass.
export function must<T>(result: {
  data: T;
  error: { message: string; code?: string } | null;
}): NonNullable<T> {
  if (result.error)
    throw new Error(
      `fixture query failed: ${result.error.code ?? ""} ${result.error.message}`,
    );
  // A write without `returning` has data null; a missing row for `.single()` is already an error above.
  return result.data as NonNullable<T>;
}

// 42501 is the RLS or privilege denial. A constraint error such as 23505 or 23503 means the policy was
// never reached, so it must not count as a denial.
export function expectDenied(
  error: { code?: string; message?: string } | null,
) {
  expect(error, "the request should have been denied").not.toBeNull();
  expect(error?.code, error?.message).toBe("42501");
}

export async function withPg<T>(
  run: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new pg.Client({ connectionString: stack.dbUrl });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}
