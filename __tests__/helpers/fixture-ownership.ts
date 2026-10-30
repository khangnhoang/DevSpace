import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { assertRun, recordEntry, forgetEntry, inspectRun, closeScope, admitBrowserRequest } from "./run-ownership.mjs";

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

export function trackedFetch(ref: RunReference, scope: () => string, requireOpenScope = false): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (["GET", "HEAD"].includes(method)) return fetch(input, init);
    assertRun(ref);
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin.replace("localhost", "127.0.0.1") !== ref.target.api) throw new Error("Mutation target does not match owned local API");
    const id = requireOpenScope ? admitBrowserRequest(ref, scope(), url.pathname) : recordEntry(ref, { kind: "request", scope: scope(), path: url.pathname, pid: process.pid });
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
  readonly ref: RunReference;
  readonly db: SupabaseClient;
  readonly dbUrl: string;
  private closed = false;
  constructor(ref: RunReference, db: SupabaseClient, dbUrl: string) {
    this.ref = ref; this.db = db; this.dbUrl = dbUrl;
    assertRun(ref);
    recordEntry(ref, { kind: "scope", scope: this.id, state: "open" });
  }

  label(value: string) { return `${value} [${this.tag}]`; }
  code(value: string) { return `${value}-${this.tag}`.toUpperCase(); }

  async reserve(table: string, where: Where) {
    if (this.closed) throw new Error("Fixture scope no longer admits mutations");
    if (!order.includes(table) || !Object.keys(where).length) throw new Error("Unbounded fixture ownership selector");
    assertRun(this.ref);
    if (checked(await this.db.from(table).select("id").match(where)).length) throw new Error(`Fixture prerequisite failed: ${table} selector is already occupied`);
    return recordEntry(this.ref, { kind: "rows", scope: this.id, table, where });
  }

  async acquire(table: string, id: Value, fields: string[], expected?: Where) {
    if (this.closed) throw new Error("Fixture scope no longer admits mutations");
    if (!order.includes(table) || !fields.length || fields.includes("*")) throw new Error("Invalid acquired fields");
    assertRun(this.ref);
    const row = checked(await this.db.from(table).select(fields.join(",")).eq("id", id).single()) as unknown as Where;
    if (expected && !isDeepStrictEqual(row, expected)) throw new Error(`Fixture prerequisite failed: ${table} acquired fields differ from baseline`);
    recordEntry(this.ref, { kind: "restore", scope: this.id, table, where: { id }, fields: row });
    return row;
  }

  async authIds(email: string): Promise<string[]> {
    const db = new pg.Client({ connectionString: this.dbUrl, application_name: "devspace-fixtures" });
    try { await db.connect(); return (await db.query("select id from auth.users where email = $1", [email])).rows.map(row => row.id); }
    finally { await db.end(); }
  }

  async reserveAuth(email: string) {
    if (this.closed) throw new Error("Fixture scope no longer admits mutations");
    assertRun(this.ref);
    if (!email.endsWith("@devspace.test") || !email.includes(this.tag)) throw new Error("Auth email must belong to this scope");
    if ((await this.authIds(email)).length) throw new Error("Auth fixture prerequisite failed: email already exists");
    recordEntry(this.ref, { kind: "auth", scope: this.id, email });
  }

  async cleanup() {
    this.closed = true;
    closeScope(this.ref, this.id);
    await cleanupEntries(this.ref, this.db, this.dbUrl, this.id);
  }
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

async function assertNoDependents(dbUrl: string, schema: string, table: string, id: Value, provisionedProfile = false) {
  const client = new pg.Client({ connectionString: dbUrl, application_name: "devspace-fixtures" });
  const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
  try {
    await client.connect();
    const { rows } = await client.query(`select child.relname as child_table, ca.attname as child_column,
        pa.attname as parent_column, cardinality(c.conkey) as columns
      from pg_constraint c join pg_class child on child.oid = c.conrelid
      join pg_namespace n on n.oid = child.relnamespace
      join pg_attribute ca on ca.attrelid = child.oid and ca.attnum = c.conkey[1]
      join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
      where c.contype = 'f' and c.confrelid = $1::regclass and n.nspname = 'public'`, [`${schema}.${table}`]);
    for (const relation of rows) {
      if (relation.columns !== 1 || relation.parent_column !== "id") throw new Error(`Unsupported fixture dependency: ${table} -> ${relation.child_table}`);
      // Auth provisioning creates this profile as part of the owned account. Its own dependents are
      // checked separately; all other application rows must be gone before the account can be deleted.
      if (provisionedProfile && relation.child_table === "profiles" && relation.child_column === "id") continue;
      const dependent = await client.query(`select 1 from public.${quote(relation.child_table)} where ${quote(relation.child_column)} = $1 limit 1`, [id]);
      if (dependent.rows.length) throw new Error(`Cleanup blocked: ${schema}.${table} ${id} still has dependent ${relation.child_table} rows`);
    }
  } finally { await client.end(); }
}

