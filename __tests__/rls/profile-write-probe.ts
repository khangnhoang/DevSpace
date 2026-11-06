import { readFile } from "node:fs/promises";
import type pg from "pg";
import { expect, inject } from "vitest";
import { requireActiveRun } from "../../scripts/test-stack/lock.mjs";
import { readTestStack } from "../../scripts/test-stack/read.mjs";
import { sharedRunMarker } from "../helpers/fixture-ownership";
import { fixtureScope, IDS, withPg } from "./helpers";

const migration = "20261106094309_se_u3_profile_email_integrity";

async function profileCatalog(client: pg.Client) {
  const queries = {
    relations: `select c.relname, pg_get_userbyid(c.relowner) as owner, c.relrowsecurity, c.relforcerowsecurity,
      (select array_agg(a::text order by a::text) from unnest(c.relacl) a) as acl
      from pg_class c where c.oid in ('public.profiles'::regclass, 'public.profile_cards'::regclass) order by c.relname`,
    columns: `select attname, attnotnull, attacl::text, pg_get_expr(d.adbin, d.adrelid) as default_value
      from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attrelid = 'public.profiles'::regclass and a.attnum > 0 and not a.attisdropped order by attname`,
    constraints: `select conname, convalidated, pg_get_constraintdef(oid) as definition
      from pg_constraint where conrelid = 'public.profiles'::regclass order by conname`,
    policies: `select policyname, permissive, roles, cmd, qual, with_check from pg_policies
      where schemaname = 'public' and tablename = 'profiles' order by policyname`,
    triggers: `select tgname, tgenabled, pg_get_triggerdef(oid) as definition from pg_trigger
      where tgrelid in ('public.profiles'::regclass, 'auth.users'::regclass) and not tgisinternal order by tgname`,
    functions: `select p.proname, pg_get_userbyid(p.proowner) as owner, p.prosecdef, p.proconfig,
      (select array_agg(a::text order by a::text) from unnest(p.proacl) a) as acl, pg_get_functiondef(p.oid) as definition
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
      and p.proname in ('handle_new_user', 'is_admin', 'prevent_role_escalation', 'prevent_profile_client_reassignment') order by p.proname`,
    card: `select pg_get_viewdef('public.profile_cards'::regclass, true) as definition`,
  };
  const result: Record<string, unknown[]> = {};
  for (const [name, sql] of Object.entries(queries))
    result[name] = (await client.query(sql)).rows;
  return result;
}

async function clientEmailProbe(client: pg.Client, denied: boolean) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: IDS.learner, role: "authenticated" }),
    ]);
    if (denied) {
      await expect(
        client.query(
          "update public.profiles set email = 'rollback-probe@devspace.test' where id = $1",
          [IDS.learner],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    } else {
      const result = await client.query(
        "update public.profiles set email = 'rollback-probe@devspace.test' where id = $1 returning email",
        [IDS.learner],
      );
      expect(result.rows).toEqual([{ email: "rollback-probe@devspace.test" }]);
    }
  } finally {
    // This probe owns no durable data: even a failed assertion rolls back its write and role settings.
    await client.query("rollback");
  }
}

export async function proveProfileEmailRollback() {
  requireActiveRun({ command: "npm test" });
  const verified = readTestStack(process.cwd());
  const injected = inject("localStack");
  if (verified.dbUrl !== injected.dbUrl || verified.apiUrl !== injected.apiUrl)
    throw new Error(
      "Migration probe target differs from the runner's verified test stack",
    );
  const up = await readFile(
    new URL(`../../supabase/migrations/${migration}.sql`, import.meta.url),
    "utf8",
  );
  const down = await readFile(
    new URL(`../../supabase/rollbacks/${migration}.down.sql`, import.meta.url),
    "utf8",
  );
  const marker = sharedRunMarker();
  await fixtureScope().acquire("profiles", IDS.learner, ["email"], {
    email: "learner@devspace.test",
  });

  await withPg(async (client) => {
    expect(
      (
        await client.query(
          "select current_database() as db, current_user as role",
        )
      ).rows,
    ).toEqual([{ db: "postgres", role: "postgres" }]);
    const forward = await profileCatalog(client);
    expect(
      (
        await client.query(`select p.prosecdef, p.proconfig,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
      from pg_proc p where p.oid = to_regprocedure('public.prevent_profile_client_reassignment()')`)
      ).rows,
    ).toEqual([
      {
        prosecdef: false,
        proconfig: ['search_path=""'],
        anon_execute: false,
        authenticated_execute: false,
      },
    ]);
    let originalError: unknown;
    try {
      await clientEmailProbe(client, true);
      // Treat an ambiguous DDL response as requiring settlement too. The exact files run with their own transactions.
      await client.query(down);
      const previous = await profileCatalog(client);
      expect(
        (
          await client.query(`select has_table_privilege('anon', 'public.profiles', 'INSERT') as anon,
        has_table_privilege('authenticated', 'public.profiles', 'INSERT') as authenticated,
        to_regprocedure('public.prevent_profile_client_reassignment()')::text as guard`)
        ).rows,
      ).toEqual([{ anon: true, authenticated: true, guard: null }]);
      const withoutGuard = (forward.functions as { proname: string }[]).filter(
        (fn) => fn.proname !== "prevent_profile_client_reassignment",
      );
      const withoutTrigger = (forward.triggers as { tgname: string }[]).filter(
        (trigger) => trigger.tgname !== "profiles_prevent_client_reassignment",
      );
      expect(previous).toEqual({
        ...forward,
        functions: withoutGuard,
        triggers: withoutTrigger,
        relations: (forward.relations as { relname: string }[]).map(
          (relation) =>
            relation.relname === "profiles"
              ? {
                  ...relation,
                  acl: [
                    "anon=arwdDxtm/postgres",
                    "authenticated=arwdDxtm/postgres",
                    "postgres=arwdDxtm/postgres",
                    "service_role=arwdDxtm/postgres",
                  ],
                }
              : relation,
        ),
      });
      await clientEmailProbe(client, false);
      await client.query(up);
      expect(await profileCatalog(client)).toEqual(forward);
      await client.query(down);
      expect(await profileCatalog(client)).toEqual(previous);
    } catch (error) {
      originalError = error;
    } finally {
      try {
        await client.query("rollback");
        // Determine the committed state rather than blindly reapply after an ambiguous response.
        const guard = (
          await client.query(
            "select to_regprocedure('public.prevent_profile_client_reassignment()') is not null as present",
          )
        ).rows[0].present;
        if (!guard) await client.query(up);
        expect(await profileCatalog(client)).toEqual(forward);
        await clientEmailProbe(client, true);
      } catch (restoration) {
        marker.mark(
          "SE-U3 M1 rollback probe could not restore/verify the forward catalog",
        );
        throw new AggregateError(
          [originalError, restoration].filter(Boolean),
          "M1 rollback probe restoration failed",
        );
      }
    }
    if (originalError) throw originalError;
  });
}
