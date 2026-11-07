// `npm run backup:check -- <backup folder>` (TM-U1): restores a backup of the hosted database into a scratch local
// stack and compares it with what hosted held when it was taken. `npm run backup:check -- --teardown` removes what
// an interrupted run left behind. It never runs a hosted command: the only Supabase CLI calls are `start`, against
// the generated scratch workdir, and the Docker calls below, all on project `devspace-backup-check`.
//
// Output discipline (AC8): table names, counts, totals, pass/fail and, for a failed step, its name, exit code and
// SQLSTATE. Child output is captured in memory, reduced and dropped. Object names go only to a file in the backup
// folder.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertLocalEngine, createDocker } from "../test-stack/docker.mjs";
import { isLive, processStart } from "../test-stack/lock.mjs";
import {
  EXCLUDED_SERVICES,
  SCRATCH_NETWORK,
  SCRATCH_PORTS,
  SCRATCH_PROJECT_ID,
  prepareScratchWorkdir,
  runRecordPath,
  scratchWorkdir,
} from "./config.mjs";
import {
  STORAGE_DIR,
  compareDumpToRestore,
  compareHostedCounts,
  compareMigrations,
  compareStorage,
  createCopyScanner,
  foreignPortHolders,
  formatReport,
  isLoopbackOnly,
  loopbackRunArgs,
  mismatchLines,
  missingRequiredFiles,
  reduceFailure,
  refuseBackupPath,
  validateHosted,
  validateManifest,
  versionMismatches,
} from "./core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const DB_CONTAINER = `supabase_db_${SCRATCH_PROJECT_ID}`;
const SCRATCH_PORT_LIST = Object.values(SCRATCH_PORTS);
// Local scratch credentials of the CLI image; they protect nothing (the port is loopback-only and the data is a copy).
const DB_USER = "supabase_admin";
const LOG_SETTINGS = [
  ["log_min_messages", "panic"],
  ["log_min_error_statement", "panic"],
  ["log_statement", "none"],
];

export class Refusal extends Error {}

const say = (line) => console.log(`backup:check: ${line}`);

// ---------- Docker ----------

function docker(args, { input } = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0)
    throw new Error(
      `docker ${args[0]} failed (exit ${result.status ?? "none"})`,
    );
  return result.stdout;
}

const projectContainers = (engine) =>
  engine
    .containers()
    .filter(
      (container) =>
        container.project === SCRATCH_PROJECT_ID ||
        container.name.endsWith(`_${SCRATCH_PROJECT_ID}`),
    );

const projectVolumes = () =>
  docker(["volume", "ls", "--format", "{{.Name}}"])
    .split(/\r?\n/)
    .filter((name) => name.endsWith(`_${SCRATCH_PROJECT_ID}`));

const networkExists = () =>
  docker(["network", "ls", "--format", "{{.Name}}"])
    .split(/\r?\n/)
    .includes(SCRATCH_NETWORK);

/** Removes every container, volume and network of the scratch project and confirms none remains (AC9, G9). */
export function teardown(engine) {
  assertLocalEngine(engine);
  const removed = { containers: 0, volumes: 0 };
  for (const container of projectContainers(engine)) {
    if (container.project !== SCRATCH_PROJECT_ID)
      throw new Error(
        `Container ${container.name} is named like a scratch container but belongs to another project; nothing was removed.`,
      );
    docker(["rm", "-f", "-v", container.name]);
    removed.containers++;
  }
  for (const name of projectVolumes()) {
    docker(["volume", "rm", "-f", name]);
    removed.volumes++;
  }
  if (networkExists()) docker(["network", "rm", SCRATCH_NETWORK]);
  const left = [
    ...projectContainers(engine).map((c) => `container ${c.name}`),
    ...projectVolumes().map((name) => `volume ${name}`),
    ...(networkExists() ? [`network ${SCRATCH_NETWORK}`] : []),
  ];
  if (left.length)
    throw new Error(
      `Teardown is not confirmed; still present: ${left.join(", ")}.`,
    );
  return removed;
}

// ---------- run record (G9) ----------

