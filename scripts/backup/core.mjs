// Pure parts of `npm run backup:check` (TM-U1): path refusal, COPY row counting, the four comparisons of AC7,
// error reduction (AC8) and the Docker arguments that re-publish the scratch database on loopback (G7). Nothing
// here reads a file or runs a process, so a unit test reaches every rule. The orchestration is check.mjs.
//
// Data discipline (AC8): every function that returns text meant for the output returns table names, counts and
// pass/fail only. Object names and row values stay in memory.
import path from "node:path";

export const REQUIRED_FILES = [
  "roles.sql",
  "schema.sql",
  "data.sql",
  "history-schema.sql",
  "history.sql",
  "manifest.json",
  "hosted.json",
];

// `<backup>/storage/<bucket>/<object name>`, the layout the runbook's `storage cp -r` writes.
export const STORAGE_DIR = "storage";

const isWindows = (platform) => platform === "win32";
const pathFor = (platform) => (isWindows(platform) ? path.win32 : path.posix);

/**
 * Returns the cause when a backup folder may not be used, otherwise null. The folder must be absolute, outside
 * the checkout and outside `AppData` (the desktop app virtualizes writes there, `.claude/rules.md` section 8).
 * @param {unknown} folder
 * @param {{ root: string, env?: Record<string, string | undefined>, home?: string, platform?: string }} context
 */
export function refuseBackupPath(
  folder,
  { root, env = {}, home = "", platform = process.platform },
) {
  if (typeof folder !== "string" || !folder.trim())
    return "no backup folder was given";
  const p = pathFor(platform);
  if (!p.isAbsolute(folder))
    return "the backup folder must be an absolute path";
  const same = (a, b) =>
    isWindows(platform) ? a.toLowerCase() === b.toLowerCase() : a === b;
  const normalize = (value) =>
    p.resolve(value).replace(/[\\/]+$/, "") || p.resolve(value);
  const target = normalize(folder);
  const inside = (parent, child) => {
    const rel = p.relative(parent, child);
    return (
      rel === "" ||
      (!rel.startsWith("..") && !p.isAbsolute(rel)) ||
      same(parent, child)
    );
  };
  if (inside(normalize(root), target))
    return "the backup folder is inside the repository";
  const appData = [
    env.APPDATA,
    env.LOCALAPPDATA,
    home && p.join(home, "AppData"),
  ]
    .filter(Boolean)
    .map(normalize);
  if (appData.some((dir) => inside(dir, target)))
    return "the backup folder is under AppData";
  const segments = target.split(/[\\/]+/).map((s) => s.toLowerCase());
  if (segments.includes("appdata")) return "the backup folder is under AppData";
  return null;
}

/** @param {Iterable<string>} present names found in the backup folder */
export function missingRequiredFiles(present) {
  const have = new Set(present);
  return REQUIRED_FILES.filter((name) => !have.has(name));
}

// ---------- COPY blocks ----------