function assertNoAcquiredFields(ref: RunReference, table: string, id: Value) {
  if (inspectRun(ref).entries.some(other => other.kind === "restore" && other.table === table && other.where?.id === id)) throw new Error(`Cleanup blocked: ${table} still has acquired fields`);
}

export async function cleanupEntries(ref: RunReference, db: SupabaseClient, dbUrl: string, scope?: string) {
  if (scope !== undefined) assertRun(ref);
  // An HTTP handler must finish before reconciliation: enrollment may precede its later notification.
  const deadline = Date.now() + 10_000;
  while (inspectRun(ref).entries.some(entry => entry.kind === "http") && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
  const state = inspectRun(ref);
  if (state.entries.some(entry => ["http", "request"].includes(entry.kind))) throw new Error("Outstanding mutation request; ownership retained for explicit investigation");
  const entries = state.entries.filter(entry => scope === undefined || entry.scope === scope);
  entries.sort((a, b) => (a.kind === "restore" ? -100 : a.kind === "auth" ? 100 : a.kind === "scope" ? 200 : order.indexOf(a.table)) - (b.kind === "restore" ? -100 : b.kind === "auth" ? 100 : b.kind === "scope" ? 200 : order.indexOf(b.table)));
  const failures: unknown[] = [];
  for (const entry of entries) {
    try {
      if (entry.kind === "scope") {
        if (failures.length) continue;
      } else if (entry.kind === "auth") {
        const client = new pg.Client({ connectionString: dbUrl, application_name: "devspace-fixtures" });
        let ids: string[];
        try { await client.connect(); ids = (await client.query("select id from auth.users where email = $1", [entry.email])).rows.map(row => row.id); }
        finally { await client.end(); }
        if (ids.length > 1) throw new Error("Ambiguous Auth ownership");
        for (const id of ids) {
          assertNoAcquiredFields(ref, "profiles", id);
          await assertNoDependents(dbUrl, "public", "profiles", id);
          await assertNoDependents(dbUrl, "auth", "users", id, true);
          await deleteOwnedUser(db, id);
        }
      } else if (entry.kind === "restore") {
        if (!order.includes(entry.table) || !entry.where?.id || !entry.fields) throw new Error("Unrecognized restore ownership");
        checked(await db.from(entry.table).update(entry.fields).match(entry.where));
        const restored = checked(await db.from(entry.table).select(Object.keys(entry.fields).join(",")).match(entry.where).single());
        if (!isDeepStrictEqual(restored, entry.fields)) throw new Error(`Restore verification failed: ${entry.table}`);
      } else if (entry.kind === "rows") {
        if (!order.includes(entry.table) || !Object.keys(entry.where ?? {}).length) throw new Error("Unrecognized row ownership");
        const rows = checked(await db.from(entry.table).select("id").match(entry.where));
        if (rows.length > 1) throw new Error(`Ambiguous ownership: ${entry.table} selector matched multiple rows`);
        for (const row of rows) {
          assertNoAcquiredFields(ref, entry.table, row.id);
          // Cascades and SET NULL can change a foreign scope even when the parent ID is ours.
          // Own children were removed earlier; any remaining dependent blocks this deletion.
          await assertNoDependents(dbUrl, "public", entry.table, row.id);
          checked(await db.from(entry.table).delete().in("id", [row.id]));
        }
        if (checked(await db.from(entry.table).select("id").match(entry.where)).length) throw new Error(`Cleanup left owned ${entry.table} rows`);
      } else throw new Error(`Unrecognized ownership kind: ${entry.kind}`);
      forgetEntry(ref, entry.id);
    } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "Owned fixture cleanup failed; unresolved entries retained", { cause: failures[0] });
}