export function readRecord(rootDir = root) {
  try {
    return JSON.parse(readFileSync(runRecordPath(rootDir), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    // An unreadable record is never treated as free.
    return { unreadable: true };
  }
}

function writeRecord(rootDir = root) {
  mkdirSync(scratchWorkdir(rootDir), { recursive: true });
  writeFileSync(
    runRecordPath(rootDir),
    JSON.stringify({
      pid: process.pid,
      start: processStart(process.pid),
      project: SCRATCH_PROJECT_ID,
    }),
  );
}

const removeRecord = (rootDir = root) =>
  rmSync(runRecordPath(rootDir), { force: true });

// ---------- refusals (AC10) ----------

/**
 * Everything that must hold before anything is written. Returns the cause of the first refusal, or null, plus
 * whether a record of a dead run is waiting for its teardown. `io` replaces the file system and Docker in tests.
 */
export function preflight({
  folder,
  rootDir = root,
  env = process.env,
  home = homedir(),
  platform = process.platform,
  io,
}) {
  const path = refuseBackupPath(folder, { root: rootDir, env, home, platform });
  if (path) return { refusal: path, stale: false };
  let present;
  try {
    present = io.listFolder(folder);
  } catch {
    return {
      refusal: "the backup folder does not exist or cannot be read",
      stale: false,
    };
  }
  const missing = missingRequiredFiles(present);
  if (missing.length)
    return {
      refusal: `the backup folder lacks ${missing.join(", ")}`,
      stale: false,
    };
  const manifest = validateManifest(io.readJson(join(folder, "manifest.json")));
  if (manifest.length) return { refusal: manifest[0], stale: false };
  const { problems } = validateHosted(io.readJson(join(folder, "hosted.json")));
  if (problems.length) return { refusal: problems[0], stale: false };

  try {
    assertLocalEngine(io.engine);
  } catch (error) {
    return {
      refusal: `the Docker identity check failed: ${error.message}`,
      stale: false,
    };
  }
  const record = io.record();
  let stale = false;
  if (record) {
    if (record.unreadable)
      return {
        refusal:
          "the run record cannot be read; run backup:check -- --teardown",
        stale: false,
      };
    if (io.isLive(record))
      return {
        refusal: `another backup:check run (process ${record.pid}) holds the run record`,
        stale: false,
      };
    stale = true;
  }
  const holders = foreignPortHolders(
    io.engine.containers(),
    SCRATCH_PORT_LIST,
    SCRATCH_PROJECT_ID,
  );
  if (holders.length)
    return {
      refusal: `a container of another project holds a scratch port (${holders.join(", ")})`,
      stale,
    };
  const lookalike = io.engine
    .containers()
    .find(
      (c) =>
        c.name.endsWith(`_${SCRATCH_PROJECT_ID}`) &&
        c.project !== SCRATCH_PROJECT_ID,
    );
  if (lookalike)
    return {
      refusal: `container ${lookalike.name} is named like a scratch container but belongs to another project`,
      stale,
    };
  return { refusal: null, stale };
}

// ---------- psql in the scratch container ----------

function passwordOf(inspect) {
  const entry = (inspect.Config?.Env ?? []).find((e) =>
    e.startsWith("POSTGRES_PASSWORD="),
  );
  if (!entry)
    throw new Error("the scratch database container has no POSTGRES_PASSWORD");
  return entry.slice("POSTGRES_PASSWORD=".length);
}

const inspectDb = () => JSON.parse(docker(["inspect", DB_CONTAINER]))[0];

/** Runs psql in the scratch container; stdout and stderr stay in memory. */
function psql(password, { args = [], file, preamble = "", stdinText }) {
  return new Promise((done) => {
    const child = spawn(
      "docker",
      [
        "exec",
        "-i",
        "-e",
        `PGPASSWORD=${password}`,
        DB_CONTAINER,
        "psql",
        "-X",
        "-q",
        "-h",
        "127.0.0.1",
        "-U",
        DB_USER,
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-v",
        "VERBOSITY=sqlstate",
        ...args,
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    const keep = (text, chunk) =>
      text.length > 8 * 1024 * 1024 ? text : text + chunk;
    child.stdout.on("data", (chunk) => (stdout = keep(stdout, chunk)));
    child.stderr.on("data", (chunk) => (stderr = keep(stderr, chunk)));
    child.stdin.on("error", () => {}); // psql stops reading after the first error
    child.on("close", (code) => done({ code: code ?? 1, stdout, stderr }));
    if (stdinText !== undefined) {
      child.stdin.end(stdinText);
      return;
    }
    if (preamble) child.stdin.write(preamble);
    if (file) createReadStream(file).pipe(child.stdin);
    else child.stdin.end();
  });
}

async function query(password, sql) {
  const result = await psql(password, { args: ["-At", "-F", "\t", "-c", sql] });
  if (result.code !== 0)
    throw new StepFailure(
      reduceFailure({ step: "query", exitCode: result.code, ...result }),
    );
  return result.stdout;
}

class StepFailure extends Error {
  constructor(failure) {
    super(
      `step ${failure.step} failed (exit ${failure.exitCode}, SQLSTATE ${failure.sqlstate})`,
    );
    this.failure = failure;
  }
}

const quote = (identifier) => `"${identifier.replaceAll('"', '""')}"`;
const quoteTable = (key) => {
  const at = key.indexOf(".");
  return `${quote(key.slice(0, at))}.${quote(key.slice(at + 1))}`;
};

// ---------- the scratch stack ----------

function cliStart(workdir) {
  const result = spawnSync(
    process.execPath,
    [
      join(root, "node_modules", "supabase", "dist", "supabase.js"),
      "start",
      "-x",
      EXCLUDED_SERVICES.join(","),
      "--workdir",
      workdir,
    ],
    { cwd: root, stdio: "ignore" },
  );
  if (result.status !== 0)
    throw new StepFailure({
      step: "supabase start",
      exitCode: result.status ?? 1,
      sqlstate: "n/a",
    });
}

async function waitHealthy(engine, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const db = engine.containers().find((c) => c.name === DB_CONTAINER);
    if (db?.state === "running" && db.health === "healthy") return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new StepFailure({
    step: "wait for the scratch database",
    exitCode: 1,
    sqlstate: "n/a",
  });
}

// G7: the CLI publishes the database port on every interface. Once Auth and Storage have set up their schemas, stop
// every service and recreate the database container with the port on loopback only.
async function isolateDatabase(engine) {
  for (const container of projectContainers(engine))
    if (container.name !== DB_CONTAINER && container.state === "running")
      docker(["stop", container.name]);
  const inspect = inspectDb();
  const args = loopbackRunArgs(inspect, SCRATCH_PORTS.db);
  docker(["stop", DB_CONTAINER]);
  docker(["rm", DB_CONTAINER]);
  docker(args);
  await waitHealthy(engine);
  const after = inspectDb();
  if (!isLoopbackOnly(after.NetworkSettings?.Ports, SCRATCH_PORTS.db))
    throw new Refusal(
      "the scratch database port is not bound to 127.0.0.1 only",
    );
  const running = projectContainers(engine).filter(
    (c) => c.state === "running",
  );
  if (running.length !== 1 || running[0].name !== DB_CONTAINER)
    throw new Refusal(
      "a service other than the scratch database is running before the import",
    );
}

// ---------- the check ----------

async function scanDataFile(file) {
  const scanner = createCopyScanner();
  const lines = createInterface({
    input: createReadStream(file, "utf8"),
    crlfDelay: Infinity,
  });
  for await (const line of lines) scanner.feed(line);
  return scanner.finish();
}

function md5Of(file) {
  const hash = createHash("md5");
  const fd = openSync(file, "r");
  try {
    const buffer = Buffer.alloc(1024 * 1024);
    for (
      let n = readSync(fd, buffer, 0, buffer.length, null);
      n > 0;
      n = readSync(fd, buffer, 0, buffer.length, null)
    )
      hash.update(buffer.subarray(0, n));
  } finally {
    closeSync(fd);
  }
  return hash.digest("hex");
}

function storageFiles(folder) {
  const base = join(folder, STORAGE_DIR);
  const files = new Map();
  if (!existsSync(base)) return files;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const key = relative(base, full).split(sep).join("/");
        files.set(key, { size: statSync(full).size, md5: () => md5Of(full) });
      }
    }
  };
  walk(base);
  return files;
}

async function restoreStep(password, step, file, preamble = "") {
  const result = await psql(password, {
    file,
    preamble,
    args: ["-o", "/dev/null"],
  });
  if (result.code !== 0)
    throw new StepFailure(
      reduceFailure({ step, exitCode: result.code, ...result }),
    );
}

async function runChecks(folder, hosted, engine) {
  const password = passwordOf(inspectDb());

  for (const [name, value] of LOG_SETTINGS)
    await query(password, `alter system set ${name} = '${value}'`);
  await query(password, "select pg_reload_conf()");
  for (const [name, value] of LOG_SETTINGS) {
    if ((await query(password, `show ${name}`)).trim() !== value)
      throw new Refusal(
        `server logging setting ${name} did not change; no data was imported`,
      );
  }
  const empty = (
    await query(
      password,
      "select count(*) from pg_tables where schemaname = 'public'",
    )
  ).trim();
  if (empty !== "0")
    throw new Refusal(
      "the scratch public schema is not empty before the import",
    );

  // `db dump --data-only` leaves out `supabase_migrations`, so the history is a second pair of files (the runbook).
  const dumped = new Map([
    ...(await scanDataFile(join(folder, "data.sql"))),
    ...(await scanDataFile(join(folder, "history.sql"))),
  ]);

  say("importing roles, schema and data");
  await restoreStep(password, "roles", join(folder, "roles.sql"));
  await restoreStep(password, "schema", join(folder, "schema.sql"));
  await restoreStep(
    password,
    "data",
    join(folder, "data.sql"),
    "set session_replication_role = replica;\n",
  );
  await restoreStep(
    password,
    "history schema",
    join(folder, "history-schema.sql"),
  );
  await restoreStep(
    password,
    "history",
    join(folder, "history.sql"),
    "set session_replication_role = replica;\n",
  );

  // Counts of every table the dump holds, plus the tables Owner decision 12 covers.
  const publicTables = (
    await query(
      password,
      "select schemaname || '.' || tablename from pg_tables where schemaname = 'public' order by 1",
    )
  )
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const required = [
    ...new Set([
      ...publicTables,
      "auth.users",
      "auth.identities",
      "storage.objects",
    ]),
  ];
  const tables = [...new Set([...dumped.keys(), ...required])];
  const sql = tables
    .map(
      (t) =>
        `select '${t.replaceAll("'", "''")}', count(*) from ${quoteTable(t)}`,
    )
    .join("\nunion all\n");
  const restored = new Map(
    (await query(password, sql))
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const tab = line.lastIndexOf("\t");
        return [line.slice(0, tab), Number(line.slice(tab + 1))];
      }),
  );

  const a = compareDumpToRestore(dumped, restored);
  const b = compareHostedCounts(hosted.counts, restored, required);

  const versions = (
    await query(
      password,
      "select version from supabase_migrations.schema_migrations order by version",
    ).catch((error) => {
      if (error instanceof StepFailure) return "";
      throw error;
    })
  )
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const c = compareMigrations(hosted.migrations, versions);

  const rowsJson = (
    await query(
      password,
      "select coalesce(json_agg(json_build_object('b', bucket_id, 'n', name, 's', metadata->>'size', 'e', metadata->>'eTag')), '[]'::json) from storage.objects",
    )
  ).trim();
  const rows = JSON.parse(rowsJson || "[]").map((row) => ({
    bucket: row.b,
    name: row.n,
    size:
      row.s === null || row.s === undefined || row.s === ""
        ? null
        : Number(row.s),
    etag: row.e ?? null,
  }));
  const d = compareStorage(rows, storageFiles(folder));
  void engine;
  return { a, b, c, d };
}

