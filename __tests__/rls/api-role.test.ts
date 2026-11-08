// Test plan
// Goal: the API login role `devspace_api` reads exactly profiles.id and profiles.role (regardless of RLS) and can do
//   nothing else; the migration replays after a reset and its rollback restores the earlier state.
// Layer: rls (a real login as the role, and catalog reads on the test stack).
// Subject: migration 20261108143215_devspace_api (TM-U3, ADR 0008 D7) and its rollback.
// Allowed paths: connect with the seed's local password; select id, role from profiles and see every row.
// Denied paths: any other column or table, any write, CREATE TABLE and ALTER TABLE in public.
// Invariants: effective privileges read from the catalog for public, auth and storage; the rollback is replayed
//   inside a transaction that is rolled back, so the committed state never changes.
// Known bugs: none.
import { readFile } from "node:fs/promises";
import pg from "pg";
import { describe, expect, inject, it } from "vitest";
import { API_ROLE, apiDatabaseUrl } from "../helpers/api-role";
import { withPg } from "./helpers";

const stack = inject("localStack");
const migration = "20261108143215_devspace_api";

// Functions of public, auth and storage that devspace_api can execute through PUBLIC, recorded on the local stack
// (CLI 2.121.0 images). A difference is a change of effective privilege: read it before editing this list.
const EXECUTABLE_THROUGH_PUBLIC = [
  "auth.email()",
  "auth.jwt()",
  "auth.role()",
  "auth.uid()",
  "public.is_admin()",
  "public.prevent_role_escalation()",
  "public.update_updated_at_column()",
  "storage.allow_any_operation(expected_operations text[])",
  "storage.allow_only_operation(expected_operation text)",
  "storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb)",
  "storage.enforce_bucket_lifecycle_service_role()",
  "storage.enforce_bucket_name_length()",
  "storage.enforce_versioning_status_transition()",
  "storage.extension(name text)",
  "storage.filename(name text)",
  "storage.foldername(name text)",
  "storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text)",
  "storage.get_size_by_bucket(noncurrent_versions text, delete_markers text)",
  "storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, next_key_token text, next_upload_token text, raw_prefix_param text)",
  "storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer, start_after text, next_token text, sort_order text, noncurrent_versions text, delete_markers text, next_token_archived_at timestamp with time zone, next_token_version text)",
  "storage.operation()",
  "storage.protect_bucket_control_columns()",
  "storage.protect_delete()",
  "storage.search(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text, noncurrent_versions text, delete_markers text)",
  "storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text, noncurrent_versions text, delete_markers text, p_start_after_version text)",
  "storage.search_v2(prefix text, bucket_name text, limits integer, levels integer, start_after text, sort_order text, sort_column text, sort_column_after text, noncurrent_versions text, delete_markers text, start_after_archived_at timestamp with time zone, start_after_version text, start_after_is_continuation boolean)",
  "storage.update_updated_at_column()",
];

const PAYMENT_FUNCTIONS = [
  "create_pending_payment",
  "apply_payment_coupon",
  "close_pending_payment",
  "approve_payment",
];

async function asApi<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({
    connectionString: apiDatabaseUrl(stack.dbUrl),
  });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

async function refused(client: pg.Client, sql: string) {
  const error = await client.query(sql).then(
    () => null,
    (caught: { code?: string; message?: string }) => caught,
  );
  expect(error, `${sql} should be refused`).not.toBeNull();
  expect(error?.code, `${sql}: ${error?.message}`).toBe("42501");
}

function withoutTransaction(sql: string) {
  return sql.replace(/^begin;\s*$/m, "").replace(/^commit;\s*$/m, "");
}

