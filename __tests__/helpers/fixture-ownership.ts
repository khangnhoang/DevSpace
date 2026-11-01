import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { markUnclean, runContext, uncleanCause } from "../../scripts/test-stack/lock.mjs";

type Value = string | number | boolean | null;
type Where = Record<string, Value>;
const order = ["notifications", "payments", "user_progress", "notes", "reviews", "comments", "exercises", "lessons", "chapters", "enrollments", "courses", "coupons", "profiles"];

// What a scope tells the rest of its run. The default is the run's shared state, so a failed cleanup, residue or a
// timed-out test in one process stops every later scope of the run in any other process (AC7). A test that
// provokes such a failure on purpose passes its own.
export type RunMarker = { check(): string | null; mark(cause: string): void };

export function sharedRunMarker(): RunMarker {
  const run = runContext();
  // Outside a test run (a unit row) there is no shared state to read or write.
  if (!run) return { check: () => null, mark: () => {} };
  return { check: () => uncleanCause(run), mark: (cause) => markUnclean({ ...run, cause }) };
}

// A test that times out may leave a request in flight, so the run is unclean even if the cleanup then succeeds.
export function noteTimeout(testName: string, run: RunMarker = sharedRunMarker()) {
  run.mark(`test timed out: ${testName}`);
}

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

type Entry = { id: string; kind: "rows" | "restore" | "auth"; table: string; where?: Where; fields?: Where; email?: string };

// Selectors held by open scopes of this process. It is memory only: a selector that an earlier or a crashed run
// left occupied is found by the empty-selector check of `reserve`, and a write nobody reserved by the end-of-run audit.
const held = new Map<string, string>();
const selectorKey = (table: string, where: Where) => `${table}|${JSON.stringify(Object.entries(where).sort(([a], [b]) => a.localeCompare(b)))}`;
const authKey = (email: string) => `auth|${email}`;
// Rows an open scope acquired fields of; deleting such a row would drop fields another scope must restore.
const acquired = new Set<string>();

export class FixtureScope {
  readonly id = randomUUID();
  readonly tag = this.id.replaceAll("-", "").slice(0, 12);
  readonly db: SupabaseClient;
  readonly dbUrl: string;
  readonly run: RunMarker;
  readonly entries: Entry[] = [];
  private closed = false;
  constructor(db: SupabaseClient, dbUrl: string, options: { run?: RunMarker } = {}) {
    this.db = db; this.dbUrl = dbUrl; this.run = options.run ?? sharedRunMarker();
    const cause = this.run.check();
    if (cause) throw new Error(`Previous fixture cleanup is unresolved or the run is unclean (${cause}); no new scope may acquire mutations`);
  }

  label(value: string) { return `${value} [${this.tag}]`; }
  code(value: string) { return `${value}-${this.tag}`.toUpperCase(); }

  private record(key: string, entry: Omit<Entry, "id">): string {
    if (held.has(key)) throw new Error("Fixture selector is already reserved; do not share ownership between scopes");
    const added = { ...entry, id: randomUUID() };
    held.set(key, this.id);
    if (entry.kind === "restore") acquired.add(key);
    this.entries.push(added);
    return added.id;
  }

  async reserve(table: string, where: Where) {
    if (this.closed) throw new Error("Fixture scope no longer admits mutations");
    if (!order.includes(table) || !Object.keys(where).length) throw new Error("Unbounded fixture ownership selector");
    if (checked(await this.db.from(table).select("id").match(where)).length) {
      // Rows under a selector nobody holds are residue of an earlier write, late or not: report it, never adopt it.
      this.run.mark(`residue: ${table} selector ${JSON.stringify(where)} was occupied at reservation`);
      throw new Error(`Fixture prerequisite failed: ${table} selector is already occupied`);
    }
    return this.record(selectorKey(table, where), { kind: "rows", table, where });
  }

  async acquire(table: string, id: Value, fields: string[], expected?: Where) {
    if (this.closed) throw new Error("Fixture scope no longer admits mutations");
    if (!order.includes(table) || !fields.length || fields.includes("*")) throw new Error("Invalid acquired fields");
    const row = checked(await this.db.from(table).select(fields.join(",")).eq("id", id).single()) as unknown as Where;
    if (expected && !isDeepStrictEqual(row, expected)) throw new Error(`Fixture prerequisite failed: ${table} acquired fields differ from baseline`);
    this.record(selectorKey(table, { id }), { kind: "restore", table, where: { id }, fields: row });
    return row;
  }