function saveResult(folder, result, outcome) {
  const { names, ...storage } = result.d ?? {};
  writeFileSync(
    join(folder, "check-result.json"),
    JSON.stringify(
      {
        outcome,
        a: result.a,
        b: result.b,
        c: result.c,
        d: result.d ? storage : null,
      },
      null,
      2,
    ),
  );
  if (names?.length)
    writeFileSync(
      join(folder, "check-mismatches.txt"),
      `${names.join("\n")}\n`,
    );
}

// ---------- entry point ----------

// Windows PowerShell 5.1 writes a byte order mark with `Set-Content -Encoding utf8`; JSON.parse rejects it.
export function readJsonFile(file) {
  return JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
}

export function parseArgs(argv) {
  const rest = argv.filter((arg) => arg !== "--");
  if (rest.length === 1 && rest[0] === "--teardown") return { teardown: true };
  if (rest.length === 1 && !rest[0].startsWith("--"))
    return { folder: rest[0] };
  throw new Refusal(
    "usage: npm run backup:check -- <backup folder>   or   npm run backup:check -- --teardown",
  );
}

function realFolder(folder) {
  try {
    return realpathSync(folder);
  } catch {
    return folder;
  }
}

export async function main(argv) {
  const engine = createDocker();
  let args;
  try {
    args = parseArgs(argv);
    if (args.teardown) {
      assertLocalEngine(engine);
      const removed = teardown(engine);
      removeRecord();
      say(
        `teardown confirmed (${removed.containers} containers, ${removed.volumes} volumes removed)`,
      );
      return 0;
    }

    const folder = realFolder(resolve(args.folder));
    const { refusal, stale } = preflight({
      folder,
      io: {
        engine,
        listFolder: (dir) => readdirSync(dir),
        readJson: (file) => {
          try {
            return readJsonFile(file);
          } catch {
            return null;
          }
        },
        record: () => readRecord(),
        isLive,
      },
    });
    if (refusal) throw new Refusal(refusal);
    if (stale) {
      const removed = teardown(engine);
      removeRecord();
      say(
        `removed leftovers of an interrupted run (${removed.containers} containers, ${removed.volumes} volumes) before starting`,
      );
    }

    const hosted = validateHosted(
      readJsonFile(join(folder, "hosted.json")),
    ).hosted;
    return await run(folder, hosted, engine);
  } catch (error) {
    if (error instanceof Refusal) {
      say(`refused: ${error.message}`);
      return 3;
    }
    if (error instanceof StepFailure) {
      say(`FAIL: ${error.message}`);
      return 1;
    }
    say(`FAIL: ${error instanceof Error ? error.message : "unexpected error"}`);
    return 1;
  }
}