const IDENT = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)`;
const COPY_HEADER = new RegExp(
  String.raw`^COPY\s+(${IDENT})\.(${IDENT})\s*(?:\(.*\))?\s+FROM\s+stdin\s*;\s*$`,
  "i",
);
const unquote = (ident) =>
  ident.startsWith('"') ? ident.slice(1, -1).replaceAll('""', '"') : ident;

/** `public.courses` from the two identifiers of a COPY header. */
export const tableKey = (schema, table) => `${schema}.${table}`;

/**
 * Counts the rows of every `COPY schema.table (...) FROM stdin;` block of a plain-format dump, line by line. A
 * COPY row is one line (newlines inside values are escaped), and the block ends at a line holding `\.`.
 * `finish()` throws when the text ends inside a block, which is how a truncated dump is caught.
 */
export function createCopyScanner() {
  /** @type {Map<string, number>} */
  const tables = new Map();
  let current = null;
  return {
    tables,
    feed(rawLine) {
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
      if (current !== null) {
        if (line === "\\.") current = null;
        else tables.set(current, (tables.get(current) ?? 0) + 1);
        return;
      }
      const match = COPY_HEADER.exec(line);
      if (match) {
        current = tableKey(unquote(match[1]), unquote(match[2]));
        tables.set(current, tables.get(current) ?? 0);
      }
    },
    finish() {
      if (current !== null)
        throw new Error(
          `the data file ends inside the COPY block of ${current}; the dump is truncated`,
        );
      return tables;
    },
  };
}

/** Counts rows of a whole text; the file reader of check.mjs feeds lines instead. */
export function countCopyRows(text) {
  const scanner = createCopyScanner();
  for (const line of text.split("\n")) scanner.feed(line);
  return scanner.finish();
}

// ---------- comparisons (AC7) ----------

const entries = (map) => (map instanceof Map ? [...map] : Object.entries(map));

/**
 * (a) every table of the dump has a restored count equal to the rows the dump holds.
 * @param {Map<string, number> | Record<string, number>} dumped
 * @param {Map<string, number> | Record<string, number>} restored
 */
export function compareDumpToRestore(dumped, restored) {
  const have = new Map(entries(restored));
  const mismatched = [];
  for (const [table, expected] of entries(dumped)) {
    const actual = have.get(table);
    if (actual !== expected) mismatched.push({ table, expected, actual });
  }
  return { checked: entries(dumped).length, mismatched };
}

/**
 * (b) every table Owner decision 12 covers has a restored count equal to the hosted count. `required` lists the
 * tables that must appear in the hosted counts; a table in the restored database that the hosted counts do not
 * name is a mismatch too, so a new table cannot hide behind an old counts file.
 */
export function compareHostedCounts(hosted, restored, required) {
  const want = new Map(entries(hosted));
  const have = new Map(entries(restored));
  const mismatched = [];
  for (const table of required) {
    if (!want.has(table))
      mismatched.push({ table, expected: undefined, actual: have.get(table) });
  }
  for (const [table, expected] of want) {
    if (have.get(table) !== expected)
      mismatched.push({ table, expected, actual: have.get(table) });
  }
  return { checked: want.size, mismatched };
}

/** (c) the restored migration history equals the hosted `list_migrations` versions. */
export function compareMigrations(hosted, restored) {
  const want = new Set(hosted);
  const have = new Set(restored);
  const missing = [...want].filter((version) => !have.has(version)).length;
  const extra = [...have].filter((version) => !want.has(version)).length;
  return {
    hosted: want.size,
    restored: have.size,
    missing,
    extra,
    equal: missing === 0 && extra === 0 && want.size > 0,
  };
}

/**
 * (d) every `storage.objects` row has a file of the same size (and the same MD5 where the stored ETag is a plain
 * MD5), and no file lacks a row. Object names appear only in `names`, which check.mjs writes inside the backup
 * folder and never prints.
 * @param {{ bucket: string, name: string, size: number | null, etag: string | null }[]} rows
 * @param {Map<string, { size: number, md5?: () => string }>} files keyed `<bucket>/<name>`
 */
export function compareStorage(rows, files) {
  const names = [];
  let missing = 0;
  let sizeMismatch = 0;
  let md5Checked = 0;
  let md5Mismatch = 0;
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.bucket}/${row.name}`;
    seen.add(key);
    const file = files.get(key);
    if (!file) {
      missing++;
      names.push(`missing file: ${key}`);
      continue;
    }
    if (row.size === null || row.size !== file.size) {
      sizeMismatch++;
      names.push(`size differs: ${key}`);
      continue;
    }
    const etag = (row.etag ?? "").replaceAll('"', "");
    if (/^[0-9a-f]{32}$/i.test(etag) && file.md5) {
      md5Checked++;
      if (file.md5().toLowerCase() !== etag.toLowerCase()) {
        md5Mismatch++;
        names.push(`content differs: ${key}`);
      }
    }
  }
  let extra = 0;
  for (const key of files.keys()) {
    if (!seen.has(key)) {
      extra++;
      names.push(`file without a row: ${key}`);
    }
  }
  return {
    rows: rows.length,
    files: files.size,
    missing,
    extra,
    sizeMismatch,
    md5Checked,
    md5Mismatch,
    mismatched: missing + extra + sizeMismatch + md5Mismatch,
    names,
  };
}

// ---------- backup metadata ----------

const VERSION_KEYS = ["postgres", "gotrue", "storage"];

/**
 * `hosted.json`, written by Main right after the dump: exact hosted counts, the `list_migrations` versions and the
 * hosted service versions. Errors name the field, never a value.
 */
