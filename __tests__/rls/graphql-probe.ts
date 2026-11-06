import { readFile } from "node:fs/promises";
import type pg from "pg";
import { expect, inject } from "vitest";
import { requireActiveRun } from "../../scripts/test-stack/lock.mjs";
import { readTestStack } from "../../scripts/test-stack/read.mjs";
import { sharedRunMarker } from "../helpers/fixture-ownership";
import { assertLocalUrl } from "../helpers/local-stack";
import { profileCatalog } from "./profile-write-probe";
import { fixtures, IDS, must, withPg } from "./helpers";

export const graphqlMigration = "20261106100209_se_u3_disable_unused_graphql";
export const publicQuery =
  "{ coursesCollection(first: 1) { edges { node { id name } } } }";
export const graphCatalogSql = `select jsonb_build_object(
  'extension',(select coalesce(jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'owner',pg_get_userbyid(e.extowner),'schema',n.nspname)), '[]') from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_graphql'),
  'schemas',(select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',(select array_agg(a::text order by a::text) from unnest(nspacl) a)) order by nspname) from pg_namespace where nspname in('graphql','graphql_public')),
  'members',(select coalesce(jsonb_agg(pg_describe_object(d.classid,d.objid,d.objsubid) order by pg_describe_object(d.classid,d.objid,d.objsubid)), '[]') from pg_depend d join pg_extension e on d.refclassid='pg_extension'::regclass and d.refobjid=e.oid where e.extname='pg_graphql' and d.deptype='e'),
  'functions',(select jsonb_agg(jsonb_build_object('identity',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'acl',(select array_agg(a::text order by a::text) from unnest(p.proacl) a),'definition',pg_get_functiondef(p.oid)) order by n.nspname,p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('graphql','graphql_public') or (n.nspname='extensions' and p.proname in('grant_pg_graphql_access','set_graphql_placeholder'))),
  'sequences',(select coalesce(jsonb_agg(jsonb_build_object('identity',c.oid::regclass::text,'owner',pg_get_userbyid(c.relowner),'acl',(select array_agg(a::text order by a::text) from unnest(c.relacl) a)) order by c.relname), '[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='graphql' and c.relkind='S'),
  'hooks',(select jsonb_agg(jsonb_build_object('name',evtname,'owner',pg_get_userbyid(evtowner),'event',evtevent,'enabled',evtenabled,'function',evtfoid::regprocedure::text,'tags',evttags) order by evtname) from pg_event_trigger where evtname like '%graphql%')
) as state`;

export function verifyGraphTarget() {
  requireActiveRun({ command: "npm test" });
  const actual = readTestStack(process.cwd());
  const stack = inject("localStack");
  if (actual.dbUrl !== stack.dbUrl || actual.apiUrl !== stack.apiUrl)
    throw new Error(
      "GraphQL probe differs from the verified managed test stack",
    );
  return stack;
}

export async function graphRequest(
  actor: "anon" | "learner" | "admin",
  path: "/graphql/v1" | "/rest/v1/rpc/graphql",
  query: string,
) {
  const stack = inject("localStack");
  assertLocalUrl("GraphQL API", stack.apiUrl, ["http:", "https:"]);
  const response = await fetch(`${stack.apiUrl}${path}`, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    headers: {
      apikey: stack.anonKey,
      Authorization: `Bearer ${actor === "anon" ? stack.anonKey : stack.tokens[actor]}`,
      "Content-Type": "application/json",
      ...(path.startsWith("/rest/")
        ? { "Content-Profile": "graphql_public" }
        : {}),
    },
    body: JSON.stringify({ query }),
  });
  return { status: response.status, body: await response.json() };
}

export async function expectGraphDisabled(actor: "anon" | "learner" | "admin") {
  const before = must(
    await fixtures.from("profiles").select("*").eq("id", IDS.learner).single(),
  );
  for (const path of ["/graphql/v1", "/rest/v1/rpc/graphql"] as const) {
    for (const query of [
      publicQuery,
      'mutation { updateprofilesCollection(set: {full_name: "must not persist"}, filter: {id: {eq: "11111111-1111-4111-8111-111111111111"}}) { affectedCount } }',
    ]) {
      const result = await graphRequest(actor, path, query);
      expect(result.status).toBe(200);
      expect(result.body.data ?? null).toBeNull();
      expect(result.body.errors).toEqual([
        { message: "pg_graphql extension is not enabled." },
      ]);
      expect(
        must(
          await fixtures
            .from("profiles")
            .select("*")
            .eq("id", IDS.learner)
            .single(),
        ),
      ).toEqual(before);
    }
  }
}