async function run(folder, hosted, engine) {
  let outcome = "fail";
  let result = null;
  let failure = null;
  const stop = () => {
    try {
      teardown(engine);
      removeRecord();
    } catch {
      /* the main path reports it */
    }
  };
  const onSignal = () => {
    stop();
    process.exit(130);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  try {
    writeRecord();
    const { workdir, versions } = prepareScratchWorkdir(root);
    const mismatched = versionMismatches(versions, hosted.versions);
    if (mismatched.length)
      throw new Refusal(
        `the pinned service versions differ from the backup's hosted versions (${mismatched.join(", ")}); nothing was started`,
      );
    say("starting the scratch stack on the pinned service versions");
    cliStart(workdir);
    await isolateDatabase(engine);
    result = await runChecks(folder, hosted, engine);
    const ok =
      !result.a.mismatched.length &&
      !result.b.mismatched.length &&
      result.c.equal &&
      !result.d.mismatched;
    outcome = ok ? "pass" : "fail";
  } catch (error) {
    failure = error;
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    try {
      const removed = teardown(engine);
      removeRecord();
      say(
        `teardown confirmed (${removed.containers} containers, ${removed.volumes} volumes removed)`,
      );
    } catch (error) {
      outcome = "unresolved";
      say(`UNRESOLVED: ${error.message}`);
    }
  }
  if (result) {
    for (const line of formatReport(result)) say(line);
    for (const line of mismatchLines("(a)", result.a.mismatched)) say(line);
    for (const line of mismatchLines("(b)", result.b.mismatched)) say(line);
    saveResult(folder, result, outcome);
  }
  if (failure) {
    if (failure instanceof Refusal) say(`refused: ${failure.message}`);
    else if (failure instanceof StepFailure) say(`FAIL: ${failure.message}`);
    else
      say(
        `FAIL: ${failure instanceof Error ? failure.message : "unexpected error"}`,
      );
  }
  say(`result: ${outcome}`);
  return outcome === "pass" ? 0 : outcome === "unresolved" ? 2 : 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await main(process.argv.slice(2));
}