export function validateHosted(value) {
  const problems = [];
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { problems: ["hosted.json is not an object"], hosted: null };
  const { counts, migrations, versions } = value;
  if (!counts || typeof counts !== "object" || Array.isArray(counts))
    problems.push("hosted.json has no counts object");
  else {
    for (const [table, count] of Object.entries(counts)) {
      if (
        !/^[^.\s]+\.[^.\s]+$/.test(table) ||
        !Number.isInteger(count) ||
        count < 0
      )
        problems.push(`hosted.json counts has an invalid entry for ${table}`);
    }
    for (const required of [
      "auth.users",
      "auth.identities",
      "storage.objects",
    ]) {
      if (!(required in counts))
        problems.push(`hosted.json counts lacks ${required}`);
    }
  }
  if (
    !Array.isArray(migrations) ||
    !migrations.length ||
    migrations.some((version) => typeof version !== "string" || !version)
  )
    problems.push("hosted.json migrations must be a nonempty list of versions");
  if (!versions || typeof versions !== "object")
    problems.push("hosted.json has no versions object");
  else {
    for (const key of VERSION_KEYS) {
      // The value is written to a pin file the CLI builds an image tag from; nothing else checks it.
      if (typeof versions[key] !== "string" || !/^[\w.-]+$/.test(versions[key]))
        problems.push(`hosted.json versions lacks ${key}`);
    }
  }
  return problems.length
    ? { problems, hosted: null }
    : { problems, hosted: { counts, migrations, versions } };
}

/** `manifest.json`: when, with which CLI, against which hosted service versions (AC6). */
export function validateManifest(value) {
  const problems = [];
  if (!value || typeof value !== "object" || Array.isArray(value))
    return ["manifest.json is not an object"];
  for (const field of ["time", "cli"]) {
    if (typeof value[field] !== "string" || !value[field])
      problems.push(`manifest.json lacks ${field}`);
  }
  if (!value.versions || typeof value.versions !== "object")
    problems.push("manifest.json lacks versions");
  return problems;
}

// ---------- error reduction (AC8) ----------

/**
 * A failed step reduces to its name, exit code and SQLSTATE. `psql` runs with `VERBOSITY sqlstate`, so an error
 * line is exactly `ERROR:  <code>`; any other line (which could hold a value) is dropped.
 */
export function reduceFailure({ step, exitCode, stdout = "", stderr = "" }) {
  const codes = [];
  for (const line of `${stderr}\n${stdout}`.split(/\r?\n/)) {
    const match =
      /^(?:psql:[^:]*:\d+:\s*)?(?:ERROR|FATAL):\s+([0-9A-Z]{5})\s*$/.exec(
        line.trim(),
      );
    if (match) codes.push(match[1]);
  }
  return { step, exitCode, sqlstate: codes[0] ?? "unknown" };
}

/**
 * An error raised while the check itself reads the backup (a file it cannot open, a JSON or SQL file it cannot
 * parse) reduces to the step and an error code. The message of such an error is never used: a Node file error
 * carries the path below the backup folder (an object name), and a parse error carries a piece of the content.
 * @param {string} step
 * @param {unknown} error
 */
export function reduceError(step, error) {
  const code =
    typeof error?.code === "string" && /^[A-Za-z0-9_]{1,40}$/.test(error.code)
      ? error.code
      : error instanceof SyntaxError
        ? "PARSE"
        : "UNKNOWN";
  return { step, code };
}

/** The one line a reduced read error becomes. */
export const describeReadFailure = ({ step, code }) =>
  `step ${step} failed (error code ${code})`;

// ---------- the scratch database container (G7) ----------

const SCRATCH_DB_PORT = "5432/tcp";

/**
 * True when Docker publishes the database on `127.0.0.1:<port>` and nothing else.
 * @param {Record<string, { HostIp: string, HostPort: string }[] | null> | null | undefined} ports
 */
export function isLoopbackOnly(ports, port) {
  const published = Object.entries(ports ?? {}).filter(([, v]) => v?.length);
  return (
    published.length === 1 &&
    published[0][0] === SCRATCH_DB_PORT &&
    published[0][1].length === 1 &&
    published[0][1][0].HostIp === "127.0.0.1" &&
    published[0][1][0].HostPort === String(port)
  );
}

const nanoseconds = (value) => `${Math.max(1, Math.round(value / 1e6))}ms`;

