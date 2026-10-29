import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { assertRun, recordEntry, forgetEntry, inspectRun } from "./run-ownership.mjs";

export type RunReference = ReturnType<typeof import("./run-ownership.mjs").acquireRun>;
type Value = string | number | boolean | null;
type Where = Record<string, Value>;
const order = ["notifications", "payments", "user_progress", "notes", "reviews", "comments", "exercises", "lessons", "chapters", "enrollments", "courses", "coupons", "profiles"];

export function checked<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(`fixture query failed: ${result.error.message}`);
  return result.data as NonNullable<T>;
}

export async function userExists(db: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await db.auth.admin.getUserById(id);
  if (error) {
    if (error.status === 404 && error.code === "user_not_found") return false;
    throw new Error(`getUserById failed: ${error.message}`);
  }
  if (!data.user) throw new Error("getUserById returned no user and no error");
  return true;
}

export async function deleteOwnedUser(db: SupabaseClient, id: string) {
  if (!(await userExists(db, id))) return;
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) throw new Error(`deleteUser failed: ${error.message}`);
  if (await userExists(db, id)) throw new Error(`cleanup left user ${id}`);
}

export function trackedFetch(ref: RunReference, scope: () => string): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (["GET", "HEAD"].includes(method)) return fetch(input, init);
    assertRun(ref);
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin.replace("localhost", "127.0.0.1") !== ref.target.api) throw new Error("Mutation target does not match owned local API");
    const id = recordEntry(ref, { kind: "request", scope: scope(), path: url.pathname, pid: process.pid });
    // A rejected transport leaves evidence: an aborted client does not prove the server rolled back.
    const response = await fetch(input, init);
    await response.clone().arrayBuffer();
    forgetEntry(ref, id);
    return response;
  };
}

export class FixtureScope {
  readonly id = randomUUID();
  readonly tag = this.id.replaceAll("-", "").slice(0, 12);
  constructor(readonly ref: RunReference, readonly db: SupabaseClient, readonly dbUrl: string) { assertRun(ref); }

  label(value: string) { return `${value} [${this.tag}]`; }
  code(value: string) { return `${value}-${this.tag}`.toUpperCase(); }

  async reserve(table: string, where: Where) {
    if (!order.includes(table) || !Object.keys(where).length) throw new Error("Unbounded fixture ownership selector");
    assertRun(this.ref);
    if (checked(await this.db.from(table).select("id").match(where)).length) throw new Error(`Fixture prerequisite failed: ${table} selector is already occupied`);
    return recordEntry(this.ref, { kind: "rows", scope: this.id, table, where });
  }

  async acquire(table: string, id: Value, fields: string[], expected?: Where) {
    if (!order.includes(table) || !fields.length || fields.includes("*")) throw new Error("Invalid acquired fields");
    assertRun(this.ref);
    const row = checked(await this.db.from(table).select(fields.join(",")).eq("id", id).single()) as unknown as Where;
    if (expected && !isDeepStrictEqual(row, expected)) throw new Error(`Fixture prerequisite failed: ${table} acquired fields differ from baseline`);
    recordEntry(this.ref, { kind: "restore", scope: this.id, table, where: { id }, fields: row });
    return row;
  }

  async authIds(email: string): Promise<string[]> {
    const db = new pg.Client({ connectionString: this.dbUrl, application_name: "devspace-fixtures" });
    await db.connect();
    try { return (await db.query("select id from auth.users where email = $1", [email])).rows.map(row => row.id); }
    finally { await db.end(); }
  }

  async reserveAuth(email: string) {
    assertRun(this.ref);
    if (!email.endsWith("@devspace.test") || !email.includes(this.tag)) throw new Error("Auth email must belong to this scope");
    if ((await this.authIds(email)).length) throw new Error("Auth fixture prerequisite failed: email already exists");
    recordEntry(this.ref, { kind: "auth", scope: this.id, email });
  }

  async cleanup() { await cleanupEntries(this.ref, this.db, this.dbUrl, this.id); }
}

export async function withFixtureScope<T>(scope: Pick<FixtureScope, "cleanup">, run: () => Promise<T>): Promise<T> {
  let result: T;
  try { result = await run(); }
  catch (original) {
    try { await scope.cleanup(); }
    catch (cleanup) { throw new AggregateError([original, cleanup], "Fixture body and cleanup failed", { cause: original }); }
    throw original;
  }
  await scope.cleanup();
  return result;
}

export async function cleanupEntries(ref: RunReference, db: SupabaseClient, dbUrl: string, scope?: string) {
  if (scope !== undefined) assertRun(ref);
  // An HTTP handler must finish before reconciliation: enrollment may precede its later notification.
  const deadline = Date.now() + 10_000;
  while (inspectRun(ref).entries.some(entry => entry.kind === "http") && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
  const state = inspectRun(ref);
  if (state.entries.some(entry => ["http", "request"].includes(entry.kind))) throw new Error("Outstanding mutation request; ownership retained for explicit investigation");
  const entries = state.entries.filter(entry => scope === undefined || entry.scope === scope);
  entries.sort((a, b) => (a.kind === "restore" ? -100 : a.kind === "auth" ? 100 : order.indexOf(a.table)) - (b.kind === "restore" ? -100 : b.kind === "auth" ? 100 : order.indexOf(b.table)));
  const failures: unknown[] = [];
  for (const entry of entries) {
    try {
      if (entry.kind === "auth") {
        const client = new pg.Client({ connectionString: dbUrl, application_name: "devspace-fixtures" });
        await client.connect();
        let ids: string[];
        try { ids = (await client.query("select id from auth.users where email = $1", [entry.email])).rows.map(row => row.id); }
        finally { await client.end(); }
        if (ids.length > 1) throw new Error("Ambiguous Auth ownership");
        for (const id of ids) await deleteOwnedUser(db, id);
      } else if (entry.kind === "restore") {
        if (!order.includes(entry.table) || !entry.where?.id || !entry.fields) throw new Error("Unrecognized restore ownership");
        checked(await db.from(entry.table).update(entry.fields).match(entry.where));
        const restored = checked(await db.from(entry.table).select(Object.keys(entry.fields).join(",")).match(entry.where).single());
        if (!isDeepStrictEqual(restored, entry.fields)) throw new Error(`Restore verification failed: ${entry.table}`);
      } else if (entry.kind === "rows") {
        if (!order.includes(entry.table) || !Object.keys(entry.where ?? {}).length) throw new Error("Unrecognized row ownership");
        const rows = checked(await db.from(entry.table).select("id").match(entry.where));
        if (rows.length > 1) throw new Error(`Ambiguous ownership: ${entry.table} selector matched multiple rows`);
        if (rows.length) checked(await db.from(entry.table).delete().in("id", rows.map(row => row.id)));
        if (checked(await db.from(entry.table).select("id").match(entry.where)).length) throw new Error(`Cleanup left owned ${entry.table} rows`);
      } else throw new Error(`Unrecognized ownership kind: ${entry.kind}`);
      forgetEntry(ref, entry.id);
    } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "Owned fixture cleanup failed; unresolved entries retained", { cause: failures[0] });
}
