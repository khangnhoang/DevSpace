import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { sharedRunMarker } from "../helpers/fixture-ownership";
import { runContext } from "../../scripts/test-stack/lock.mjs";
import {
  assertLocalCompatDocker,
  GRAPHQL_COMPAT_IMAGE as image,
  GRAPHQL_COMPAT_LABEL as label,
  graphqlCompatJournal,
  inspectGraphqlCompatibility as inspect,
  removeGraphqlCompatibility,
} from "../../scripts/test-stack/graphql-compat.mjs";
import {
  graphCatalogSql,
  graphqlMigration,
  publicQuery,
  verifyGraphTarget,
} from "./graphql-probe";
import { profileCatalogQueries } from "./profile-write-probe";

const m1 = "20261106094309_se_u3_profile_email_integrity";
const m2 = "20261106095706_se_u3_profile_role_constraint";
const m3 = graphqlMigration;
type Journal = { owner: string; name: string; id?: string; image: string };

function docker(args: string[], input?: string, env?: Record<string, string>) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    input,
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
    timeout: args[0] === "run" ? 180_000 : 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
}
export async function proveGraphql11511Compatibility() {
  verifyGraphTarget();
  const marker = sharedRunMarker();
  const runDir = runContext()!.dir;
  assertLocalCompatDocker();
  const evidence = join(process.cwd(), ".supabase-test", "se-u3-evidence");
  mkdirSync(evidence, { recursive: true });
  // A machine-wide journal lets every later test/stop command recover this resource, from any checkout.
  const journalPath = graphqlCompatJournal(runDir);
  const owner = `devspace-se-u3-${randomUUID()}`;
  const record: Journal = { owner, name: `${owner}-db`, image };
  writeFileSync(journalPath, JSON.stringify(record), { flag: "wx" });
  const sql = (
    text: string,
    role: "postgres" | "supabase_admin" = "postgres",
  ) => {
    assert.ok(inspect(record), "compatibility database is missing");
    return docker(
      [
        "exec",
        "-i",
        record.name,
        "psql",
        "-X",
        "-q",
        "-A",
        "-t",
        "-h",
        "/var/run/postgresql",
        "-U",
        role,
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-v",
        "VERBOSITY=verbose",
      ],
      text,
    ).trim();
  };
  const rows = (query: string) =>
    JSON.parse(
      sql(
        `select coalesce(json_agg(row_to_json(q)), '[]'::json) from (${query}) q;`,
      ),
    );
  const graph = () => rows(graphCatalogSql)[0].state;
  const profiles = () =>
    Object.fromEntries(
      Object.entries(profileCatalogQueries).map(([key, query]) => [
        key,
        rows(query),
      ]),
    );
  const history = () =>
    rows(
      "select version,name from supabase_migrations.schema_migrations order by version",
    );
  const apply = (name: string, down = false) => {
    assert.match(name, /^\d{14}_[a-z0-9_]+$/);
    let body = readFileSync(
      join(
        process.cwd(),
        "supabase",
        down ? "rollbacks" : "migrations",
        `${name}${down ? ".down" : ""}.sql`,
      ),
      "utf8",
    );
    const outerBegin = /^(?:\s|--[^\n]*\n)*begin;/i;
    if (outerBegin.test(body)) {
      body = body.replace(outerBegin, (prefix) =>
        prefix.replace(/begin;$/i, ""),
      );
      assert.match(body, /commit;\s*$/i);
      body = body.replace(/commit;\s*$/i, "");
    }
    const version = name.slice(0, 14),
      migrationName = name.slice(15);
    // A fresh owned ledger commits with the file's unchanged statements; no existing history is repaired.
    const ledger = down
      ? `delete from supabase_migrations.schema_migrations where version='${version}';`
      : `insert into supabase_migrations.schema_migrations(version,name) values('${version}','${migrationName}');`;
    sql(`begin;\n${body}\n${ledger}\ncommit;`);
  };
  let originalError: unknown;
  const probePassword = randomBytes(32).toString("base64url");
  const logs = () => {
    const output = spawnSync("docker", ["logs", record.name], {
      encoding: "utf8",
      timeout: 10_000,
    });
    return `${output.stdout ?? ""}\n${output.stderr ?? ""}`.replaceAll(
      probePassword,
      "[probe-secret]",
    );
  };
  try {
    record.id = docker(
      [
        "run",
        "--pull=missing",
        "-d",
        "--name",
        record.name,
        "--label",
        `${label}=${owner}`,
        "--network",
        "none",
        "--tmpfs",
        "/var/lib/postgresql/data",
        "-e",
        "POSTGRES_USER=supabase_admin",
        "-e",
        "POSTGRES_DB=postgres",
        "-e",
        "POSTGRES_PASSWORD",
        "-e",
        "PGPASSWORD",
        "-e",
        "POSTGRES_HOST=/var/run/postgresql",
        "-e",
        "PGHOST=/var/run/postgresql",
        image,
        "postgres",
        "-D",
        "/etc/postgresql",
        "-c",
        "listen_addresses=",
      ],
      undefined,
      { POSTGRES_PASSWORD: probePassword, PGPASSWORD: probePassword },
    ).trim();
    // Preserve the valid pre-creation intent if the process dies while adding the returned container ID.
    writeFileSync(`${journalPath}.next`, JSON.stringify(record));
    renameSync(`${journalPath}.next`, journalPath);
    assert.ok(inspect(record));
    const deadline = Date.now() + 75_000;
    while (true) {
      const item = inspect(record);
      if (!item?.State.Running)
        throw new Error(
          `Compatibility bootstrap stopped: ${logs().slice(-3500)}`,
        );
      if (logs().includes("PostgreSQL init process complete")) {
        try {
          if (
            rows(
              "select count(*)::int as count from pg_event_trigger where evtname in ('issue_pg_graphql_access','issue_graphql_placeholder')",
            )[0].count === 2
          )
            break;
        } catch {
          /* Final postmaster may still be taking over the socket. */
        }
      }
      if (Date.now() >= deadline)
        throw new Error("Compatibility bootstrap readiness timed out");
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.deepEqual(
      rows(
        "select version from pg_available_extension_versions where name='pg_graphql' and version='1.5.11'",
      ),
      [{ version: "1.5.11" }],
    );
    // Only the dependencies of the unchanged public baseline are needed; no Storage API is simulated.
    sql(
      `set role supabase_storage_admin;
      create table storage.buckets(id text primary key,name text,"public" boolean,file_size_limit bigint,allowed_mime_types text[],type text);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,owner uuid);
      grant all on storage.buckets,storage.objects to postgres;
      reset role; set role postgres;
      create schema supabase_migrations;
      create table supabase_migrations.schema_migrations(version text primary key,name text);`,
      "supabase_admin",
    );
    const published = readdirSync(join(process.cwd(), "supabase", "migrations"))
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .map((file) => file.slice(0, -4))
      .filter((name) => name < m1);
    for (const name of published) apply(name);
    sql(`insert into auth.users(id,email,raw_user_meta_data) values
      ('11111111-1111-4111-8111-111111111111','compat-user@devspace.test','{}'),
      ('22222222-2222-4222-8222-222222222222','compat-admin@devspace.test','{}');
      update public.profiles set role='admin' where id='22222222-2222-4222-8222-222222222222';
      insert into public.courses(name,slug) values('Compatibility public course','se-u3-compat-course');`);
    const baseProfiles = profiles(),
      originalGraph = graph(),
      baseHistory = history();
    assert.equal(originalGraph.extension[0].version, "1.5.11");
    assert.equal(originalGraph.extension[0].owner, "supabase_admin");
    const assertQuery = () => {
      for (const [role, id] of [
        ["anon", ""],
        ["authenticated", "11111111-1111-4111-8111-111111111111"],
        ["authenticated", "22222222-2222-4222-8222-222222222222"],
      ]) {
        const response = JSON.parse(
          sql(
            `begin; set local role ${role}; set local request.jwt.claim.sub='${id}'; select graphql_public.graphql(query := '${publicQuery}'); rollback;`,
          ),
        );
        assert.equal(
          response.data?.coursesCollection?.edges?.length,
          1,
          "native positive control must resolve invented course data",
        );
        assert.equal(response.errors, undefined);
      }
    };
    assertQuery();
    apply(m1);
    const afterM1 = profiles();
    apply(m2);
    const afterM2 = profiles();
    apply(m3);
    const disabled = graph();
    assert.deepEqual(disabled.extension, []);
    assert.deepEqual(profiles(), afterM2);
    apply(m3, true);
    assert.deepEqual(
      graph(),
      originalGraph,
      "M3 must restore definitions, ownership, ACLs, members and hooks exactly",
    );
    assertQuery();
    sql(
      "create view public.se_u3_compat_dependency as select graphql.resolve('{ __typename }') as result;",
    );
    assert.throws(() => sql("drop extension pg_graphql;"), /2BP01/);
    assert.throws(
      () => apply(m3),
      /SE-U3 GraphQL has external database dependents/,
    );
    assert.deepEqual(graph(), originalGraph);
    const entry = (name: string) => ({
      version: name.slice(0, 14),
      name: name.slice(15),
    });
    assert.deepEqual(history(), [...baseHistory, entry(m1), entry(m2)]);
    sql("drop view public.se_u3_compat_dependency;");
    apply(m3);
    assert.deepEqual(graph(), disabled);
    const finalHistory = history();
    apply(m3, true);
    assert.deepEqual(graph(), originalGraph);
    apply(m2, true);
    assert.deepEqual(profiles(), afterM1);
    apply(m1, true);
    assert.deepEqual(profiles(), baseProfiles);
    assert.deepEqual(history(), baseHistory);
    apply(m1);
    sql(
      "update public.profiles set role='invalid-existing' where id='11111111-1111-4111-8111-111111111111';",
    );
    assert.throws(() => apply(m2), /SE-U3 invalid existing profile roles/);
    assert.deepEqual(profiles(), afterM1);
    assert.deepEqual(graph(), originalGraph);
    assert.deepEqual(history(), [...baseHistory, entry(m1)]);
    assert.deepEqual(
      rows(
        "select role from public.profiles where id='11111111-1111-4111-8111-111111111111'",
      ),
      [{ role: "invalid-existing" }],
    );
    sql(
      "update public.profiles set role='user' where id='11111111-1111-4111-8111-111111111111';",
    );
    apply(m2);
    apply(m3);
    assert.deepEqual(profiles(), afterM2);
    assert.deepEqual(graph(), disabled);
    assert.deepEqual(history(), finalHistory);
    writeFileSync(
      join(evidence, "compat-1.5.11-result.json"),
      JSON.stringify(
        {
          image,
          version: "1.5.11",
          individualRollback: true,
          combinedReverseReapply: true,
          dependencyRefusal: true,
          partialApplyPrefix: [m1],
          finalHistory,
          cleanup: "pending",
        },
        null,
        2,
      ),
    );
  } catch (error) {
    originalError = error;
  } finally {
    try {
      removeGraphqlCompatibility(record, runDir);
    } catch (cleanup) {
      marker.mark(
        "SE-U3 compatibility cleanup failed; retain its exact ownership journal",
      );
      throw new AggregateError(
        [originalError, cleanup].filter(Boolean),
        "Compatibility database cleanup failed",
      );
    }
  }
  if (originalError) throw originalError;
  const resultPath = join(evidence, "compat-1.5.11-result.json");
  const result = JSON.parse(readFileSync(resultPath, "utf8"));
  result.cleanup = "verified absent; no ports, network or host mounts";
  writeFileSync(resultPath, JSON.stringify(result, null, 2));
}
