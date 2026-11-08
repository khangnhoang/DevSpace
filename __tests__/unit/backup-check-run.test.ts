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
  performRun,
  performTeardown,
  scanBackupFile,
} from "../../scripts/backup/check.mjs";
import { runLockDir } from "../../scripts/backup/config.mjs";
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
const common = () => ({
  folder,
  hosted: {} as never,
  rootDir: root,
  engine: {} as never,
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
      performTeardown({ rootDir: root, engine: {} as never, ops, startOf }),
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
      performTeardown({ rootDir: root, engine: {} as never, ops, startOf }),
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
      performTeardown({ rootDir: root, engine: {} as never, ops, startOf }),
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
