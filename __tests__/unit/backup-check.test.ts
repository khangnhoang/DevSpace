// TM-U1 AC7 to AC10: the pure parts of `backup:check` and every refusal that happens before a write.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareDumpToRestore,
  compareHostedCounts,
  compareMigrations,
  compareStorage,
  countCopyRows,
  createCopyScanner,
  foreignPortHolders,
  formatReport,
  isLoopbackOnly,
  loopbackRunArgs,
  mismatchLines,
  missingRequiredFiles,
  reduceFailure,
  refuseBackupPath,
  REQUIRED_FILES,
  validateHosted,
  validateManifest,
  versionMismatches,
} from "../../scripts/backup/core.mjs";
import {
  parseArgs,
  preflightDocker,
  preflightFiles,
  readJsonFile,
} from "../../scripts/backup/check.mjs";
import {
  generateScratchConfig,
  SCRATCH_PORTS,
  SCRATCH_PROJECT_ID,
} from "../../scripts/backup/config.mjs";

const ROOT = "C:\\DevSpace";
const WIN = {
  root: ROOT,
  env: {
    APPDATA: "C:\\Users\\khang\\AppData\\Roaming",
    LOCALAPPDATA: "C:\\Users\\khang\\AppData\\Local",
  },
  home: "C:\\Users\\khang",
  platform: "win32",
};

describe("backup:check path refusal (AC10, G6)", () => {
  it.each([
    ["C:\\DevSpace", "inside the repository"],
    ["C:\\DevSpace\\backups\\x", "inside the repository"],
    ["c:\\devspace\\BACKUPS", "inside the repository"],
    ["C:\\DevSpace\\app\\..\\x", "inside the repository"],
    ["C:\\Users\\khang\\AppData\\Local\\x", "AppData"],
    ["C:\\Users\\khang\\AppData\\Roaming\\devspace", "AppData"],
    [
      "C:\\Users\\khang\\AppData\\Local\\Packages\\Claude_pzs8sxrjxfjjc\\LocalCache\\x",
      "AppData",
    ],
    ["D:\\other\\AppData\\x", "AppData"],
    ["relative\\folder", "absolute"],
    ["", "no backup folder"],
  ])("refuses %j", (folder, cause) => {
    expect(refuseBackupPath(folder, WIN)).toMatch(cause);
  });

  it("refuses a missing or non-string folder", () => {
    expect(refuseBackupPath(undefined, WIN)).toMatch(/no backup folder/);
    expect(refuseBackupPath(42, WIN)).toMatch(/no backup folder/);
  });

  it.each([
    "C:\\Users\\khang\\devspace-backups\\20261108-1200",
    "D:\\backups",
    "C:\\DevSpaceBackups\\x", // a sibling that only shares the prefix
  ])("accepts %j", (folder) => {
    expect(refuseBackupPath(folder, WIN)).toBeNull();
  });

  it("applies the same rules on POSIX", () => {
    const posix = {
      root: "/repo",
      env: {},
      home: "/home/k",
      platform: "linux",
    };
    expect(refuseBackupPath("/repo/b", posix)).toMatch(/repository/);
    expect(refuseBackupPath("/repo", posix)).toMatch(/repository/);
    expect(refuseBackupPath("/home/k/AppData/x", posix)).toMatch(/AppData/);
    expect(refuseBackupPath("/home/k/backups/x", posix)).toBeNull();
    expect(refuseBackupPath("/repository-backup", posix)).toBeNull();
  });
});