/**
 * `docker run` arguments that recreate a container from its `docker inspect` record with one change: the
 * database port is published on loopback only. The CLI publishes it on every interface and offers no option for
 * the address, so the check recreates the container once the Auth and Storage setup is done (G7). The image,
 * entrypoint, command, environment, labels, volume, network alias and health check are copied unchanged.
 */
export function loopbackRunArgs(inspect, port) {
  const config = inspect.Config ?? {};
  const host = inspect.HostConfig ?? {};
  const networks = Object.entries(inspect.NetworkSettings?.Networks ?? {});
  if (!config.Image) throw new Error("the database container has no image");
  if (!networks.length)
    throw new Error("the database container has no network");
  const [networkName, attachment] = networks[0];
  const args = ["run", "-d", "--name", String(inspect.Name).replace(/^\//, "")];
  for (const [key, value] of Object.entries(config.Labels ?? {}))
    args.push("--label", `${key}=${value}`);
  for (const entry of config.Env ?? []) args.push("--env", entry);
  for (const bind of host.Binds ?? []) args.push("--volume", bind);
  args.push("--network", networkName);
  for (const alias of attachment.Aliases ?? [])
    args.push("--network-alias", alias);
  args.push("--publish", `127.0.0.1:${port}:5432`);
  if (host.RestartPolicy?.Name) args.push("--restart", host.RestartPolicy.Name);
  if (host.ShmSize) args.push("--shm-size", String(host.ShmSize));
  const health = config.Healthcheck;
  if (health?.Test?.length > 1) {
    const [kind, ...command] = health.Test;
    if (kind === "CMD-SHELL") args.push("--health-cmd", command.join(" "));
    else if (kind === "CMD") args.push("--health-cmd", command.join(" "));
    if (health.Interval)
      args.push("--health-interval", nanoseconds(health.Interval));
    if (health.Timeout)
      args.push("--health-timeout", nanoseconds(health.Timeout));
    if (health.Retries) args.push("--health-retries", String(health.Retries));
    if (health.StartPeriod)
      args.push("--health-start-period", nanoseconds(health.StartPeriod));
  }
  if (config.User) args.push("--user", config.User);
  if (config.WorkingDir) args.push("--workdir", config.WorkingDir);
  const entrypoint = config.Entrypoint ?? [];
  if (entrypoint.length) args.push("--entrypoint", entrypoint[0]);
  args.push(config.Image, ...entrypoint.slice(1), ...(config.Cmd ?? []));
  return args;
}

/**
 * Containers of another project that hold a scratch port (AC10). Containers of the scratch project itself are
 * a leftover for the teardown, not a foreign holder.
 * @param {{ name: string, project: string, ports: number[] }[]} containers
 */
export function foreignPortHolders(containers, ports, project) {
  return containers
    .filter(
      (container) =>
        container.project !== project &&
        container.ports.some((port) => ports.includes(port)),
    )
    .map((container) => container.name);
}

// ---------- the report ----------

/** One line per check; counts and pass/fail only. */
export function formatReport(result) {
  const lines = [];
  const mark = (ok) => (ok ? "pass" : "FAIL");
  if (result.a)
    lines.push(
      `(a) dump rows = restored rows: ${mark(!result.a.mismatched.length)} (${result.a.checked} tables, ${result.a.mismatched.length} mismatched)`,
    );
  if (result.b)
    lines.push(
      `(b) restored counts = hosted counts: ${mark(!result.b.mismatched.length)} (${result.b.checked} tables, ${result.b.mismatched.length} mismatched)`,
    );
  if (result.c)
    lines.push(
      `(c) migration history = hosted: ${mark(result.c.equal)} (hosted ${result.c.hosted}, restored ${result.c.restored}, missing ${result.c.missing}, extra ${result.c.extra})`,
    );
  if (result.d)
    lines.push(
      `(d) storage objects = files: ${mark(!result.d.mismatched)} (${result.d.rows} rows, ${result.d.files} files, ${result.d.mismatched} mismatched, MD5 compared for ${result.d.md5Checked})`,
    );
  return lines;
}

/** Table-level mismatch lines for the output: table name and the two counts, nothing else. */
export function mismatchLines(label, mismatched) {
  return mismatched.map(
    ({ table, expected, actual }) =>
      `${label} ${table}: expected ${expected ?? "(no count)"}, restored ${actual ?? "(no table)"}`,
  );
}
