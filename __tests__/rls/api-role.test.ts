// Test plan
// Goal: the API login role `devspace_api` reads exactly profiles.id and profiles.role (regardless of RLS) and can do
//   nothing else; the migration replays after a reset and its rollback restores the earlier state.
// Layer: rls (a real login as the role, and catalog reads on the test stack).
// Subject: migration 20261108143215_devspace_api (TM-U3, ADR 0008 D7) and its rollback.
// Allowed paths: connect with the seed's local password; select id, role from profiles and see every row.
// Denied paths: any other column or table, any write, CREATE TABLE and ALTER TABLE in public.
// Invariants: effective privileges read from the catalog for public, auth and storage; the rollback is replayed
//   inside a transaction that is rolled back, so the committed state never changes. The migration touches no object it
//   does not grant on (API-R9, API-R8) and stops on a privilege or an owned object it does not manage (API-R7, API-R10).
// Known bugs: none.
import { readFile } from "node:fs/promises";
import pg from "pg";
import { describe, expect, inject, it } from "vitest";
import {
  API_ROLE,
  API_ROLE_LOCAL_PASSWORD,
  apiDatabaseUrl,
} from "../helpers/api-role";
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
  // The migration replayed on the committed state inside a transaction that is rolled back. `prepare` runs first in the
  // transaction and each case ends with a rollback, so nothing a case does is kept.
  async function replayUp(
    prepare: (owner: pg.Client) => Promise<void>,
    check: (
      owner: pg.Client,
      error: { message?: string; code?: string } | null,
    ) => Promise<void>,
  ) {
    const up = withoutTransaction(
      await readFile(
        new URL(`../../supabase/migrations/${migration}.sql`, import.meta.url),
        "utf8",
      ),
    );
    await withPg(async (owner) => {
      await owner.query("begin");
      try {
        await prepare(owner);
        await owner.query("savepoint replay");
        const error = await owner.query(up).then(
          () => null,
          (caught: { message?: string; code?: string }) => caught,
        );
        if (error) await owner.query("rollback to savepoint replay");
        await check(owner, error);
      } finally {
        await owner.query("rollback");
      }
    });
  }

  it.each([
    [
      "another column of profiles",
      "grant select (email) on public.profiles to devspace_api",
      "column email of table profiles",
    ],
    [
      "another table",
      "grant select on public.courses to devspace_api",
      "table courses",
    ],
    [
      "a function",
      "grant execute on function public.is_admin() to devspace_api",
      "function is_admin()",
    ],
    [
      "another schema",
      "grant usage on schema api_r7_schema to devspace_api",
      "schema api_r7_schema",
    ],
  ])(
    "[API-R7] stops, naming the object, when an existing role holds a direct privilege on %s",
    async (_label, grant, object) => {
      await replayUp(
        async (owner) => {
          await owner.query("create schema api_r7_schema");
          await owner.query(grant);
        },
        async (_owner, error) => {
          expect(error, "the migration should stop").not.toBeNull();
          expect(error?.code).toBe("P0001");
          expect(error?.message).toContain(object);
          expect(error?.message).not.toContain(API_ROLE_LOCAL_PASSWORD);
        },
      );
    },
  );

  // A table in public that another role owns, as when an extension or a dashboard user created it. The migration's own
  // role is no member of the owner afterwards, so it holds no right on the table.
  async function foreignOwnedTable(owner: pg.Client, grantToApi: boolean) {
    await owner.query("create role api_r8_owner nologin");
    await owner.query("grant create on schema public to api_r8_owner");
    await owner.query("grant api_r8_owner to current_user");
    await owner.query("create table public.api_r8_table (id int)");
    await owner.query("alter table public.api_r8_table owner to api_r8_owner");
    if (grantToApi) {
      await owner.query("set local role api_r8_owner");
      await owner.query("grant select on public.api_r8_table to devspace_api");
      await owner.query("reset role");
    }
    await owner.query("revoke api_r8_owner from current_user");
  }

  it("[API-R8] does not fail on a table another role owns, and gives the role nothing on it", async () => {
    await replayUp(
      (owner) => foreignOwnedTable(owner, false),
      async (owner, error) => {
        expect(error, error?.message).toBeNull();
        expect(
          (
            await owner.query(
              "select has_table_privilege($1, 'public.api_r8_table', 'SELECT,INSERT,UPDATE,DELETE') as any",
              [API_ROLE],
            )
          ).rows[0].any,
        ).toBe(false);
      },
    );
  });

  it("[API-R8] stops, naming the table, when another role granted the API role a privilege that this migration could not revoke", async () => {
    await replayUp(
      (owner) => foreignOwnedTable(owner, true),
      async (_owner, error) => {
        expect(error, "the migration should stop").not.toBeNull();
        expect(error?.code).toBe("P0001");
        expect(error?.message).toContain("table api_r8_table");
      },
    );
  });

  // What the catalogs of a single object kind do not show: a privilege on the database itself, an object the role owns
  // whose ACL is NULL (so there is nothing to list in any ACL column), and a default privilege.
  it.each([
    [
      "a CREATE privilege on the database",
      async (owner: pg.Client) => {
        await owner.query(
          "do $$ begin execute format('grant create on database %I to devspace_api', current_database()); end $$",
        );
      },
      "database postgres",
    ],
    [
      "a table it owns with a NULL ACL",
      async (owner: pg.Client) => {
        await owner.query("grant create on schema public to devspace_api");
        await owner.query("grant devspace_api to current_user");
        await owner.query("create table public.api_r10_owned (id int)");
        await owner.query(
          "alter table public.api_r10_owned owner to devspace_api",
        );
        await owner.query("revoke devspace_api from current_user");
      },
      "table api_r10_owned",
    ],
    [
      "a default privilege",
      async (owner: pg.Client) => {
        await owner.query(
          "alter default privileges in schema public grant select on tables to devspace_api",
        );
      },
      "default",
    ],
  ])(
    "[API-R10] stops when an existing role holds %s",
    async (_label, prepare, object) => {
      await replayUp(prepare, async (_owner, error) => {
        expect(error, "the migration should stop").not.toBeNull();
        expect(error?.code).toBe("P0001");
        expect(error?.message).toContain(object);
      });
    },
  );

  it("[API-R9] a new role changes only the ACL of schema public and of profiles.id and profiles.role", async () => {
    const down = withoutTransaction(
      await readFile(
        new URL(
          `../../supabase/rollbacks/${migration}.down.sql`,
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const up = withoutTransaction(
      await readFile(
        new URL(`../../supabase/migrations/${migration}.sql`, import.meta.url),
        "utf8",
      ),
    );
    const snapshot = async (owner: pg.Client) =>
      new Map(
        (
          await owner.query(
            `select key, acl from (
               select 'class ' || c.relnamespace::regnamespace || '.' || c.relname as key, c.relacl::text as acl from pg_class c
               union all select 'column ' || c2.relnamespace::regnamespace || '.' || c2.relname || '.' || t.attname, t.attacl::text
                 from pg_attribute t join pg_class c2 on c2.oid = t.attrelid where t.attacl is not null
               union all select 'function ' || p.oid, p.proacl::text from pg_proc p
               union all select 'schema ' || n.nspname, n.nspacl::text from pg_namespace n
               union all select 'default ' || d.oid, d.defaclacl::text from pg_default_acl d
               union all select 'database ' || datname, datacl::text from pg_database
             ) s`,
          )
        ).rows.map((row) => [row.key as string, row.acl as string | null]),
      );
    await withPg(async (owner) => {
      await owner.query("begin");
      try {
        // The state the migration starts from on hosted: the role does not exist.
        await owner.query(down);
        const before = await snapshot(owner);
        await owner.query(up);
        const after = await snapshot(owner);
        const changed = [...after.entries()]
          .filter(([key, acl]) => before.get(key) !== acl)
          .map(([key]) => key)
          .sort();
        expect(changed).toEqual([
          "column public.profiles.id",
          "column public.profiles.role",
          "schema public",
        ]);
        expect(
          [...before.keys()].filter((key) => !after.has(key)),
          "no object disappeared",
        ).toEqual([]);
      } finally {
        await owner.query("rollback");
      }
    });
  });
});
