// TM-U1 AC8 to AC10, G9: taking the run, the order of the saved result and the teardown, the exit codes and the
// output of a whole run. The lock is the real one (a temp directory stands for the
// checkout); Docker is replaced by the `ops` seam, because these rules are about order and ownership.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  ReadFailure,
  SafeError,
  acquireRun,
  interruptRun,
  main,
  performRun,
  performTeardown,
  saveResult,
  scanBackupFile,
  teardown,
} from "../../scripts/backup/check.mjs";
import {
  SCRATCH_NETWORK,
  SCRATCH_PROJECT_ID,
  runLockDir,
} from "../../scripts/backup/config.mjs";
import { REQUIRED_FILES } from "../../scripts/backup/core.mjs";
import { currentLock, processStart } from "../../scripts/test-stack/lock.mjs";

const MARKER = "SECRET-MARKER-4711";
let START: string;
beforeAll(() => {
  START = processStart(process.pid) as string;
});
// The process of every record these tests write is this one: "alive" is a start time equal to its own.
const startOf = (pid: number) => (pid === process.pid ? START : null);

let root: string;
let folder: string;
const dirs: string[] = [];
const temp = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
};
beforeEach(() => {
  root = temp("backup-run-root-");
  folder = temp("backup-run-folder-");
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

const lockDir = () => runLockDir(root);
const readRecord = (dir: string) => currentLock(runLockDir(dir))?.holder;
const lockFiles = () =>
  existsSync(lockDir())
    ? readdirSync(lockDir())
        .filter((n) => /^(lock|released)\./.test(n))
        .sort()
    : [];
const readSaved = () =>
  JSON.parse(readFileSync(join(folder, "check-result.json"), "utf8"));
const savePass = () =>
  writeFileSync(
    join(folder, "check-result.json"),
    JSON.stringify({ outcome: "pass" }),
  );
const printed = () =>
  (console.log as unknown as ReturnType<typeof vi.fn>).mock.calls
    .map((c) => String(c[0]))
    .join("\n");

/** A lock left by a process that is gone: this pid with a start time that is not its own (a reused pid). */
const writeStaleLock = () => {
  mkdirSync(lockDir(), { recursive: true });
  writeFileSync(
    join(lockDir(), "lock.1.json"),
    JSON.stringify({
      generation: 1,
      runId: "dead-run",
      pid: process.pid,
      start: "not-the-start-of-this-process",
      command: "backup:check",
      checkout: root,
      acquiredAt: "2026-11-08T00:00:00.000Z",
    }),
  );
};

const okResult = {
  a: { checked: 1, mismatched: [] },
  b: { checked: 1, mismatched: [] },
  c: { equal: true, hosted: 1, restored: 1, missing: 0, extra: 0 },
  d: {
    rows: 0,
    files: 0,
    mismatched: 0,
    md5Checked: 0,
    names: [] as string[],
  },
};
const removedNothing = { containers: 0, volumes: 0 };
// A local engine with no containers; `host` and `containers` are spies so a test can count the Docker calls.
const localEngine = (host = "npipe:////./pipe/docker_engine") => ({
  host: vi.fn(() => host),
  containers: vi.fn(() => [] as unknown[]),
});
const common = () => ({
  folder,
  hosted: {} as never,
  rootDir: root,
  engine: localEngine() as never,
  startOf,
});

describe("backup:check takes the run atomically (AC10, G9)", () => {
  it("lets exactly one of two processes that read the same free state take the run", () => {
    let inner: ReturnType<typeof acquireRun> | undefined;
    // The first process has read "no lock"; before it claims, the second process takes the run in full.
    const outer = () =>
      acquireRun({
        command: "backup:check",
        rootDir: root,
        startOf,
        afterRead: () => {
          inner = acquireRun({
            command: "backup:check",
            rootDir: root,
            startOf,
          });
        },
      });
    expect(outer).toThrow(/took the run first/);
    expect(inner?.generation).toBe(1);
    expect(lockFiles()).toEqual(["lock.1.json"]);
    expect(readRecord(root)?.runId).toBe(inner?.runId);
  });

  it("lets exactly one of two processes that both read the same stale record take it over", () => {
    writeStaleLock();
    let inner: ReturnType<typeof acquireRun> | undefined;
    const outer = () =>
      acquireRun({
        command: "backup:check",
        rootDir: root,
        startOf,
        afterRead: () => {
          inner = acquireRun({
            command: "backup:check",
            rootDir: root,
            startOf,
          });
        },
      });
    expect(outer).toThrow(/took the run first/);
    expect(inner?.generation).toBe(2);
    expect(inner?.tookOver?.holder.runId).toBe("dead-run");
    // The loser did not remove or replace the winner's record, and the winner's run is now live.
    expect(readRecord(root)?.runId).toBe(inner?.runId);
    expect(() =>
      acquireRun({ command: "backup:check", rootDir: root, startOf }),
    ).toThrow(/in progress/);
  });

  it("takes over a record of a dead process and cleans it as stale", () => {
    writeStaleLock();
    const lock = acquireRun({
      command: "backup:check",
      rootDir: root,
      startOf,
    });
    expect(lock.tookOver?.holder.runId).toBe("dead-run");
    expect(lockFiles()).toEqual(["lock.2.json"]);
  });

  it("refuses a second run while the owner is live, and a lock it cannot read", () => {
    acquireRun({ command: "backup:check", rootDir: root, startOf });
    expect(() =>
      acquireRun({ command: "backup:check", rootDir: root, startOf }),
    ).toThrow(/in progress/);
    writeFileSync(join(lockDir(), "lock.2.json"), "{not json");
    expect(() =>
      acquireRun({ command: "backup:check", rootDir: root, startOf }),
    ).toThrow(/cannot be read/);
  });
});

describe("backup:check run order and exit codes (AC9)", () => {
  it("refuses a run that cannot take the lock before any write or Docker action", async () => {
    savePass();
    const owner = acquireRun({
      command: "backup:check",
      rootDir: root,
      startOf,
    });
    const ops = { teardown: vi.fn(), execute: vi.fn() };
    expect(await performRun({ ...common(), ops })).toBe(3);
    expect(ops.teardown).not.toHaveBeenCalled();
    expect(ops.execute).not.toHaveBeenCalled();
    // The owner's saved result is untouched and its lock is the same record.
    expect(readSaved()).toEqual({ outcome: "pass" });
    expect(readRecord(root)?.runId).toBe(owner.runId);
    expect(lockFiles()).toEqual(["lock.1.json"]);
  });

  it("replaces a saved pass before the start-of-run cleanup and before every later step", async () => {
    savePass();
    writeStaleLock();
    const seen: string[] = [];
    const ops = {
      teardown: vi.fn(() => {
        seen.push(readSaved().outcome);
        return removedNothing;
      }),
      execute: vi.fn(async () => {
        seen.push(readSaved().outcome);
        return okResult;
      }),
    };
    expect(await performRun({ ...common(), ops })).toBe(0);
    // cleanup, execute, final teardown: the first two ran while the folder held no pass.
    expect(seen.slice(0, 2)).toEqual(["incomplete", "incomplete"]);
    expect(readSaved().outcome).toBe("pass");
  });

  it("ends unresolved with a saved non-pass result when the start-of-run cleanup cannot confirm the teardown", async () => {
    savePass();
    writeStaleLock();
    const ops = {
      teardown: vi.fn(() => {
        throw new SafeError(
          "Teardown is not confirmed; still present: volume x_devspace-backup-check.",
        );
      }),
      execute: vi.fn(),
    };
    expect(await performRun({ ...common(), ops })).toBe(2);
    expect(ops.execute).not.toHaveBeenCalled();
    expect(readSaved().outcome).toBe("unresolved");
    expect(readSaved().failure).toMatch(/not confirmed.*backup-check/);
    expect(printed()).toMatch(/result: unresolved/);
    // The owner does not release a run whose teardown is not confirmed.
    expect(lockFiles().some((n) => n.startsWith("released."))).toBe(false);
  });

  it("leaves a saved non-pass result when a later step fails", async () => {
    savePass();
    const ops = {
      teardown: vi.fn(() => removedNothing),
      execute: vi.fn(async () => {
        throw new ReadFailure({ step: "scan data file", code: "ENOENT" });
      }),
    };
    expect(await performRun({ ...common(), ops })).toBe(1);
    expect(readSaved().outcome).toBe("fail");
    expect(readSaved().failure).toBe(
      "FAIL: step scan data file failed (error code ENOENT)",
    );
    // The teardown was confirmed, so the lock is released.
    expect(lockFiles()).toEqual(["lock.1.json", "released.1"]);
  });

  it("ends unresolved when the final teardown is not confirmed, even after a pass", async () => {
    let calls = 0;
    const ops = {
      teardown: vi.fn(() => {
        if (++calls === 2) throw new SafeError("Teardown is not confirmed.");
        return removedNothing;
      }),
      execute: vi.fn(async () => okResult),
    };
    expect(await performRun({ ...common(), ops })).toBe(2);
    expect(readSaved().outcome).toBe("unresolved");
    expect(lockFiles().some((n) => n.startsWith("released."))).toBe(false);
  });

  it("removes the mismatch file of an earlier run that this run did not reproduce", async () => {
    writeFileSync(join(folder, "check-mismatches.txt"), `${MARKER}\n`);
    const ops = {
      teardown: vi.fn(() => removedNothing),
      execute: vi.fn(async () => okResult),
    };
    expect(await performRun({ ...common(), ops })).toBe(0);
    expect(existsSync(join(folder, "check-mismatches.txt"))).toBe(false);
  });
});

describe("backup:check --teardown shares the run (AC9, AC10)", () => {
  it("is refused while another process owns the run, with ownership unchanged and no Docker action", () => {
    const owner = acquireRun({
      command: "backup:check",
      rootDir: root,
      startOf,
    });
    const ops = { teardown: vi.fn(), execute: vi.fn() };
    expect(
      performTeardown({
        rootDir: root,
        engine: localEngine() as never,
        ops,
        startOf,
      }),
    ).toBe(3);
    expect(ops.teardown).not.toHaveBeenCalled();
    expect(readRecord(root)?.runId).toBe(owner.runId);
    expect(lockFiles()).toEqual(["lock.1.json"]);
  });

  it("ends unresolved, not failed, when the teardown is not confirmed", () => {
    const ops = {
      teardown: vi.fn(() => {
        throw new SafeError("Teardown is not confirmed; still present: x.");
      }),
      execute: vi.fn(),
    };
    expect(
      performTeardown({
        rootDir: root,
        engine: localEngine() as never,
        ops,
        startOf,
      }),
    ).toBe(2);
    expect(printed()).toMatch(/UNRESOLVED/);
    expect(lockFiles().some((n) => n.startsWith("released."))).toBe(false);
  });

  it("removes what a dead run left and releases the run", () => {
    writeStaleLock();
    const ops = {
      teardown: vi.fn(() => ({ containers: 2, volumes: 1 })),
      execute: vi.fn(),
    };
    expect(
      performTeardown({
        rootDir: root,
        engine: localEngine() as never,
        ops,
        startOf,
      }),
    ).toBe(0);
    expect(ops.teardown).toHaveBeenCalledTimes(1);
    expect(lockFiles()).toEqual(["lock.2.json", "released.2"]);
  });
});

describe("backup:check keeps backup content out of the output of a run (AC8)", () => {
  it("keeps a read error out of stdout and of the saved result for a whole run", async () => {
    writeFileSync(
      join(folder, "data.sql"),
      `COPY public."${MARKER}" (id) FROM stdin;\n1\n`,
    );
    const ops = {
      teardown: vi.fn(() => removedNothing),
      execute: vi.fn(async () => {
        await scanBackupFile(folder, "data.sql", "scan data file");
        return okResult;
      }),
    };
    expect(await performRun({ ...common(), ops })).toBe(1);
    expect(printed()).not.toContain(MARKER);
    expect(
      readFileSync(join(folder, "check-result.json"), "utf8"),
    ).not.toContain(MARKER);
    expect(printed()).toMatch(/step scan data file failed/);
  });
});

describe("backup:check keeps the run until its result is published (AC9, G9)", () => {
  it("refuses a second run that starts while the first publishes, so it cannot overwrite the next owner's result", async () => {
    savePass();
    let contender: number | undefined;
    let savedWhileContending: string | undefined;
    const contenderOps = { teardown: vi.fn(), execute: vi.fn() };
    const ops = {
      teardown: vi.fn(() => removedNothing),
      execute: vi.fn(async () => okResult),
      // The first run has finished its checks and its teardown and is about to publish.
      beforePublish: async () => {
        contender = await performRun({ ...common(), ops: contenderOps });
        savedWhileContending = readSaved().outcome;
      },
    };
    expect(await performRun({ ...common(), ops })).toBe(0);
    expect(contender).toBe(3);
    expect(contenderOps.teardown).not.toHaveBeenCalled();
    expect(contenderOps.execute).not.toHaveBeenCalled();
    // The contender wrote nothing: the first run's result is the only one, and it is the published pass.
    expect(savedWhileContending).toBe("incomplete");
    expect(readSaved().outcome).toBe("pass");
    // Ownership ended only after the result was published.
    expect(lockFiles()).toEqual(["lock.1.json", "released.1"]);
  });
});

describe("backup:check never leaves a saved pass when the final save fails (AC9)", () => {
  it("ends failed with a non-pass saved result when the names file cannot be settled", async () => {
    savePass();
    const ops = {
      teardown: vi.fn(() => removedNothing),
      execute: vi.fn(async () => {
        // The names file cannot be removed: it is a directory, so the auxiliary step of the final save fails.
        mkdirSync(join(folder, "check-mismatches.txt"));
        return okResult;
      }),
    };
    expect(await performRun({ ...common(), ops })).toBe(1);
    expect(readSaved().outcome).toBe("incomplete");
    expect(printed()).toMatch(/step save the result failed/);
    expect(printed()).toMatch(/result: fail/);
    // The teardown was confirmed, so the run is still released.
    expect(lockFiles()).toEqual(["lock.1.json", "released.1"]);
  });

  it("publishes by rename: a failure before the publish leaves the earlier result byte for byte, and no temporary file", () => {
    writeFileSync(
      join(folder, "check-result.json"),
      '{"outcome":"incomplete"}',
    );
    mkdirSync(join(folder, "check-mismatches.txt"));
    expect(() => saveResult(folder, okResult, "pass")).toThrow();
    expect(readFileSync(join(folder, "check-result.json"), "utf8")).toBe(
      '{"outcome":"incomplete"}',
    );
    rmSync(join(folder, "check-mismatches.txt"), { recursive: true });
    // A publish that fails after the temporary file was written removes it.
    rmSync(join(folder, "check-result.json"));
    mkdirSync(join(folder, "check-result.json"));
    expect(() => saveResult(folder, okResult, "pass")).toThrow();
    expect(existsSync(join(folder, "check-result.json.tmp"))).toBe(false);
  });
});

describe("backup:check interrupted run (AC9)", () => {
  const owned = () =>
    acquireRun({ command: "backup:check", rootDir: root, startOf });

  it("confirmed teardown: releases the run, exits 130 and saves no pass", () => {
    writeFileSync(
      join(folder, "check-result.json"),
      JSON.stringify({ outcome: "incomplete" }),
    );
    const ops = { teardown: vi.fn(() => removedNothing), execute: vi.fn() };
    const code = interruptRun({
      lock: owned(),
      folder,
      engine: {} as never,
      ops,
    });
    expect(code).toBe(130);
    expect(readSaved().outcome).toBe("incomplete");
    expect(lockFiles()).toEqual(["lock.1.json", "released.1"]);
  });

  it("unconfirmed teardown: keeps the run, prints UNRESOLVED, saves unresolved and exits 2", () => {
    writeFileSync(
      join(folder, "check-result.json"),
      JSON.stringify({ outcome: "incomplete" }),
    );
    const ops = {
      teardown: vi.fn(() => {
        throw new SafeError(
          "Teardown is not confirmed; container supabase_db_devspace-backup-check could not be removed (docker rm failed (exit 1)).",
        );
      }),
      execute: vi.fn(),
    };
    const code = interruptRun({
      lock: owned(),
      folder,
      engine: {} as never,
      ops,
    });
    expect(code).toBe(2);
    expect(printed()).toMatch(
      /UNRESOLVED: Teardown is not confirmed.*supabase_db_devspace-backup-check/,
    );
    expect(readSaved().outcome).toBe("unresolved");
    expect(readSaved().failure).toMatch(/^UNRESOLVED/);
    expect(lockFiles()).toEqual(["lock.1.json"]);
  });

  it("unconfirmed teardown replaces a saved pass even when the names file cannot be settled", () => {
    savePass();
    mkdirSync(join(folder, "check-mismatches.txt"));
    const ops = {
      teardown: vi.fn(() => {
        throw new SafeError("Teardown is not confirmed.");
      }),
      execute: vi.fn(),
    };
    expect(
      interruptRun({ lock: owned(), folder, engine: {} as never, ops }),
    ).toBe(2);
    expect(readSaved().outcome).toBe("unresolved");
  });

  it("is what a SIGINT during a run runs, and exits with its code", async () => {
    const before = process.listeners("SIGINT");
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    let calls = 0;
    const ops = {
      teardown: vi.fn(() => {
        // The first call is the start-of-run cleanup, the second is the interrupt's.
        if (++calls === 2) throw new SafeError("Teardown is not confirmed.");
        return removedNothing;
      }),
      execute: vi.fn(async () => {
        const added = process
          .listeners("SIGINT")
          .filter((listener) => !before.includes(listener));
        expect(added).toHaveLength(1);
        (added[0] as () => void)();
        return okResult;
      }),
    };
    await performRun({ ...common(), ops });
    expect(exit).toHaveBeenCalledWith(2);
    expect(printed()).toMatch(/UNRESOLVED: Teardown is not confirmed/);
    // The handlers do not outlive the run.
    expect(process.listeners("SIGINT")).toEqual(before);
  });
});

describe("backup:check Docker failures are reduced and name the resource (AC8, G9)", () => {
  const backupFolder = () => {
    for (const name of REQUIRED_FILES) writeFileSync(join(folder, name), "{}");
    writeFileSync(
      join(folder, "manifest.json"),
      JSON.stringify({ time: "t", cli: "2.121.0", versions: {} }),
    );
    writeFileSync(
      join(folder, "hosted.json"),
      JSON.stringify({
        counts: { "auth.users": 1, "auth.identities": 1, "storage.objects": 0 },
        migrations: ["1"],
        versions: { postgres: "1", gotrue: "2", storage: "3" },
      }),
    );
  };
  const failing = () => ({
    host: vi.fn(() => {
      throw new Error(`docker: error during connect ${MARKER}`);
    }),
    containers: vi.fn(() => [] as unknown[]),
  });
  const mainSeams = () => ({
    rootDir: root,
    startOf,
    refusePath: () => null,
  });

  it("prints a step and a code, never the message, when the Docker identity check fails during a check", async () => {
    backupFolder();
    savePass();
    const ops = { teardown: vi.fn(), execute: vi.fn() };
    const code = await main([folder], {
      ...mainSeams(),
      engine: failing() as never,
      ops,
    });
    expect(code).toBe(1);
    expect(printed()).not.toContain(MARKER);
    expect(printed()).toMatch(/step docker identity check failed \(error code/);
    // A failure to ask Docker is a failed run that holds the run: the earlier pass is replaced, and the run is released.
    expect(readSaved().outcome).toBe("fail");
    expect(readSaved().failure).toMatch(/step docker identity check failed/);
    expect(
      readFileSync(join(folder, "check-result.json"), "utf8"),
    ).not.toContain(MARKER);
    expect(lockFiles()).toEqual(["lock.1.json", "released.1"]);
    expect(ops.teardown).not.toHaveBeenCalled();
    expect(ops.execute).not.toHaveBeenCalled();
  });

  it("keeps exit code 1 and reports it reduced when the failed Docker query cannot replace the saved result", async () => {
    // The result file is a directory, so it cannot be replaced.
    mkdirSync(join(folder, "check-result.json"));
    const ops = { teardown: vi.fn(), execute: vi.fn() };
    const code = await performRun({
      ...common(),
      engine: failing() as never,
      ops,
    });
    expect(code).toBe(1);
    expect(printed()).not.toContain(MARKER);
    expect(printed()).toMatch(/step replace the saved result failed/);
    expect(lockFiles()).toEqual(["lock.1.json", "released.1"]);
  });

  describe("with a names file that cannot be settled (a directory)", () => {
    beforeEach(() => {
      backupFolder();
      savePass();
      mkdirSync(join(folder, "check-mismatches.txt"));
    });

    it("stops the saved pass before the start-of-run cleanup, after a successful Docker preflight", async () => {
      const seen: string[] = [];
      const ops = {
        teardown: vi.fn(() => {
          seen.push(readSaved().outcome);
          return removedNothing;
        }),
        execute: vi.fn(async () => okResult),
      };
      await main([folder], {
        ...mainSeams(),
        engine: localEngine() as never,
        ops,
      });
      // The first call is the cleanup before anything starts; the pass was already replaced.
      expect(seen[0]).toBe("incomplete");
      expect(readSaved().outcome).not.toBe("pass");
    });

    it("exits 1 with a non-pass saved result, without the message, when the Docker query fails", async () => {
      const ops = { teardown: vi.fn(), execute: vi.fn() };
      const code = await main([folder], {
        ...mainSeams(),
        engine: failing() as never,
        ops,
      });
      expect(code).toBe(1);
      expect(readSaved().outcome).toBe("fail");
      expect(
        readFileSync(join(folder, "check-result.json"), "utf8"),
      ).not.toContain(MARKER);
      expect(printed()).not.toContain(MARKER);
      expect(ops.teardown).not.toHaveBeenCalled();
    });
  });

  it("prints a step and a code, never the message, when the Docker identity check fails during --teardown", async () => {
    const ops = { teardown: vi.fn(), execute: vi.fn() };
    const code = await main(["--teardown"], {
      ...mainSeams(),
      engine: failing() as never,
      ops,
    });
    expect(code).toBe(2);
    expect(printed()).not.toContain(MARKER);
    expect(printed()).toMatch(
      /UNRESOLVED: step docker identity check failed \(error code/,
    );
    expect(ops.teardown).not.toHaveBeenCalled();
    // Removal is not confirmed, so the run stays owned for the next run to take over.
    expect(lockFiles()).toEqual(["lock.1.json"]);
  });

  const scratchContainer = {
    name: `supabase_db_${SCRATCH_PROJECT_ID}`,
    project: SCRATCH_PROJECT_ID,
    state: "running",
    ports: [],
  };
  const dockerRun =
    (volumes: string[], failOn: string) =>
    (args: string[]): string => {
      if (args.join(" ").startsWith(failOn))
        throw new Error(`stderr ${MARKER}`);
      if (args[0] === "volume" && args[1] === "ls") return volumes.join("\n");
      return "";
    };

  it("names the container whose removal failed, without the child's message", () => {
    const engine = {
      host: () => "npipe:////./pipe/docker_engine",
      containers: () => [scratchContainer],
    };
    let thrown: Error | undefined;
    try {
      teardown(engine as never, dockerRun([], "rm -f -v"));
    } catch (error) {
      thrown = error as Error;
    }
    expect(thrown).toBeInstanceOf(SafeError);
    expect(thrown?.message).toContain(scratchContainer.name);
    expect(thrown?.message).toMatch(/could not be removed/);
    expect(thrown?.message).not.toContain(MARKER);
  });

  it("names the volume whose removal failed, without the child's message", () => {
    const volume = `vol_${SCRATCH_PROJECT_ID}`;
    const engine = {
      host: () => "npipe:////./pipe/docker_engine",
      containers: () => [],
    };
    let thrown: Error | undefined;
    try {
      teardown(engine as never, dockerRun([volume], "volume rm"));
    } catch (error) {
      thrown = error as Error;
    }
    expect(thrown).toBeInstanceOf(SafeError);
    expect(thrown?.message).toContain(`volume ${volume}`);
    expect(thrown?.message).not.toContain(MARKER);
  });

  it("names the network whose removal failed", () => {
    const engine = {
      host: () => "npipe:////./pipe/docker_engine",
      containers: () => [],
    };
    const run = (args: string[]): string => {
      if (args[0] === "network" && args[1] === "ls") return SCRATCH_NETWORK;
      if (args[0] === "network" && args[1] === "rm")
        throw new Error(`stderr ${MARKER}`);
      return "";
    };
    expect(() => teardown(engine as never, run)).toThrow(
      new RegExp(`network ${SCRATCH_NETWORK}`),
    );
  });
});

describe("backup:check makes no Docker call before it owns the run (G9, AC10)", () => {
  const filesOk = () => {
    for (const name of REQUIRED_FILES) writeFileSync(join(folder, name), "{}");
    writeFileSync(
      join(folder, "manifest.json"),
      JSON.stringify({ time: "t", cli: "2.121.0", versions: {} }),
    );
    writeFileSync(
      join(folder, "hosted.json"),
      JSON.stringify({
        counts: { "auth.users": 1, "auth.identities": 1, "storage.objects": 0 },
        migrations: ["1"],
        versions: { postgres: "1", gotrue: "2", storage: "3" },
      }),
    );
  };
  const seams = () => ({ rootDir: root, startOf, refusePath: () => null });
  const noDocker = (engine: ReturnType<typeof localEngine>) => {
    expect(engine.host).not.toHaveBeenCalled();
    expect(engine.containers).not.toHaveBeenCalled();
  };

  it("refuses a check while another process owns the run, with zero Docker calls and the saved result untouched", async () => {
    filesOk();
    savePass();
    const owner = acquireRun({
      command: "backup:check",
      rootDir: root,
      startOf,
    });
    const engine = localEngine();
    const ops = { teardown: vi.fn(), execute: vi.fn() };
    expect(
      await main([folder], { ...seams(), engine: engine as never, ops }),
    ).toBe(3);
    noDocker(engine);
    expect(ops.teardown).not.toHaveBeenCalled();
    expect(readSaved()).toEqual({ outcome: "pass" });
    expect(readRecord(root)?.runId).toBe(owner.runId);
  });

  it("refuses --teardown while another process owns the run, with zero Docker calls", async () => {
    const owner = acquireRun({
      command: "backup:check",
      rootDir: root,
      startOf,
    });
    const engine = localEngine();
    const ops = { teardown: vi.fn(), execute: vi.fn() };
    expect(
      await main(["--teardown"], {
        ...seams(),
        engine: engine as never,
        ops,
      }),
    ).toBe(3);
    noDocker(engine);
    expect(ops.teardown).not.toHaveBeenCalled();
    expect(readRecord(root)?.runId).toBe(owner.runId);
  });

  it("refuses a folder that lacks a file before the lock and before any Docker call", async () => {
    const engine = localEngine();
    expect(await main([folder], { ...seams(), engine: engine as never })).toBe(
      3,
    );
    noDocker(engine);
    expect(lockFiles()).toEqual([]);
  });

  it("refuses a Docker engine that is not local after taking the run, leaves the saved result alone and releases the run", async () => {
    filesOk();
    savePass();
    const engine = localEngine("tcp://10.0.0.5:2375");
    const ops = { teardown: vi.fn(), execute: vi.fn() };
    expect(
      await main([folder], { ...seams(), engine: engine as never, ops }),
    ).toBe(3);
    expect(printed()).toMatch(/Docker identity check failed/);
    expect(readSaved()).toEqual({ outcome: "pass" });
    expect(ops.teardown).not.toHaveBeenCalled();
    expect(lockFiles()).toEqual(["lock.1.json", "released.1"]);
  });

  it("refuses --teardown on a Docker engine that is not local after taking the run, and releases the run", async () => {
    const engine = localEngine("tcp://10.0.0.5:2375");
    const ops = { teardown: vi.fn(), execute: vi.fn() };
    expect(
      await main(["--teardown"], {
        ...seams(),
        engine: engine as never,
        ops,
      }),
    ).toBe(3);
    expect(ops.teardown).not.toHaveBeenCalled();
    expect(lockFiles()).toEqual(["lock.1.json", "released.1"]);
  });

  it("still cleans up at the next run after a stale run was taken over and then released by a Docker refusal", async () => {
    writeStaleLock();
    savePass();
    expect(
      await performRun({
        ...common(),
        engine: localEngine("tcp://10.0.0.5:2375") as never,
        ops: { teardown: vi.fn(), execute: vi.fn() },
      }),
    ).toBe(3);
    // The takeover was released as a clean run, so the next one no longer knows a run was interrupted ...
    expect(lockFiles()).toEqual(["lock.2.json", "released.2"]);
    const order: string[] = [];
    const ops = {
      teardown: vi.fn(() => {
        order.push("teardown");
        return removedNothing;
      }),
      execute: vi.fn(async () => {
        order.push("execute");
        return okResult;
      }),
    };
    expect(await performRun({ ...common(), ops })).toBe(0);
    // ... but every run removes leftovers first, whatever the lock says.
    expect(order).toEqual(["teardown", "execute", "teardown"]);
  });
});