async function actorResolverAbsent(client: pg.Client, id?: string) {
  await client.query("begin");
  try {
    await client.query(`set local role ${id ? "authenticated" : "anon"}`);
    if (id)
      await client.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: id, role: "authenticated" }),
      ]);
    await expect(
      client.query("select graphql.resolve($1)", [publicQuery]),
    ).rejects.toMatchObject({ code: "42883" });
  } finally {
    await client.query("rollback");
  }
}

export async function proveManagedGraphqlControl() {
  verifyGraphTarget();
  const up = await readFile(
    new URL(
      `../../supabase/migrations/${graphqlMigration}.sql`,
      import.meta.url,
    ),
    "utf8",
  );
  const marker = sharedRunMarker();
  await withPg(async (client) => {
    const forward = (await client.query(graphCatalogSql)).rows[0].state;
    const profiles = await profileCatalog(client);
    expect(forward.extension).toEqual([]);
    for (const id of [
      undefined,
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ])
      await actorResolverAbsent(client, id);
    let originalError: unknown;
    expect(
      (
        await client.query(
          "select to_regclass('public.se_u3_graphql_dependency') as object",
        )
      ).rows[0].object,
    ).toBeNull();
    try {
      // Version-native control only. The published 1.5.11 rollback is proven in the D8 container.
      await client.query(
        "create extension pg_graphql with schema graphql version '1.6.2'",
      );
      const enabled = (await client.query(graphCatalogSql)).rows[0].state;
      expect(enabled.extension).toMatchObject([
        { version: "1.6.2", owner: "supabase_admin", schema: "graphql" },
      ]);
      for (const actor of ["anon", "learner", "admin"] as const) {
        for (const path of ["/graphql/v1", "/rest/v1/rpc/graphql"] as const) {
          await expect
            .poll(
              async () =>
                (await graphRequest(actor, path, publicQuery)).body.data
                  ?.coursesCollection?.edges?.length,
            )
            .toBe(1);
        }
      }
      await client.query("begin");
      try {
        await client.query(
          "create view public.se_u3_graphql_dependency as select graphql.resolve('{ __typename }') as result",
        );
        await expect(
          client.query("drop extension pg_graphql"),
        ).rejects.toMatchObject({ code: "2BP01" });
      } finally {
        await client.query("rollback");
      }
      expect((await client.query(graphCatalogSql)).rows[0].state).toEqual(
        enabled,
      );
      await client.query(
        "create view public.se_u3_graphql_dependency as select graphql.resolve('{ __typename }') as result",
      );
      await expect(client.query(up)).rejects.toMatchObject({
        code: "P0001",
        message:
          "SE-U3 GraphQL has external database dependents; stop for Owner review",
      });
      await client.query("rollback");
      expect((await client.query(graphCatalogSql)).rows[0].state).toEqual(
        enabled,
      );
      await client.query("drop view public.se_u3_graphql_dependency");
      await client.query(up);
      expect((await client.query(graphCatalogSql)).rows[0].state).toEqual(
        forward,
      );
      expect(await profileCatalog(client)).toEqual(profiles);
      for (const actor of ["anon", "learner", "admin"] as const)
        await expectGraphDisabled(actor);
    } catch (error) {
      originalError = error;
    } finally {
      try {
        await client.query("rollback");
        await client.query(
          "drop view if exists public.se_u3_graphql_dependency",
        );
        const present = (
          await client.query(
            "select exists(select 1 from pg_extension where extname='pg_graphql') as present",
          )
        ).rows[0].present;
        if (present) await client.query(up);
        expect((await client.query(graphCatalogSql)).rows[0].state).toEqual(
          forward,
        );
        expect(await profileCatalog(client)).toEqual(profiles);
      } catch (restoration) {
        marker.mark(
          "SE-U3 GraphQL control did not restore the managed forward catalog",
        );
        throw new AggregateError(
          [originalError, restoration].filter(Boolean),
          "GraphQL control restoration failed",
        );
      }
    }
    if (originalError) throw originalError;
  });
}