describe("backup:check COPY row counting (AC7 a)", () => {
  const dump = [
    "SET session_replication_role = replica;",
    'COPY "public"."courses" ("id", "name") FROM stdin;',
    "1\tHTML",
    "2\tCSS",
    "\\.",
    'COPY "public"."reviews" ("id") FROM stdin;',
    "\\.",
    "COPY auth.users (id) FROM stdin;",
    "a",
    "\\.",
    'COPY "weird ""schema"""."t" (id) FROM stdin;',
    "x",
    "y",
    "z",
    "\\.",
  ].join("\n");

  it("counts rows per table, including empty tables and quoted names", () => {
    const counts = countCopyRows(dump);
    expect(Object.fromEntries(counts)).toEqual({
      "public.courses": 2,
      "public.reviews": 0,
      "auth.users": 1,
      'weird "schema".t': 3,
    });
  });

  it("does not read a COPY-looking row inside a block as a new table", () => {
    const counts = countCopyRows(
      'COPY "public"."notes" ("body") FROM stdin;\nCOPY "public"."fake" (a) FROM stdin;\n\\.',
    );
    expect([...counts.keys()]).toEqual(["public.notes"]);
    expect(counts.get("public.notes")).toBe(1);
  });

  it("handles CRLF line endings", () => {
    const counts = countCopyRows(
      'COPY "public"."a" (x) FROM stdin;\r\n1\r\n2\r\n\\.\r\n',
    );
    expect(counts.get("public.a")).toBe(2);
  });

  it("fails on a dump that ends inside a COPY block", () => {
    expect(() =>
      countCopyRows('COPY "public"."a" (x) FROM stdin;\n1\n2'),
    ).toThrow(/truncated/);
  });

  it("feeds line by line like the file reader", () => {
    const scanner = createCopyScanner();
    for (const line of dump.split("\n")) scanner.feed(line);
    expect(scanner.finish().get("public.courses")).toBe(2);
  });
});

describe("backup:check comparisons (AC7)", () => {
  it("(a) reports each table whose restored count differs from the dump", () => {
    const result = compareDumpToRestore(
      new Map([
        ["public.a", 2],
        ["public.b", 0],
        ["public.c", 5],
      ]),
      new Map([
        ["public.a", 2],
        ["public.b", 0],
        ["public.c", 4],
      ]),
    );
    expect(result.checked).toBe(3);
    expect(result.mismatched).toEqual([
      { table: "public.c", expected: 5, actual: 4 },
    ]);
    expect(
      compareDumpToRestore(new Map([["public.a", 1]]), new Map()).mismatched,
    ).toHaveLength(1);
  });

  it("(b) fails on a changed count, a restored table the hosted counts omit, and a count of zero where hosted held rows", () => {
    const hosted = { "public.a": 3, "public.b": 0, "auth.users": 2 };
    const restored = new Map([
      ["public.a", 3],
      ["public.b", 0],
      ["auth.users", 2],
    ]);
    const required = ["public.a", "public.b", "auth.users"];
    expect(compareHostedCounts(hosted, restored, required).mismatched).toEqual(
      [],
    );

    expect(
      compareHostedCounts({ ...hosted, "public.a": 4 }, restored, required)
        .mismatched,
    ).toEqual([{ table: "public.a", expected: 4, actual: 3 }]);

    expect(
      compareHostedCounts(
        hosted,
        new Map([...restored, ["public.a", 0]]),
        required,
      ).mismatched,
    ).toEqual([{ table: "public.a", expected: 3, actual: 0 }]);

    const extra = compareHostedCounts(hosted, restored, [
      ...required,
      "public.new_table",
    ]);
    expect(extra.mismatched).toEqual([
      { table: "public.new_table", expected: undefined, actual: undefined },
    ]);
  });

  it("(c) compares the migration history exactly", () => {
    expect(compareMigrations(["1", "2"], ["2", "1"]).equal).toBe(true);
    expect(compareMigrations(["1", "2"], ["1"])).toMatchObject({
      equal: false,
      missing: 1,
      extra: 0,
    });
    expect(compareMigrations(["1"], ["1", "9"])).toMatchObject({
      equal: false,
      extra: 1,
    });
    expect(compareMigrations([], []).equal).toBe(false);
  });

  describe("(d) storage objects", () => {
    const row = (
      name: string,
      size: number | null = 3,
      etag: string | null = null,
    ) => ({
      bucket: "avatars",
      name,
      size,
      etag,
    });
    const file = (size: number, md5 = "") => ({ size, md5: () => md5 });
    const md5 = "d41d8cd98f00b204e9800998ecf8427e";

    it("passes when every row has a same-size file and nothing is extra", () => {
      const result = compareStorage(
        [row("a.txt", 3, `"${md5}"`), row("dir/b.txt", 3)],
        new Map([
          ["avatars/a.txt", file(3, md5)],
          ["avatars/dir/b.txt", file(3)],
        ]),
      );
      expect(result.mismatched).toBe(0);
      expect(result.md5Checked).toBe(1);
    });

    it("fails on a missing file, an extra file, a size difference and a changed file of the same size", () => {
      const result = compareStorage(
        [row("missing.txt"), row("size.txt", 3), row("same.txt", 3, md5)],
        new Map([
          ["avatars/size.txt", file(4)],
          ["avatars/same.txt", file(3, "ffffffffffffffffffffffffffffffff")],
          ["avatars/extra.txt", file(1)],
        ]),
      );
      expect(result).toMatchObject({
        missing: 1,
        extra: 1,
        sizeMismatch: 1,
        md5Mismatch: 1,
        mismatched: 4,
      });
    });

    it("does not compare MD5 for a multipart ETag, and treats a null size as a mismatch", () => {
      const multipart = compareStorage(
        [row("m.bin", 3, '"abc-2"')],
        new Map([["avatars/m.bin", file(3, "x")]]),
      );
      expect(multipart.mismatched).toBe(0);
      expect(multipart.md5Checked).toBe(0);
      expect(
        compareStorage(
          [row("n.bin", null)],
          new Map([["avatars/n.bin", file(3)]]),
        ).sizeMismatch,
      ).toBe(1);
    });
  });
});