describe("devspace_api role", () => {
  it("[API-R1] has the reviewed attributes, no membership, and can log in with the local seed password", async () => {
    await withPg(async (owner) => {
      const attributes = await owner.query(
        `select rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication
         from pg_roles where rolname = $1`,
        [API_ROLE],
      );
      expect(attributes.rows).toEqual([
        {
          rolcanlogin: true,
          rolsuper: false,
          rolbypassrls: true,
          rolcreaterole: false,
          rolcreatedb: false,
          rolreplication: false,
        },
      ]);
      const memberships = await owner.query(
        "select count(*)::int as n from pg_auth_members where member = $1::regrole",
        [API_ROLE],
      );
      expect(memberships.rows[0].n).toBe(0);
    });
    await asApi(async (client) => {
      expect(
        (await client.query("select current_user as name")).rows[0].name,
      ).toBe(API_ROLE);
    });
  });

  it("[API-R2] reads profiles.id and profiles.role of every row regardless of RLS", async () => {
    const hiddenFromRlsRoles = await withPg(async (owner) => {
      await owner.query("begin");
      try {
        // authenticated without claims is the control: RLS hides every profile from a role that does not bypass it.
        await owner.query("set local role authenticated");
        return (
          await owner.query("select count(*)::int as n from public.profiles")
        ).rows[0].n as number;
      } finally {
        await owner.query("rollback");
      }
    });
    const total = await withPg(
      async (owner) =>
        (await owner.query("select count(*)::int as n from public.profiles"))
          .rows[0].n as number,
    );
    expect(
      total,
      "the seed holds profiles, so an empty answer cannot pass",
    ).toBeGreaterThanOrEqual(3);
    expect(
      hiddenFromRlsRoles,
      "RLS should hide the profiles from a non-bypass role",
    ).toBe(0);

    await asApi(async (client) => {
      const rows = (await client.query("select id, role from public.profiles"))
        .rows;
      expect(rows).toHaveLength(total);
      expect(
        rows.every(
          (row) =>
            typeof row.id === "string" && ["user", "admin"].includes(row.role),
        ),
      ).toBe(true);
    });
  });

  it("[API-R3] is refused on another column, other tables, every write and DDL in public", async () => {
    await asApi(async (client) => {
      await refused(client, "select email from public.profiles");
      await refused(client, "select * from public.profiles");
      await refused(client, "select id from public.courses");
      await refused(client, "select id from public.payments");
      await refused(client, "select id from auth.users");
      await refused(client, "select id from storage.objects");
      await refused(client, "update public.profiles set role = 'admin'");
      await refused(
        client,
        "insert into public.profiles (id) values (gen_random_uuid())",
      );
      await refused(client, "delete from public.profiles");
      await refused(client, "truncate public.profiles");
      await refused(client, "create table public.devspace_api_probe (id int)");
      await refused(
        client,
        "alter table public.profiles add column devspace_api_probe int",
      );
      await refused(
        client,
        "create function public.devspace_api_probe() returns int language sql as 'select 1'",
      );
    });
  });

  it("[API-R4] holds no other privilege in the catalog: columns, tables, sequences, schemas, database, payment functions", async () => {
    await withPg(async (owner) => {
      const columns = await owner.query(
        `select n.nspname || '.' || c.relname || '.' || a.attname as column
         from pg_attribute a
         join pg_class c on c.oid = a.attrelid
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname in ('public', 'auth', 'storage') and c.relkind in ('r', 'v', 'm', 'p', 'f')
           and a.attnum > 0 and not a.attisdropped
           and (has_column_privilege($1, c.oid, a.attnum, 'SELECT')
             or has_column_privilege($1, c.oid, a.attnum, 'INSERT')
             or has_column_privilege($1, c.oid, a.attnum, 'UPDATE')
             or has_column_privilege($1, c.oid, a.attnum, 'REFERENCES'))
         order by 1`,
        [API_ROLE],
      );
      expect(columns.rows.map((row) => row.column)).toEqual([
        "public.profiles.id",
        "public.profiles.role",
      ]);

      const tables = await owner.query(
        `select n.nspname || '.' || c.relname as relation
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname in ('public', 'auth', 'storage') and c.relkind in ('r', 'v', 'm', 'p', 'f')
           and has_table_privilege($1, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')`,
        [API_ROLE],
      );
      expect(
        tables.rows,
        "a table-level privilege would exceed the column grant",
      ).toEqual([]);

      const sequences = await owner.query(
        `select n.nspname || '.' || c.relname as relation
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname in ('public', 'auth', 'storage')
           and case when c.relkind = 'S'
                    then has_sequence_privilege($1, c.oid, 'USAGE,SELECT,UPDATE')
                    else false end`,
        [API_ROLE],
      );
      expect(sequences.rows).toEqual([]);

      const schemas = await owner.query(
        `select s.nspname, has_schema_privilege($1, s.oid, 'CREATE') as can_create,
                has_schema_privilege($1, s.oid, 'USAGE') as can_use
         from pg_namespace s where s.nspname in ('public', 'auth', 'storage') order by 1`,
        [API_ROLE],
      );
      expect(schemas.rows.map((row) => row.can_create)).toEqual([
        false,
        false,
        false,
      ]);
      expect(
        schemas.rows.find((row) => row.nspname === "public")?.can_use,
      ).toBe(true);
      // TEMP through PUBLIC is unchanged and is not DDL on a schema of the application.
      expect(
        (
          await owner.query(
            "select has_database_privilege($1, current_database(), 'CREATE') as can_create",
            [API_ROLE],
          )
        ).rows[0].can_create,
      ).toBe(false);

      const functions = await owner.query(
        `select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as signature
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('public', 'auth', 'storage') and has_function_privilege($1, p.oid, 'EXECUTE')
         order by 1`,
        [API_ROLE],
      );
      const signatures = functions.rows.map((row) => row.signature as string);
      expect(signatures).toEqual(EXECUTABLE_THROUGH_PUBLIC);
      for (const name of PAYMENT_FUNCTIONS) {
        expect(
          signatures.some((signature) => signature.includes(`.${name}(`)),
        ).toBe(false);
      }
    });
  });

  it("[API-R5] the rollback removes the role and its grants, replayed in a transaction that is rolled back", async () => {
    const down = await readFile(
      new URL(
        `../../supabase/rollbacks/${migration}.down.sql`,
        import.meta.url,
      ),
      "utf8",
    );
    const body = withoutTransaction(down);
    expect(
      body,
      "the rollback should be wrapped in begin and commit",
    ).not.toEqual(down);
    await withPg(async (owner) => {
      await owner.query("begin");
      try {
        await owner.query(body);
        expect(
          (
            await owner.query(
              "select count(*)::int as n from pg_roles where rolname = $1",
              [API_ROLE],
            )
          ).rows[0].n,
        ).toBe(0);
      } finally {
        await owner.query("rollback");
      }
      expect(
        (
          await owner.query(
            "select count(*)::int as n from pg_roles where rolname = $1",
            [API_ROLE],
          )
        ).rows[0].n,
      ).toBe(1);
    });
  });

  it("[API-R6] the migration pins the attributes again on a role that already exists, and the rollback state returns", async () => {
    const up = await readFile(
      new URL(`../../supabase/migrations/${migration}.sql`, import.meta.url),
      "utf8",
    );
    const body = withoutTransaction(up);
    expect(body).not.toEqual(up);
    await withPg(async (owner) => {
      await owner.query("begin");
      try {
        await owner.query(body);
        const after = await owner.query(
          "select rolcanlogin, rolbypassrls from pg_roles where rolname = $1",
          [API_ROLE],
        );
        // The migration pins NOLOGIN again; the committed state (LOGIN from the seed) is back after the rollback below.
        expect(after.rows).toEqual([
          { rolcanlogin: false, rolbypassrls: true },
        ]);
      } finally {
        await owner.query("rollback");
      }
      expect(
        (
          await owner.query(
            "select rolcanlogin from pg_roles where rolname = $1",
            [API_ROLE],
          )
        ).rows[0].rolcanlogin,
      ).toBe(true);
    });
  });
});