  // Replaces the intent recorded before a write whose response may be lost with the row that write created.
  adopt(table: string, rowId: Value, intent: string) {
    this.record(selectorKey(table, { id: rowId }), { kind: "rows", table, where: { id: rowId } });
    this.forget(intent);
  }

  async authIds(email: string): Promise<string[]> {
    const db = new pg.Client({ connectionString: this.dbUrl, application_name: "devspace-fixtures" });
    try { await db.connect(); return (await db.query("select id from auth.users where email = $1", [email])).rows.map(row => row.id); }
    finally { await db.end(); }
  }

  async reserveAuth(email: string) {
    if (this.closed) throw new Error("Fixture scope no longer admits mutations");
    if (!email.endsWith("@devspace.test") || !email.includes(this.tag)) throw new Error("Auth email must belong to this scope");
    if ((await this.authIds(email)).length) {
      this.run.mark(`residue: Auth user ${email} existed at reservation`);
      throw new Error("Auth fixture prerequisite failed: email already exists");
    }
    this.record(authKey(email), { kind: "auth", table: "auth.users", email });
  }

  /** @internal */
  forget(id: string) {
    const index = this.entries.findIndex(entry => entry.id === id);
    if (index < 0) return;
    const [entry] = this.entries.splice(index, 1);
    const key = entry.kind === "auth" ? authKey(entry.email!) : selectorKey(entry.table, entry.where!);
    held.delete(key);
    acquired.delete(key);
  }

  async cleanup() {
    this.closed = true;
    try { await cleanupEntries(this, this.db, this.dbUrl); }
    catch (error) {
      this.run.mark(`fixture cleanup failed in scope ${this.id}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
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

function assertNoAcquiredFields(table: string, id: Value) {
  // An acquired row of any scope in this process blocks deleting that row.
  if (acquired.has(selectorKey(table, { id }))) throw new Error(`Cleanup blocked: ${table} still has acquired fields`);
}

export async function cleanupEntries(scope: FixtureScope, db: SupabaseClient, dbUrl: string) {
  const entries = [...scope.entries];
  entries.sort((a, b) => (a.kind === "restore" ? -100 : a.kind === "auth" ? 100 : order.indexOf(a.table)) - (b.kind === "restore" ? -100 : b.kind === "auth" ? 100 : order.indexOf(b.table)));
  const failures: unknown[] = [];
  for (const entry of entries) {
    try {
      if (entry.kind === "auth") {
        const client = new pg.Client({ connectionString: dbUrl, application_name: "devspace-fixtures" });
        let ids: string[];
        try { await client.connect(); ids = (await client.query("select id from auth.users where email = $1", [entry.email])).rows.map(row => row.id); }
        finally { await client.end(); }
        if (ids.length > 1) throw new Error("Ambiguous Auth ownership");
        for (const id of ids) {
          assertNoAcquiredFields("profiles", id);
          await assertNoDependents(dbUrl, "public", "profiles", id);
          await assertNoDependents(dbUrl, "auth", "users", id, true);
          await deleteOwnedUser(db, id);
        }
      } else if (entry.kind === "restore") {
        if (!order.includes(entry.table) || !entry.where?.id || !entry.fields) throw new Error("Unrecognized restore ownership");
        checked(await db.from(entry.table).update(entry.fields).match(entry.where));
        const restored = checked(await db.from(entry.table).select(Object.keys(entry.fields).join(",")).match(entry.where).single());
        if (!isDeepStrictEqual(restored, entry.fields)) throw new Error(`Restore verification failed: ${entry.table}`);
      } else {
        if (!order.includes(entry.table) || !Object.keys(entry.where ?? {}).length) throw new Error("Unrecognized row ownership");
        const rows = checked(await db.from(entry.table).select("id").match(entry.where!));
        if (rows.length > 1) throw new Error(`Ambiguous ownership: ${entry.table} selector matched multiple rows`);
        for (const row of rows) {
          assertNoAcquiredFields(entry.table, row.id);
          // Cascades and SET NULL can change a foreign scope even when the parent ID is ours.
          // Own children were removed earlier; any remaining dependent blocks this deletion.
          await assertNoDependents(dbUrl, "public", entry.table, row.id);
          checked(await db.from(entry.table).delete().in("id", [row.id]));
        }
        if (checked(await db.from(entry.table).select("id").match(entry.where!)).length) throw new Error(`Cleanup left owned ${entry.table} rows`);
      }
      scope.forget(entry.id);
    } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "Owned fixture cleanup failed; unresolved entries retained", { cause: failures[0] });
}