describe("backup:check metadata files (AC6, G8)", () => {
  const hosted = {
    counts: {
      "auth.users": 1,
      "auth.identities": 1,
      "storage.objects": 0,
      "public.a": 2,
    },
    migrations: ["20261021000000"],
    versions: {
      postgres: "17.6.1.052",
      gotrue: "v2.197.0",
      storage: "v1.80.2",
    },
  };

  it("accepts a complete hosted.json", () => {
    expect(validateHosted(hosted)).toMatchObject({ problems: [] });
  });

  it.each([
    ["not an object", [], /not an object/],
    ["no counts", { ...hosted, counts: undefined }, /no counts/],
    [
      "a negative count",
      { ...hosted, counts: { ...hosted.counts, "public.a": -1 } },
      /invalid entry/,
    ],
    [
      "a fractional count",
      { ...hosted, counts: { ...hosted.counts, "public.a": 1.5 } },
      /invalid entry/,
    ],
    [
      "an unqualified table",
      { ...hosted, counts: { ...hosted.counts, a: 1 } },
      /invalid entry/,
    ],
    [
      "no auth.users count",
      { ...hosted, counts: { "auth.identities": 1, "storage.objects": 0 } },
      /auth\.users/,
    ],
    ["no migrations", { ...hosted, migrations: [] }, /migrations/],
    [
      "no version",
      { ...hosted, versions: { postgres: "1", gotrue: "2" } },
      /storage/,
    ],
  ])("rejects %s", (_name, value, cause) => {
    const result = validateHosted(value);
    expect(result.hosted).toBeNull();
    expect(result.problems.join("\n")).toMatch(cause);
  });

  it("names the field, never the value, in a problem", () => {
    const text = validateHosted({
      ...hosted,
      counts: { ...hosted.counts, "public.secret_table": "VALUE-123" },
    }).problems.join("\n");
    expect(text).not.toMatch(/VALUE-123/);
  });

  it("requires time, cli and versions in the manifest", () => {
    expect(validateManifest({ time: "t", cli: "2", versions: {} })).toEqual([]);
    expect(validateManifest({ cli: "2", versions: {} })[0]).toMatch(/time/);
    expect(validateManifest(null)[0]).toMatch(/not an object/);
  });

  it("flags a pinned service version that differs from the backup's hosted version", () => {
    const pinned = {
      "postgres-version": "17.6.1.052",
      "gotrue-version": "v2.197.0",
      "storage-version": "v1.80.2",
    };
    expect(versionMismatches(pinned, hosted.versions)).toEqual([]);
    expect(
      versionMismatches(pinned, { ...hosted.versions, gotrue: "v2.198.0" }),
    ).toEqual(["gotrue"]);
    expect(versionMismatches({}, hosted.versions)).toEqual([
      "postgres",
      "gotrue",
      "storage",
    ]);
  });
});

