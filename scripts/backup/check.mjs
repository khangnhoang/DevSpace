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
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertLocalEngine, createDocker } from "../test-stack/docker.mjs";
import { LockError, acquireLock, releaseLock } from "../test-stack/lock.mjs";
import {
  EXCLUDED_SERVICES,
  SCRATCH_NETWORK,
  SCRATCH_PORTS,
  SCRATCH_PROJECT_ID,
  prepareScratchWorkdir,
  runLockDir,
} from "./config.mjs";
import {
  STORAGE_DIR,
  compareDumpToRestore,
  compareHostedCounts,
  compareMigrations,
  compareStorage,
  createCopyScanner,
  describeReadFailure,
  foreignPortHolders,
  formatReport,
  isLoopbackOnly,
  loopbackRunArgs,
  mismatchLines,
  missingRequiredFiles,
  reduceError,
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
// An error whose message this file wrote from nothing the backup holds (a Docker call, a container name), so it
// may be printed. Any other error is reduced to a step and a code (AC8, `reduceError`).
export class SafeError extends Error {}

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
    throw new SafeError(
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

const projectVolumes = (run = docker) =>
  run(["volume", "ls", "--format", "{{.Name}}"])
    .split(/\r?\n/)
    .filter((name) => name.endsWith(`_${SCRATCH_PROJECT_ID}`));

const networkExists = (run = docker) =>
  run(["network", "ls", "--format", "{{.Name}}"])
    .split(/\r?\n/)
    .includes(SCRATCH_NETWORK);

/**
 * The Docker identity check (AC10). Only the refusal whose text this code controls (the engine is not local) is a
 * `Refusal`; any other failure of the engine query, whose message can carry the child's stderr, is a step and a
 * code (AC8).
 */
export function checkEngine(engine) {
  let host;
  try {
    host = engine.host();
  } catch (error) {
    throw new ReadFailure(reduceError("docker identity check", error));
  }
  try {
    assertLocalEngine({ host: () => host });
  } catch (error) {
    throw new Refusal(`the Docker identity check failed: ${error.message}`);
  }
}

// A removal that fails names the resource, which comes from Docker's own listing and not from the backup (G9).
function removeResource(run, kind, name, args) {
  try {
    run(args);
  } catch (error) {
    const reason =
      error instanceof SafeError
        ? error.message
        : describeReadFailure(reduceError("docker", error));
    throw new SafeError(
      `Teardown is not confirmed; ${kind} ${name} could not be removed (${reason}).`,
    );
  }
}

/**
 * Removes every container, volume and network of the scratch project and confirms none remains (AC9, G9). `run`
 * replaces the Docker CLI call in tests.
 */
export function teardown(engine, run = docker) {
  try {
    checkEngine(engine);
  } catch (error) {
    if (error instanceof Refusal) throw new SafeError(error.message);
    throw error;
  }
  const removed = { containers: 0, volumes: 0 };
  for (const container of projectContainers(engine)) {
    if (container.project !== SCRATCH_PROJECT_ID)
      throw new SafeError(
        `Container ${container.name} is named like a scratch container but belongs to another project; nothing was removed.`,
      );
    removeResource(run, "container", container.name, [
      "rm",
      "-f",
      "-v",
      container.name,
    ]);
    removed.containers++;
  }
  for (const name of projectVolumes(run)) {
    removeResource(run, "volume", name, ["volume", "rm", "-f", name]);
    removed.volumes++;
  }
  if (networkExists(run))
    removeResource(run, "network", SCRATCH_NETWORK, [
      "network",
      "rm",
      SCRATCH_NETWORK,
    ]);
  const left = [
    ...projectContainers(engine).map((c) => `container ${c.name}`),
    ...projectVolumes(run).map((name) => `volume ${name}`),
    ...(networkExists(run) ? [`network ${SCRATCH_NETWORK}`] : []),
  ];
  if (left.length)
    throw new SafeError(
      `Teardown is not confirmed; still present: ${left.join(", ")}.`,
    );
  return removed;
}

// ---------- run lock (G9) ----------

// A check and `--teardown` take the same lock before their first write or Docker action. The lock is the
// test stack's generation lock (an exclusive hard link per generation, so of two processes that read the same
// state only one claims the next generation), kept in a directory of its own. A holder whose process is gone is
// taken over; a live holder is never torn down by another process. The owner releases it only after its
// teardown is confirmed, so an unconfirmed teardown leaves a lock that the next run finds stale and cleans up.
/**
 * `startOf` and `afterRead` are test seams: the start time of a pid, and a step that runs between reading the lock
 * and claiming it, which is how a test makes two processes read the same state.
 * @typedef {{ startOf?: (pid: number) => string | null, afterRead?: () => void }} RunSeams
 * `beforePublish` is a test seam: a step that runs after the check and its teardown, before the result is published.
 * @typedef {{ teardown: (engine: any) => { containers: number, volumes: number }, execute: (folder: any, hosted: any, engine: any, rootDir: string) => Promise<any>, beforePublish?: () => void | Promise<void> }} RunOps
 */

/** @param {{ command?: string, rootDir?: string } & RunSeams} [options] */
export function acquireRun({
  command = "backup:check",
  rootDir = root,
  startOf,
  afterRead,
} = {}) {
  try {
    return acquireLock({
      command,
      dir: runLockDir(rootDir),
      checkout: rootDir,
      startOf,
      afterRead,
    });
  } catch (error) {
    if (!(error instanceof LockError)) throw error;
    // The messages of LockError name the test stack; these name this command.
    if (error.code === "held")
      throw new Refusal(
        "another backup:check run (or --teardown) is in progress; wait for it to finish, nothing was changed",
      );
    if (error.code === "lost")
      throw new Refusal(
        "another backup:check run (or --teardown) took the run first; nothing was changed",
      );
    throw new Refusal(
      "the backup:check run lock cannot be read; ask the Owner before removing it, nothing was changed",
    );
  }
}

// ---------- refusals (AC10) ----------

/**
 * The file-system refusals: a folder that may not be used, or that lacks a file or holds an invalid one. They need
 * no Docker and no lock, so a refused folder neither takes the run nor changes the saved result. `io` replaces the
 * file system in tests; `refusePath` is a test seam for the path rule.
 */
export function preflightFiles({
  folder,
  rootDir = root,
  env = process.env,
  home = homedir(),
  platform = process.platform,
  io,
  refusePath = refuseBackupPath,
}) {
  const path = refusePath(folder, { root: rootDir, env, home, platform });
  if (path) return { refusal: path };
  let present;
  try {
    present = io.listFolder(folder);
  } catch {
    return { refusal: "the backup folder does not exist or cannot be read" };
  }
  const missing = missingRequiredFiles(present);
  if (missing.length)
    return { refusal: `the backup folder lacks ${missing.join(", ")}` };
  const manifest = validateManifest(io.readJson(join(folder, "manifest.json")));
  if (manifest.length) return { refusal: manifest[0] };
  const { problems } = validateHosted(io.readJson(join(folder, "hosted.json")));
  if (problems.length) return { refusal: problems[0] };
  return { refusal: null };
}

/**
 * The Docker refusals (AC10): the engine is not local, a container of another project holds a scratch port, or a
 * container is named like a scratch container but belongs to another project. Every call here is a Docker action, so
 * it runs only once the run is owned. An unexpected Docker failure throws, already reduced for printing.
 */
export function preflightDocker(engine) {
  try {
    checkEngine(engine);
  } catch (error) {
    if (error instanceof Refusal) return { refusal: error.message };
    throw error;
  }
  const holders = foreignPortHolders(
    engine.containers(),
    SCRATCH_PORT_LIST,
    SCRATCH_PROJECT_ID,
  );
  if (holders.length)
    return {
      refusal: `a container of another project holds a scratch port (${holders.join(", ")})`,
    };
  const lookalike = engine
    .containers()
    .find(
      (c) =>
        c.name.endsWith(`_${SCRATCH_PROJECT_ID}`) &&
        c.project !== SCRATCH_PROJECT_ID,
    );
  if (lookalike)
    return {
      refusal: `container ${lookalike.name} is named like a scratch container but belongs to another project`,
    };
  return { refusal: null };
}

// ---------- psql in the scratch container ----------

function passwordOf(inspect) {
  const entry = (inspect.Config?.Env ?? []).find((e) =>
    e.startsWith("POSTGRES_PASSWORD="),
  );
  if (!entry)
    throw new SafeError(
      "the scratch database container has no POSTGRES_PASSWORD",
    );
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
    let readCode = null;
    child.on("close", (code) =>
      done({ code: code ?? 1, stdout, stderr, readCode }),
    );
    if (stdinText !== undefined) {
      child.stdin.end(stdinText);
      return;
    }
    if (preamble) child.stdin.write(preamble);
    if (file) {
      // A file that cannot be read stops the import; only the error code is kept (AC8), never its message.
      const source = createReadStream(file);
      source.on("error", (error) => {
        readCode = reduceError("read", error).code;
        child.kill();
      });
      source.pipe(child.stdin);
    } else child.stdin.end();
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

export class StepFailure extends Error {
  constructor(failure) {
    super(
      `step ${failure.step} failed (exit ${failure.exitCode}, SQLSTATE ${failure.sqlstate})`,
    );
    this.failure = failure;
  }
}

// An error raised while the check reads the backup; its message is the reduced one.
export class ReadFailure extends Error {
  constructor(reduced) {
    super(describeReadFailure(reduced));
    this.reduced = reduced;
  }
}

/** Runs one step that reads the backup and turns any error of it into a ReadFailure. */
export async function reading(step, action) {
  try {
    return await action();
  } catch (error) {
    if (
      error instanceof StepFailure ||
      error instanceof ReadFailure ||
      error instanceof Refusal ||
      error instanceof SafeError
    )
      throw error;
    throw new ReadFailure(reduceError(step, error));
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

// Not `for await` over the interface: a read error of the input stream must reject, not hang the loop.
function scanDataFile(file) {
  return new Promise((resolve, reject) => {
    const scanner = createCopyScanner();
    const input = createReadStream(file, "utf8");
    const lines = createInterface({ input, crlfDelay: Infinity });
    input.on("error", reject);
    // The interface re-emits an input error; without a listener it is an uncaught exception with the raw path.
    lines.on("error", reject);
    lines.on("line", (line) => {
      try {
        scanner.feed(line);
      } catch (error) {
        reject(error);
      }
    });
    lines.on("close", () => {
      try {
        resolve(scanner.finish());
      } catch (error) {
        reject(error);
      }
    });
  });
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

function storageFiles(folder, md5 = md5Of) {
  const base = join(folder, STORAGE_DIR);
  const files = new Map();
  if (!existsSync(base)) return files;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const key = relative(base, full).split(sep).join("/");
        files.set(key, { size: statSync(full).size, md5: () => md5(full) });
      }
    }
  };
  walk(base);
  return files;
}

/** The `storage.objects` rows the scratch database holds, from the JSON text the query returned. */
export const parseStorageRows = (text) =>
  reading("read storage rows", () =>
    JSON.parse(text || "[]").map((row) => ({
      bucket: row.b,
      name: row.n,
      size:
        row.s === null || row.s === undefined || row.s === ""
          ? null
          : Number(row.s),
      etag: row.e ?? null,
    })),
  );

/** (d): compareStorage reads each file for its MD5 through the closures `storageFiles` made. `md5` is a test seam. */
export async function compareStorageFiles(folder, rows, md5 = md5Of) {
  const files = await reading("read storage files", () =>
    storageFiles(folder, md5),
  );
  return reading("compare storage files", () => compareStorage(rows, files));
}

export const scanBackupFile = (folder, name, step) =>
  reading(step, () => scanDataFile(join(folder, name)));

async function restoreStep(password, step, file, preamble = "") {
  const result = await psql(password, {
    file,
    preamble,
    args: ["-o", "/dev/null"],
  });
  if (result.readCode)
    throw new ReadFailure({ step: `read ${step} file`, code: result.readCode });
  if (result.code !== 0)
    throw new StepFailure(
      reduceFailure({ step, exitCode: result.code, ...result }),
    );
}

// Every step below that reads the backup runs through `reading`, so an error of it surfaces as a step and a code.
async function runChecks(folder, hosted) {
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
    ...(await scanBackupFile(folder, "data.sql", "scan data file")),
    ...(await scanBackupFile(folder, "history.sql", "scan history file")),
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
  const rows = await parseStorageRows(rowsJson);
  const d = await compareStorageFiles(folder, rows);
  return { a, b, c, d };
}

/**
 * Writes the saved result of a run into the backup folder. Every run replaces it, so an earlier pass can never
 * stand as the latest result of a run that failed, was killed or could not be cleaned up (AC9). Only aggregates
 * and one safe failure line go in; object names go to `check-mismatches.txt`, which is removed when the run
 * found none. The names file is settled first and the result is published last, by renaming a fully written
 * temporary file over it, so a failure anywhere leaves the previous (non-pass) result and never a half-written
 * result or a stale pass.
 */
export function saveResult(folder, result, outcome, failure = null) {
  const { names, ...storage } = result?.d ?? {};
  const mismatches = join(folder, "check-mismatches.txt");
  if (names?.length) writeFileSync(mismatches, `${names.join("\n")}\n`);
  else rmSync(mismatches, { force: true });
  const target = join(folder, "check-result.json");
  const temp = `${target}.tmp`;
  try {
    writeFileSync(
      temp,
      JSON.stringify(
        {
          outcome,
          failure,
          a: result?.a ?? null,
          b: result?.b ?? null,
          c: result?.c ?? null,
          d: result?.d ? storage : null,
        },
        null,
        2,
      ),
    );
    renameSync(temp, target);
  } finally {
    rmSync(temp, { force: true });
  }
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

/**
 * The one printable line of an error (AC8). Only errors whose message this file wrote are printed as they are;
 * anything else, including every error raised while reading the backup, is a step and a code.
 */
export function describeFailure(error) {
  if (error instanceof Refusal) return `refused: ${error.message}`;
  if (
    error instanceof StepFailure ||
    error instanceof ReadFailure ||
    error instanceof SafeError
  )
    return `FAIL: ${error.message}`;
  return `FAIL: ${describeReadFailure(reduceError("unexpected error", error))}`;
}

const passed = (result) =>
  !result.a.mismatched.length &&
  !result.b.mismatched.length &&
  result.c.equal &&
  !result.d.mismatched;

// The default steps of a run; a test replaces them to reach the ordering and exit codes without Docker.
async function execute(folder, hosted, engine, rootDir) {
  let prepared;
  try {
    prepared = prepareScratchWorkdir(rootDir);
  } catch (error) {
    // Its messages name the checkout's config and version files, nothing from the backup.
    throw new SafeError(error.message);
  }
  const mismatched = versionMismatches(prepared.versions, hosted.versions);
  if (mismatched.length)
    throw new Refusal(
      `the pinned service versions differ from the backup's hosted versions (${mismatched.join(", ")}); nothing was started`,
    );
  say("starting the scratch stack on the pinned service versions");
  cliStart(prepared.workdir);
  await isolateDatabase(engine);
  return runChecks(folder, hosted);
}

const defaultOps = { teardown, execute };

/**
 * An interrupt (SIGINT, SIGTERM) of a run that holds the lock. Removal confirmed: the lock is released and the exit
 * code is 130; the saved result stays the non-pass one written when the run began. Removal not confirmed: the lock
 * stays with this process, the unresolved line is printed and saved where possible, and the exit code is 2.
 * Returns the exit code.
 * @param {{ lock: any, folder: string, engine: any, ops?: RunOps }} options
 */
export function interruptRun({ lock, folder, engine, ops = defaultOps }) {
  try {
    ops.teardown(engine);
  } catch (error) {
    const line = `UNRESOLVED: ${unresolvedText(error)}`;
    say(line);
    try {
      saveResult(folder, null, "unresolved", line);
    } catch {
      /* the saved result is still the non-pass one written when the run began */
    }
    return 2;
  }
  try {
    releaseLock(lock);
  } catch {
    /* a lock that stays is taken over as stale by the next run */
  }
  return 130;
}

/**
 * One check, from taking the run to releasing it. The folder has been accepted by `preflightFiles`. Order: take the
 * lock, then the Docker refusals (the first Docker action), then replace the saved result, then clean up
 * leftovers, run, tear down, publish the result and only then release the lock, so no other run can start between
 * the end of this one and its result file. Exit codes: 0 pass, 1 fail, 2 unresolved (a teardown that is not
 * confirmed), 3 refused before anything was written.
 */
/** @param {{ folder: string, hosted: any, rootDir?: string, engine: any, ops?: RunOps } & RunSeams} options */
export async function performRun({
  folder,
  hosted,
  rootDir = root,
  engine,
  ops = defaultOps,
  startOf,
  afterRead,
}) {
  let lock;
  try {
    lock = acquireRun({ command: "backup:check", rootDir, startOf, afterRead });
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    say(describeFailure(error));
    return 3;
  }
  // A Docker refusal or failure changes nothing: the saved result is left alone and the lock is released.
  try {
    const { refusal } = preflightDocker(engine);
    if (refusal) throw new Refusal(refusal);
  } catch (error) {
    releaseLock(lock);
    say(describeFailure(error));
    return error instanceof Refusal ? 3 : 1;
  }
  // From here the run owns the folder's saved result. It stops being a pass before anything that can fail runs.
  try {
    saveResult(folder, null, "incomplete");
  } catch (error) {
    releaseLock(lock); // nothing was started
    say(
      `FAIL: ${describeReadFailure(reduceError("replace the saved result", error))}`,
    );
    return 1;
  }

  let outcome = "fail";
  let result = null;
  let failure = null; // what the check itself raised
  let teardownFailure = null; // a teardown that is not confirmed
  const onSignal = () =>
    process.exit(interruptRun({ lock, folder, engine, ops }));
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  let confirmed = false;
  try {
    try {
      // Leftovers of a killed run go first, before anything is started.
      const removed = ops.teardown(engine);
      confirmed = true;
      if (lock.tookOver || removed.containers || removed.volumes)
        say(
          `removed leftovers of an interrupted run (${removed.containers} containers, ${removed.volumes} volumes) before starting`,
        );
    } catch (error) {
      teardownFailure = error;
      outcome = "unresolved";
    }
    if (confirmed) {
      try {
        result = await ops.execute(folder, hosted, engine, rootDir);
        outcome = passed(result) ? "pass" : "fail";
      } catch (error) {
        failure = error;
      }
      confirmed = false;
      try {
        const removed = ops.teardown(engine);
        confirmed = true;
        say(
          `teardown confirmed (${removed.containers} containers, ${removed.volumes} volumes removed)`,
        );
      } catch (error) {
        outcome = "unresolved";
        teardownFailure = error;
      }
    }
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }
  if (outcome === "unresolved")
    say(`UNRESOLVED: ${unresolvedText(teardownFailure)}`);

  if (result) {
    for (const line of formatReport(result)) say(line);
    for (const line of mismatchLines("(a)", result.a.mismatched)) say(line);
    for (const line of mismatchLines("(b)", result.b.mismatched)) say(line);
  }
  const failureLine = [
    failure && describeFailure(failure),
    teardownFailure && `UNRESOLVED: ${unresolvedText(teardownFailure)}`,
  ]
    .filter(Boolean)
    .join("; ");
  await ops.beforePublish?.();
  try {
    saveResult(folder, result, outcome, failureLine || null);
  } catch (error) {
    // `saveResult` publishes last and atomically, so the saved result is still the non-pass one written above.
    if (outcome === "pass") outcome = "fail";
    say(`FAIL: ${describeReadFailure(reduceError("save the result", error))}`);
  }
  // Ownership ends only after every result-file operation, and only when the teardown is confirmed. An
  // unconfirmed one leaves the lock with this process; once it exits the next run or --teardown takes it over
  // and cleans up.
  if (confirmed) releaseLock(lock);
  if (failure) say(describeFailure(failure));
  say(`result: ${outcome}`);
  return outcome === "pass" ? 0 : outcome === "unresolved" ? 2 : 1;
}

function unresolvedText(error) {
  return error instanceof SafeError || error instanceof ReadFailure
    ? error.message
    : describeReadFailure(reduceError("teardown", error));
}

/** `--teardown`: takes the same run as a check, so a live run is refused and never torn down. */
/** @param {{ rootDir?: string, engine: any, ops?: RunOps } & RunSeams} options */
export function performTeardown({
  rootDir = root,
  engine,
  ops = defaultOps,
  startOf,
  afterRead,
}) {
  let lock;
  try {
    lock = acquireRun({
      command: "backup:check --teardown",
      rootDir,
      startOf,
      afterRead,
    });
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    say(describeFailure(error));
    return 3;
  }
  try {
    // The identity check is the first Docker action, made with the run owned. A refusal changes nothing.
    try {
      checkEngine(engine);
    } catch (error) {
      if (!(error instanceof Refusal)) throw error;
      releaseLock(lock);
      say(describeFailure(error));
      return 3;
    }
    const removed = ops.teardown(engine);
    releaseLock(lock);
    say(
      `teardown confirmed (${removed.containers} containers, ${removed.volumes} volumes removed)`,
    );
    return 0;
  } catch (error) {
    // Never `fail` (exit code 1): until removal is confirmed the scratch data may still exist.
    say(`UNRESOLVED: ${unresolvedText(error)}`);
    return 2;
  }
}

/**
 * `startOf` and `refusePath` are test seams (see `RunSeams`, `preflightFiles`). No Docker call is made before the
 * run is owned: the file-system refusals come first, then `performRun` and `performTeardown` take the lock.
 * @param {string[]} argv
 * @param {{ rootDir?: string, engine?: any, ops?: RunOps, refusePath?: typeof refuseBackupPath } & RunSeams} [options]
 */
export async function main(
  argv,
  { rootDir = root, engine, ops, startOf, refusePath } = {},
) {
  try {
    const docker = engine ?? createDocker();
    const args = parseArgs(argv);
    if (args.teardown)
      return performTeardown({ rootDir, engine: docker, ops, startOf });

    const folder = realFolder(resolve(args.folder));
    const { refusal } = preflightFiles({
      folder,
      rootDir,
      refusePath,
      io: {
        listFolder: (dir) => readdirSync(dir),
        readJson: (file) => {
          try {
            return readJsonFile(file);
          } catch {
            return null;
          }
        },
      },
    });
    if (refusal) throw new Refusal(refusal);

    const hosted = validateHosted(
      readJsonFile(join(folder, "hosted.json")),
    ).hosted;
    return await performRun({
      folder,
      hosted,
      rootDir,
      engine: docker,
      ops,
      startOf,
    });
  } catch (error) {
    say(describeFailure(error));
    return error instanceof Refusal ? 3 : 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await main(process.argv.slice(2));
}
