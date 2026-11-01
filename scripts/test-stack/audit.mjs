// The end-of-run audit. Right after each reset the launcher saves a snapshot of the test database: the row
// count and a content hash of every table in `public`, `auth.users` and `storage.objects`. At the start of a
// clean run, and at the end of every run once all writers have exited, the database is compared with that
// snapshot, so a write that no fixture scope reserved (a late write after cleanup, a stray writer) is reported
// instead of staying unnoticed (D7).
import pg from "pg";

// Columns tests change legitimately and that no fixture restores. Each has its reason; a column is added here
// only with one.
export const EXCLUDED_COLUMNS = {
  // Signing in (the rls global setup, the e2e setup project) records the time on the user and refreshes it.
  "auth.users": ["last_sign_in_at", "updated_at"],
  // Storage reads stamp the object when it is fetched.
  "storage.objects": ["last_accessed_at"],
};

export async function takeSnapshot(dbUrl) {
  const client = new pg.Client({ connectionString: dbUrl, application_name: "devspace-test-audit" });
  await client.connect();
  try {
    const { rows } = await client.query(`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`);
    const names = [...rows.map((row) => `public.${row.table_name}`), "auth.users", "storage.objects"];
    const tables = {};
    for (const name of names) {
      const [schema, table] = name.split(".");
      const quoted = `"${schema}"."${table.replaceAll('"', '""')}"`;
      // The hash is over the row as JSON minus the excluded columns, sorted, so it does not depend on row order.
      const result = await client.query(
        `select count(*)::int as count, coalesce(md5(string_agg(h, '' order by h)), '') as hash
         from (select md5((to_jsonb(t) - $1::text[])::text) as h from ${quoted} t) s`,
        [EXCLUDED_COLUMNS[name] ?? []],
      );
      tables[name] = result.rows[0];
    }
    return { tables };
  } finally {
    await client.end();
  }
}

// One line per table that differs; empty when the database equals the snapshot.
export function compareSnapshots(saved, current) {
  if (!saved?.tables) return ["no snapshot is recorded for the last reset"];
  const differences = [];
  for (const name of new Set([...Object.keys(saved.tables), ...Object.keys(current.tables)])) {
    const before = saved.tables[name];
    const after = current.tables[name];
    if (!before) differences.push(`${name}: table appeared`);
    else if (!after) differences.push(`${name}: table disappeared`);
    else if (before.count !== after.count) differences.push(`${name}: ${before.count} rows at the last reset, ${after.count} now`);
    else if (before.hash !== after.hash) differences.push(`${name}: same ${after.count} rows, content changed`);
  }
  return differences;
}