describe("backup:check error reduction (AC8)", () => {
  it("keeps the step, exit code and SQLSTATE and drops every other line", () => {
    const reduced = reduceFailure({
      step: "data",
      exitCode: 3,
      stderr:
        'psql:<stdin>:12: ERROR:  22P02\nDETAIL: invalid input "secret@example.com"\nHINT: MARKER-7f3a9c\n',
      stdout: "a row with MARKER-7f3a9c\n",
    });
    expect(reduced).toEqual({ step: "data", exitCode: 3, sqlstate: "22P02" });
    expect(JSON.stringify(reduced)).not.toMatch(/MARKER|secret/);
  });

  it("does not take an error line that carries a message as a SQLSTATE", () => {
    const reduced = reduceFailure({
      step: "schema",
      exitCode: 3,
      stderr:
        'ERROR:  invalid input syntax for type integer: "MARKER-7f3a9c"\n',
    });
    expect(reduced.sqlstate).toBe("unknown");
  });

  it("reads FATAL lines and plain ERROR lines without the psql prefix", () => {
    expect(
      reduceFailure({ step: "q", exitCode: 2, stderr: "FATAL:  28P01\n" })
        .sqlstate,
    ).toBe("28P01");
    expect(
      reduceFailure({ step: "q", exitCode: 2, stdout: "ERROR:  42P01\n" })
        .sqlstate,
    ).toBe("42P01");
  });
});

describe("backup:check scratch database container (G7)", () => {
  const inspect = {
    Name: "/supabase_db_devspace-backup-check",
    Config: {
      Image: "public.ecr.aws/supabase/postgres:17.6.1.052",
      Entrypoint: ["sh"],
      Cmd: ["-c", "exec docker-entrypoint.sh postgres -D /etc/postgresql"],
      Env: ["POSTGRES_PASSWORD=postgres", "JWT_EXP=3600"],
      Labels: { "com.supabase.cli.project": SCRATCH_PROJECT_ID },
      Healthcheck: {
        Test: ["CMD-SHELL", "pg_isready -U postgres -h 127.0.0.1 -p 5432"],
        Interval: 10_000_000_000,
        Timeout: 2_000_000_000,
        Retries: 3,
      },
    },
    HostConfig: {
      Binds: ["supabase_db_devspace-backup-check:/var/lib/postgresql/data"],
      RestartPolicy: { Name: "unless-stopped" },
      ShmSize: 67108864,
      PortBindings: { "5432/tcp": [{ HostIp: "", HostPort: "56322" }] },
    },
    NetworkSettings: {
      Networks: {
        supabase_network_devspace_backup_check: {
          Aliases: ["db", "db.supabase.internal"],
        },
      },
    },
  };

  it("republishes only the database port, on 127.0.0.1", () => {
    const args = loopbackRunArgs(inspect, SCRATCH_PORTS.db);
    expect(args.slice(0, 4)).toEqual([
      "run",
      "-d",
      "--name",
      "supabase_db_devspace-backup-check",
    ]);
    expect(args).toContain("127.0.0.1:56322:5432");
    expect(args.filter((a) => a === "--publish")).toHaveLength(1);
    expect(args.join(" ")).not.toMatch(/0\.0\.0\.0/);
  });

  it("copies the labels, environment, volume, network aliases, health check, image and command unchanged", () => {
    const args = loopbackRunArgs(inspect, SCRATCH_PORTS.db);
    const pairs = (flag: string) =>
      args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []));
    expect(pairs("--label")).toEqual([
      `com.supabase.cli.project=${SCRATCH_PROJECT_ID}`,
    ]);
    expect(pairs("--env")).toEqual([
      "POSTGRES_PASSWORD=postgres",
      "JWT_EXP=3600",
    ]);
    expect(pairs("--volume")).toEqual([
      "supabase_db_devspace-backup-check:/var/lib/postgresql/data",
    ]);
    expect(pairs("--network-alias")).toEqual(["db", "db.supabase.internal"]);
    expect(pairs("--health-cmd")).toEqual([
      "pg_isready -U postgres -h 127.0.0.1 -p 5432",
    ]);
    expect(pairs("--health-interval")).toEqual(["10000ms"]);
    expect(pairs("--entrypoint")).toEqual(["sh"]);
    expect(args.slice(-3)).toEqual([
      "public.ecr.aws/supabase/postgres:17.6.1.052",
      "-c",
      "exec docker-entrypoint.sh postgres -D /etc/postgresql",
    ]);
  });

  it("refuses to rebuild a container with no image or network", () => {
    expect(() => loopbackRunArgs({ ...inspect, Config: {} }, 1)).toThrow(
      /image/,
    );
    expect(() =>
      loopbackRunArgs({ ...inspect, NetworkSettings: {} }, 1),
    ).toThrow(/network/);
  });

  it("accepts only a single loopback publication of the database port", () => {
    const only = { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "56322" }] };
    expect(isLoopbackOnly(only, 56322)).toBe(true);
    expect(
      isLoopbackOnly(
        { "5432/tcp": [{ HostIp: "0.0.0.0", HostPort: "56322" }] },
        56322,
      ),
    ).toBe(false);
    expect(
      isLoopbackOnly(
        { "5432/tcp": [{ HostIp: "", HostPort: "56322" }] },
        56322,
      ),
    ).toBe(false);
    expect(
      isLoopbackOnly(
        {
          ...only,
          "5432/tcp": [
            ...only["5432/tcp"],
            { HostIp: "::", HostPort: "56322" },
          ],
        },
        56322,
      ),
    ).toBe(false);
    expect(
      isLoopbackOnly(
        { ...only, "8000/tcp": [{ HostIp: "127.0.0.1", HostPort: "1" }] },
        56322,
      ),
    ).toBe(false);
    expect(
      isLoopbackOnly(
        { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "54322" }] },
        56322,
      ),
    ).toBe(false);
    expect(isLoopbackOnly({ "5432/tcp": null }, 56322)).toBe(false);
    expect(isLoopbackOnly(undefined, 56322)).toBe(false);
  });
});

describe("backup:check scratch config (G7, G8)", () => {
  const source = [
    'project_id = "devspace"',
    "[api]",
    "port = 54321",
    "[db]",
    "port = 54322",
    "shadow_port = 54320",
    "[db.pooler]",
    "port = 54329",
    "[studio]",
    "enabled = true",
    "port = 54323",
    "[analytics]",
    "port = 54327",
    "[edge_runtime]",
    "inspector_port = 8083",
    "",
  ].join("\n");

  it("moves every port and the project id to the scratch values", () => {
    const text = generateScratchConfig(source);
    expect(text).toContain(`project_id = "${SCRATCH_PROJECT_ID}"`);
    expect(text).toContain(`[db]\nport = ${SCRATCH_PORTS.db}`);
    expect(text).not.toMatch(/5432\d/);
    expect(text).toContain("[studio]\nenabled = false");
  });

  it("fails when a key the scratch config must rewrite is missing", () => {
    expect(() =>
      generateScratchConfig(source.replace("shadow_port = 54320\n", "")),
    ).toThrow(/shadow_port/);
  });
});

describe("backup:check refusals before any write (AC10)", () => {
  const engine = (
    containers: unknown[] = [],
    host = "npipe:////./pipe/docker_engine",
  ) => ({
    host: () => host,
    containers: () => containers,
  });
  const goodHosted = {
    counts: { "auth.users": 1, "auth.identities": 1, "storage.objects": 0 },
    migrations: ["1"],
    versions: { postgres: "1", gotrue: "2", storage: "3" },
  };
  const goodManifest = { time: "t", cli: "2.121.0", versions: {} };
  const folder = "C:\\Users\\khang\\devspace-backups\\20261108-1200";

  const run = (overrides: Record<string, unknown> = {}) => {
    const io = {
      listFolder: () => [...REQUIRED_FILES, "storage"],
      readJson: (file: string) =>
        file.endsWith("hosted.json") ? goodHosted : goodManifest,
      ...overrides,
    };
    // The two halves of the refusals: the file system first (no Docker, no lock), then Docker (once the run is owned).
    const files = preflightFiles({
      folder: (overrides.folder as string) ?? folder,
      rootDir: ROOT,
      env: WIN.env as unknown as NodeJS.ProcessEnv,
      home: WIN.home,
      platform: "win32",
      io: io as never,
    });
    if (files.refusal) return files;
    return preflightDocker((overrides.engine as never) ?? engine());
  };

  it("passes a complete backup with nothing running", () => {
    expect(run()).toEqual({ refusal: null });
  });

  it("refuses a folder inside the repository or under AppData, naming the cause", () => {
    expect(run({ folder: "C:\\DevSpace\\backups" }).refusal).toMatch(
      /inside the repository/,
    );
    expect(
      run({ folder: "C:\\Users\\khang\\AppData\\Local\\b" }).refusal,
    ).toMatch(/AppData/);
  });

  it("refuses a folder that is missing or lacks a required file", () => {
    expect(
      run({
        listFolder: () => {
          throw new Error("ENOENT");
        },
      }).refusal,
    ).toMatch(/does not exist/);
    for (const name of REQUIRED_FILES) {
      const result = run({
        listFolder: () => REQUIRED_FILES.filter((n) => n !== name),
      });
      expect(result.refusal, name).toContain(name);
    }
    expect(missingRequiredFiles(["roles.sql"])).toContain("data.sql");
  });

  it("refuses an unreadable or invalid hosted.json and manifest.json", () => {
    expect(run({ readJson: () => null }).refusal).toMatch(/manifest\.json/);
    expect(
      run({
        readJson: (file: string) =>
          file.endsWith("hosted.json") ? { counts: {} } : goodManifest,
      }).refusal,
    ).toMatch(/hosted\.json/);
  });

  it("refuses a container of another project on a scratch port", () => {
    const other = {
      name: "supabase_db_devspace-local",
      project: "devspace-local",
      state: "running",
      ports: [SCRATCH_PORTS.db],
    };
    const result = run({ engine: engine([other]) });
    expect(result.refusal).toMatch(
      /another project holds a scratch port \(supabase_db_devspace-local\)/,
    );
    expect(
      foreignPortHolders([other], [SCRATCH_PORTS.db], SCRATCH_PROJECT_ID),
    ).toEqual(["supabase_db_devspace-local"]);
    const own = {
      ...other,
      name: "supabase_db_devspace-backup-check",
      project: SCRATCH_PROJECT_ID,
    };
    expect(
      foreignPortHolders([own], [SCRATCH_PORTS.db], SCRATCH_PROJECT_ID),
    ).toEqual([]);
  });

  it("refuses a container named like a scratch container that belongs to another project", () => {
    const lookalike = {
      name: "supabase_db_devspace-backup-check",
      project: "other",
      state: "running",
      ports: [],
    };
    expect(run({ engine: engine([lookalike]) }).refusal).toMatch(
      /belongs to another project/,
    );
  });

  it("refuses a Docker engine that is not local", () => {
    expect(run({ engine: engine([], "tcp://10.0.0.5:2375") }).refusal).toMatch(
      /Docker identity check failed/,
    );
  });

  it("checks the path before it reads anything", () => {
    let read = false;
    run({
      folder: "C:\\DevSpace\\x",
      listFolder: () => {
        read = true;
        return [];
      },
    });
    expect(read).toBe(false);
  });
});

describe("backup:check arguments and report", () => {
  it("reads a JSON file with a byte order mark, as Windows PowerShell writes it", () => {
    const dir = mkdtempSync(join(tmpdir(), "backup-check-"));
    try {
      writeFileSync(join(dir, "a.json"), '﻿{"ok":true}');
      expect(readJsonFile(join(dir, "a.json"))).toEqual({ ok: true });
      writeFileSync(join(dir, "b.json"), "{not json");
      expect(() => readJsonFile(join(dir, "b.json"))).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("accepts one folder or --teardown, with or without npm's separator", () => {
    expect(parseArgs(["C:\\b"])).toEqual({ folder: "C:\\b" });
    expect(parseArgs(["--", "C:\\b"])).toEqual({ folder: "C:\\b" });
    expect(parseArgs(["--teardown"])).toEqual({ teardown: true });
    expect(() => parseArgs([])).toThrow(/usage/);
    expect(() => parseArgs(["a", "b"])).toThrow(/usage/);
    expect(() => parseArgs(["--other"])).toThrow(/usage/);
  });

  it("prints counts and pass/fail only", () => {
    const lines = formatReport({
      a: { checked: 40, mismatched: [] },
      b: {
        checked: 17,
        mismatched: [{ table: "public.a", expected: 3, actual: 2 }],
      },
      c: { equal: true, hosted: 12, restored: 12, missing: 0, extra: 0 },
      d: {
        rows: 3,
        files: 3,
        mismatched: 0,
        md5Checked: 3,
        names: ["missing file: avatars/secret-name.png"],
      },
    });
    expect(lines).toHaveLength(4);
    expect(lines[1]).toMatch(/FAIL/);
    expect(lines.join("\n")).not.toMatch(/secret-name/);
    expect(
      mismatchLines("(b)", [{ table: "public.a", expected: 3, actual: 2 }]),
    ).toEqual(["(b) public.a: expected 3, restored 2"]);
  });
});
