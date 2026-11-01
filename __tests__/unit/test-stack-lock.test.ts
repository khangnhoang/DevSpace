// Test plan
// Goal: the machine-wide lock, the writer records, the orphan stop and the run lifecycle keep their guarantees
// when processes die, race or outlive their run.
// Layer: unit with real subprocesses (no Docker, no database); the lifecycle runs with a stand-in for the stack.
// Subject: scripts/test-stack/lock.mjs, run.mjs, writer-preload.mjs and the unclean mark of FixtureScope.
// Allowed paths: one live holder, a clean run, a takeover of a stale lock, an orphan stopped by identity.
// Denied paths: a second live holder, an unreadable lock, a late registrant, a reused PID, a lost claim.
// Known bugs: none.
// Invariants: every state directory is a temporary one; every process a row starts is killed afterwards.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { compareSnapshots } from "../../scripts/test-stack/audit.mjs";
import { decideReset } from "../../scripts/test-stack/ensure.mjs";
import * as lock from "../../scripts/test-stack/lock.mjs";
import { childEnvironment } from "../../scripts/test-stack/run.mjs";
import { readState, stateDir, writeState } from "../../scripts/test-stack/state.mjs";

const root = process.cwd();
const probePath = join(root, "__tests__/helpers/stack-probe.mjs");
const preload = pathToFileURL(join(root, "scripts/test-stack/writer-preload.mjs")).href;

type Env = Record<string, string | undefined>;
type Event = { event: string; [key: string]: unknown };
let dir: string;
let started: ChildProcess[] = [];
// Processes a row detached on purpose (a grandchild the probe cannot reach), with the start time that identifies them.
let strays: { pid: number; start: string | null }[] = [];

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "devspace-stack-lock-")); });
afterEach(async () => {
  for (const child of started) { try { child.kill("SIGKILL"); } catch { /* gone */ } }
  started = [];
  // Only the exact process that was recorded is stopped, never a later one that reused the PID.
  for (const { pid, start } of strays) {
    if (lock.pidAlive(pid) && lock.processStart(pid) === start) { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } }
    await gone(pid);
  }
  strays = [];
  rmSync(dir, { recursive: true, force: true });
});

// The real run this suite may be part of must not leak into the probes: they use their own state directory.
function environment(extra: Env = {}) {
  const env: Env = { ...process.env };
  delete env.DEVSPACE_TEST_RUN;
  delete env.DEVSPACE_TEST_RUN_DIR;
  env.NODE_OPTIONS = (env.NODE_OPTIONS ?? "").replace(/--import=\S*writer-preload\.mjs/, "").trim();
  return { ...env, STACK_PROBE_DIR: dir, ...extra };
}
const withPreload = (runId: string) => environment({ DEVSPACE_TEST_RUN: runId, DEVSPACE_TEST_RUN_DIR: dir, NODE_OPTIONS: `--import=${preload}` });

class Probe {
  readonly events: Event[] = [];
  readonly proc: ChildProcess;
  readonly exited: Promise<number | null>;
  constructor(mode: string, args: string[] = [], env: Env = environment()) {
    this.proc = spawn(process.execPath, [probePath, mode, ...args], { cwd: root, env: env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] });
    started.push(this.proc);
    let buffer = "";
    this.proc.stdout!.on("data", (chunk) => {
      buffer += chunk;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        try { this.events.push(JSON.parse(line)); } catch { /* not an event */ }
      }
    });
    this.proc.stderr!.resume();
    this.exited = new Promise((resolve) => this.proc.once("exit", resolve));
  }
  get pid() { return this.proc.pid!; }
  async event(name: string, timeout = 40_000): Promise<Event> {
    const deadline = Date.now() + timeout;
    for (;;) {
      const found = this.events.find((event) => event.event === name);
      if (found) return found;
      if (Date.now() > deadline) throw new Error(`no "${name}" event from probe ${this.pid}; saw ${JSON.stringify(this.events)}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  async kill() { this.proc.kill("SIGKILL"); await this.exited; }
}

const alive = (pid: number) => lock.pidAlive(pid);
async function gone(pid: number, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (alive(pid) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
  return !alive(pid);
}
const listing = () => readdirSync(dir).sort();
const writerFiles = () => (existsSync(join(dir, "writers")) ? readdirSync(join(dir, "writers")) : []);
function record(pid: number, runId = "earlier-run", start = lock.processStart(pid)) {
  mkdirSync(join(dir, "writers"), { recursive: true });
  writeFileSync(join(dir, "writers", `${runId}-${pid}-${start}.json`), JSON.stringify({ runId, pid, start, role: "test" }));
}
async function staleLock(command = "npm test (stale)") {
  const holder = new Probe("hold", [command]);
  await holder.event("held");
  await holder.kill();
}

describe("test stack lock", { timeout: 120_000 }, () => {
  it("refuses a second command while the holder is live, names the holder and changes nothing", async () => {
    const holder = new Probe("hold", ["npm test (holder)"]);
    await holder.event("held");
    const before = listing();
    expect(() => lock.acquireLock({ command: "npm run test:e2e", dir })).toThrow(new RegExp(`PID ${holder.pid} running "npm test \\(holder\\)"`));
    expect(listing()).toEqual(before);
  });

  it("lets exactly one of two simultaneous contenders from different checkouts take a stale lock", async () => {
    await staleLock();
    const barrier = join(dir, "..", `barrier-${Date.now()}`);
    const first = new Probe("contend", [barrier, join(dir, "checkout-a")]);
    const second = new Probe("contend", [barrier, join(dir, "checkout-b")]);
    writeFileSync(barrier, "");
    try {
      const outcomes = await Promise.all([first, second].map(async (probe) => {
        const deadline = Date.now() + 40_000;
        while (!probe.events.length && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
        return probe.events[0];
      }));
      expect(outcomes.filter((outcome) => outcome.event === "won")).toHaveLength(1);
      const loser = outcomes.find((outcome) => outcome.event === "refused")!;
      expect(["lost", "held"]).toContain(loser.code);
      const winner = outcomes.indexOf(outcomes.find((outcome) => outcome.event === "won")!) === 0 ? first : second;
      expect(lock.currentLock(dir)!.holder.pid).toBe(winner.pid);
    } finally { rmSync(barrier, { force: true }); }
  });

  it("refuses a lock file that cannot be parsed, names it and changes nothing", () => {
    writeFileSync(join(dir, "lock.1.json"), "{not json");
    const before = listing();
    expect(() => lock.acquireLock({ command: "npm test", dir })).toThrow(/lock\.1\.json cannot be parsed/);
    expect(listing()).toEqual(before);
    expect(readFileSync(join(dir, "lock.1.json"), "utf8")).toBe("{not json");
  });

  it("refuses a claim made on a pruned generation number after newer commands took the lock", async () => {
    await staleLock();
    const goFile = join(dir, "go");
    const contender = new Probe("pause-contend", [goFile]);
    await contender.event("read");
    // Two commands take and release the lock, then a third holds it; pruning frees generation 2, which the
    // paused contender is about to claim.
    await (async () => { const first = new Probe("acquire-release"); await first.event("released"); await first.exited; })();
    await (async () => { const second = new Probe("acquire-release"); await second.event("released"); await second.exited; })();
    const third = new Probe("hold", ["npm test (third)"]);
    await third.event("held");
    expect(existsSync(join(dir, "lock.2.json"))).toBe(false);
    const currentFile = join(dir, "lock.4.json");
    const before = readFileSync(currentFile, "utf8");

    writeFileSync(goFile, "");
    const outcome = await contender.event("refused");
    expect(outcome.code).toBe("lost");
    expect(readFileSync(currentFile, "utf8")).toBe(before);
    expect(existsSync(join(dir, "lock.2.json"))).toBe(false);
    expect(lock.currentLock(dir)!.holder.pid).toBe(third.pid);
    expect(listing().filter((name) => name.startsWith("tmp."))).toEqual([]);
  });

  it("stops a paused writer of a killed run from another checkout and tells the next run to reset", async () => {
    const dead = new Probe("run", ["hang-writer", join(dir, "checkout-a")]);
    const writer = (await dead.event("writer")).pid as number;
    await dead.kill();
    expect(alive(writer)).toBe(true);

    const next = new Probe("run", ["pass", join(dir, "checkout-b")]);
    const ensure = await next.event("ensure");
    expect(ensure).toMatchObject({ status: "dirty", kind: "a" });
    expect(await gone(writer)).toBe(true);
    expect((await next.event("done")).code).toBe(0);
  });

  it("stops a writer that registered after the first scan on the next scan, and deletes the records only then", async () => {
    const first = new Probe("idle"); const second = new Probe("idle");
    const firstPid = (await first.event("idle")).pid as number; const secondPid = (await second.event("idle")).pid as number;
    record(firstPid);
    await lock.reapOrphans({
      dir,
      waitMs: 10_000,
      stop: (pid: number) => { process.kill(pid, "SIGKILL"); if (pid === firstPid) record(secondPid); },
    });
    expect(await gone(firstPid)).toBe(true);
    expect(await gone(secondPid)).toBe(true);
    expect(writerFiles()).toEqual([]);
  });

  it("leaves a registrant of the dead run without the lock to exit before it writes anything", async () => {
    lock.acquireLock({ command: "npm test (new)", dir, runId: "new-run" });
    const marker = join(dir, "marker");
    const late = new Probe("late-write", [marker], withPreload("dead-run"));
    expect(await late.exited).toBe(1);
    expect(existsSync(marker)).toBe(false);

    const current = new Probe("late-write", [marker], withPreload("new-run"));
    expect(await current.exited).toBe(0);
    expect(existsSync(marker)).toBe(true);
  });

  it("registers many writers at once without losing a record", async () => {
    lock.acquireLock({ command: "npm test (many)", dir, runId: "many-run" });
    const barrier = join(dir, "..", `many-${Date.now()}`);
    const probes = Array.from({ length: 12 }, () => new Probe("register", [barrier], environment({ DEVSPACE_TEST_RUN: "many-run" })));
    writeFileSync(barrier, "");
    try {
      const passed = await Promise.all(probes.map((probe) => probe.event("passed")));
      const files = writerFiles();
      expect(files).toHaveLength(12);
      for (const event of passed) expect(files.some((name) => name.startsWith(`many-run-${event.pid}-`))).toBe(true);
    } finally { rmSync(barrier, { force: true }); }
  });

  it("never loses a record that passed the lock check while a takeover scans", async () => {
    await staleLock();
    const stale = lock.currentLock(dir)!.holder.runId;
    const barrier = join(dir, "..", `race-${Date.now()}`);
    const probes = Array.from({ length: 8 }, () => new Probe("register", [barrier], environment({ DEVSPACE_TEST_RUN: stale })));
    writeFileSync(barrier, "");
    try {
      lock.acquireLock({ command: "npm test (taker)", dir, runId: "taker-run" });
      await lock.reapOrphans({ dir });
      await Promise.all(probes.map((probe) => Promise.race([probe.event("passed"), probe.event("lost")]).catch(() => undefined)));
      await new Promise((resolve) => setTimeout(resolve, 300));
      // A registrant that passed the check before the takeover has a record the scan saw, so it was stopped.
      for (const probe of probes) if (probe.events.some((event) => event.event === "passed")) expect(await gone(probe.pid)).toBe(true);
    } finally { rmSync(barrier, { force: true }); }
  });

  it("does not stop a reused PID, and does not stop an unrecorded child of a stopped writer", async () => {
    const unrelated = new Probe("idle");
    const unrelatedPid = (await unrelated.event("idle")).pid as number;
    record(unrelatedPid, "earlier-run", "1");

    const parent = new Probe("writer", ["spawn-unrecorded"]);
    await parent.event("passed");
    const childPid = (await parent.event("child")).pid as number;
    // The grandchild is detached, so afterEach cannot reach it through a Probe: record who it is to stop exactly it.
    strays.push({ pid: childPid, start: lock.processStart(childPid) });
    record(parent.pid);

    await lock.reapOrphans({ dir });
    expect(await gone(parent.pid)).toBe(true);
    expect(alive(unrelatedPid)).toBe(true);
    expect(alive(childPid)).toBe(true);
    expect(writerFiles()).toEqual([]);
  });

  it("waits for a run's writers by PID and confirms identity once at the end", async () => {
    const reused = new Probe("idle"); const live = new Probe("idle");
    const reusedPid = (await reused.event("idle")).pid as number; const livePid = (await live.event("idle")).pid as number;
    record(reusedPid, "this-run", "1");
    record(livePid, "this-run");
    const survivors = await lock.awaitRunWriters({ dir, runId: "this-run", timeoutMs: 300 });
    expect(survivors.map((writer: { pid: number }) => writer.pid)).toEqual([livePid]);
  });

  it("refuses to stop while a live command holds the lock, and takes a stale lock over for the stop", async () => {
    const holder = new Probe("hold", ["npm test (holder)"]);
    await holder.event("held");
    const refused = new Probe("stop");
    expect(await refused.event("refused")).toMatchObject({ code: "held" });
    expect(refused.events.some((event) => event.event === "stopped")).toBe(false);
    expect(lock.currentLock(dir)!.holder.pid).toBe(holder.pid);

    await holder.kill();
    const taken = new Probe("stop");
    await taken.event("stopped");
    await taken.event("done");
    expect(readState(dir)).toMatchObject({ status: "dirty" });
  });

  it("keeps the production directory fixed whatever the environment says, and hands a launcher's directory to its children", () => {
    const production = stateDir();
    const saved = { dir: process.env.DEVSPACE_TEST_STACK_DIR, data: process.env.ProgramData, runDir: process.env.DEVSPACE_TEST_RUN_DIR };
    try {
      process.env.DEVSPACE_TEST_STACK_DIR = join(dir, "other");
      process.env.ProgramData = join(dir, "elsewhere");
      process.env.DEVSPACE_TEST_RUN_DIR = join(dir, "forged");
      expect(stateDir()).toBe(production);
    } finally {
      for (const [key, value] of [["DEVSPACE_TEST_STACK_DIR", saved.dir], ["ProgramData", saved.data], ["DEVSPACE_TEST_RUN_DIR", saved.runDir]] as const) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
    expect(production).toMatch(/devspace-test-stack-v1$/);
    expect(childEnvironment("run-1", dir, {})).toMatchObject({ DEVSPACE_TEST_RUN: "run-1", DEVSPACE_TEST_RUN_DIR: dir });
    expect(lock.runContext({ DEVSPACE_TEST_RUN: "run-1", DEVSPACE_TEST_RUN_DIR: dir })).toEqual({ dir, runId: "run-1" });
  });

  it("counts a Linux zombie as exited and reads the start time of any process name", () => {
    const stat = "4242 (node (x) y) Z 1 4242 4242 0 -1 4194560 100 0 0 0 0 0 0 0 20 0 1 0 987654 1000 500";
    expect(lock.parseProcStat(stat)).toEqual({ state: "Z", start: "987654" });
    expect(lock.parseProcStat(stat.replace(" Z ", " S "))).toMatchObject({ state: "S" });
  });

  it("admits a process to a run only when it holds the lock and has its own writer record", () => {
    const env = { DEVSPACE_TEST_RUN: "guard-run" };
    expect(() => lock.requireActiveRun({ command: "npm test", env: {}, dir })).toThrow(/No test run is active.*npm test/);
    expect(() => lock.requireActiveRun({ command: "npm test", env, dir })).toThrow(/does not hold the test stack lock/);
    lock.acquireLock({ command: "npm test (guard)", dir, runId: "guard-run" });
    expect(() => lock.requireActiveRun({ command: "npm test", env, dir })).toThrow(/not registered as a writer/);
    lock.registerWriter({ dir, runId: "guard-run", role: "guard" });
    expect(() => lock.requireActiveRun({ command: "npm test", env, dir })).not.toThrow();
    expect(() => lock.requireActiveRun({ command: "npm test", env: { DEVSPACE_TEST_RUN: "other-run" }, dir })).toThrow(/does not hold/);
  });

  it("checks the writer record's content, not its file name, against this process", () => {
    const env = { DEVSPACE_TEST_RUN: "record-run" };
    lock.acquireLock({ command: "npm test (record)", dir, runId: "record-run" });
    const file = join(dir, "writers", `record-run-${process.pid}-x.json`);
    mkdirSync(join(dir, "writers"), { recursive: true });
    const refused = (pattern: RegExp) => expect(() => lock.requireActiveRun({ command: "npm test", env, dir })).toThrow(pattern);

    writeFileSync(file, "{not json");
    refused(/cannot be read or parsed/);
    writeFileSync(file, JSON.stringify({ runId: "record-run", pid: process.pid }));
    refused(/malformed/);
    writeFileSync(file, JSON.stringify({ runId: "other-run", pid: process.pid, start: lock.processStart(process.pid) }));
    refused(/malformed/);
    // An earlier process with the same PID: valid record, other start time.
    writeFileSync(file, JSON.stringify({ runId: "record-run", pid: process.pid, start: "1" }));
    refused(/earlier process with the same PID/);
    writeFileSync(file, JSON.stringify({ runId: "record-run", pid: process.pid, start: lock.processStart(process.pid) }));
    expect(() => lock.requireActiveRun({ command: "npm test", env, dir })).not.toThrow();
  });

  it("refuses a registration when the admission mark cannot be read, and names the mark", () => {
    lock.acquireLock({ command: "npm test (unreadable mark)", dir, runId: "mark-run" });
    // A directory in the mark's place fails to read with a code other than ENOENT, as a permission error would.
    mkdirSync(join(dir, "closed", "mark-run"), { recursive: true });
    expect(() => lock.registerWriter({ dir, runId: "mark-run", role: "late" })).toThrow(/admission mark .*mark-run cannot be read/);
  });

  it("exits a preloaded process with an unreadable admission mark before it writes anything", async () => {
    lock.acquireLock({ command: "npm test (unreadable mark)", dir, runId: "mark-run" });
    mkdirSync(join(dir, "closed", "mark-run"), { recursive: true });
    const marker = join(dir, "marker");
    expect(await new Probe("late-write", [marker], withPreload("mark-run")).exited).toBe(1);
    expect(existsSync(marker)).toBe(false);
  });

  it("refuses a registration once admission is closed, and keeps admitting before", () => {
    lock.acquireLock({ command: "npm test (admission)", dir, runId: "admission-run" });
    expect(() => lock.registerWriter({ dir, runId: "admission-run", role: "early" })).not.toThrow();
    lock.closeAdmission({ dir, runId: "admission-run" });
    lock.closeAdmission({ dir, runId: "admission-run" });
    expect(() => lock.registerWriter({ dir, runId: "admission-run", role: "late", start: "2" })).toThrow(/already finishing/);
  });

  it("treats an unreadable or unparseable state.json as unclean, so the next run resets", () => {
    writeFileSync(join(dir, "state.json"), "{broken");
    const state = readState(dir);
    expect(state.status).toBe("dirty");
    expect(decideReset({ state, hash: "h", fresh: false, force: false })).toMatchObject({ reset: true, kind: "a" });
  });
});

describe("test run lifecycle", { timeout: 120_000 }, () => {
  const clean = { status: "clean", resetHash: "h", snapshot: { tables: {} } };

  it("reaches clean with the launcher still alive, and releases the lock last", async () => {
    writeState(clean, dir);
    const launcher = new Probe("run", ["pass"]);
    await launcher.event("done");
    expect(readState(dir)).toMatchObject({ status: "clean", resetHash: "h" });
    expect(lock.currentLock(dir)!.released).toBe(true);
    expect(writerFiles()).toEqual([]);
  });

  it("ends clean when the tests fail but every cleanup succeeded", async () => {
    writeState(clean, dir);
    const launcher = new Probe("run", ["fail-tests"]);
    expect((await launcher.event("done")).code).toBe(1);
    expect(readState(dir)).toMatchObject({ status: "clean" });
  });

  it("ends dirty when the end-of-run audit finds residue, and reports it", async () => {
    writeState(clean, dir);
    const launcher = new Probe("run", ["residue"]);
    expect((await launcher.event("done")).code).toBe(1);
    expect(readState(dir)).toMatchObject({ status: "dirty" });
    expect(readState(dir).cause).toContain("end-of-run audit found residue: public.notes");
  });

  it("ends dirty after a failed cleanup, and every later scope of the run in another process refuses", async () => {
    writeState(clean, dir);
    const launcher = new Probe("run", ["fixture-failure"]);
    await launcher.event("cleanup-failed");
    expect((await launcher.event("refused")).message).toContain("Previous fixture cleanup is unresolved");
    expect((await launcher.event("done")).code).toBe(1);
    expect(readState(dir)).toMatchObject({ status: "dirty" });
    expect(readState(dir).cause).toContain("fixture cleanup failed");
  });

  it("refuses a writer that registers during the audit, so the run neither ends clean with it alive nor lets it write", async () => {
    writeState(clean, dir);
    const launcher = new Probe("run", ["late-register"]);
    const late = (await launcher.event("late-child")).pid as number;
    strays.push({ pid: late, start: lock.processStart(late) });
    const result = String((await launcher.event("late-result")).result);
    expect(result).toMatch(/^lost: .*already finishing/);
    expect((await launcher.event("done")).code).toBe(0);
    expect(await gone(late)).toBe(true);
    expect(readState(dir)).toMatchObject({ status: "clean" });
  });

  it("keeps a run with a surviving writer dirty, and the next command stops that writer", async () => {
    writeState(clean, dir);
    const leaking = new Probe("run", ["leak"]);
    const writer = (await leaking.event("writer")).pid as number;
    expect((await leaking.event("done")).code).toBe(1);
    expect(readState(dir)).toMatchObject({ status: "dirty" });
    expect(readState(dir).cause).toContain(`${writer} (`);
    expect(alive(writer)).toBe(true);
    expect(writerFiles().some((name) => name.includes(`-${writer}-`))).toBe(true);

    const next = new Probe("run", ["pass"]);
    expect(await next.event("ensure")).toMatchObject({ status: "dirty", kind: "a" });
    expect(await gone(writer)).toBe(true);
  });

  it.each([
    ["during the reset", "hang-mutate", "mutating"],
    ["before the clean write", "hang-audit", "auditing"],
  ])("leaves the run dirty when the launcher is killed %s", async (_name, scenario, ready) => {
    writeState(clean, dir);
    const launcher = new Probe("run", [scenario]);
    await launcher.event(ready);
    await launcher.kill();
    expect(readState(dir)).toMatchObject({ status: "dirty" });
    const next = new Probe("run", ["pass"]);
    expect(await next.event("ensure")).toMatchObject({ status: "dirty", kind: "a" });
    expect((await next.event("done")).code).toBe(0);
    expect(readState(dir)).toMatchObject({ status: "clean" });
  });

  it("treats a taken-over lock as unclean even when the state still reads clean", async () => {
    writeState(clean, dir);
    // The holder died right after publishing its lock, before it marked the state dirty.
    await staleLock();
    expect(readState(dir)).toMatchObject({ status: "clean" });
    const next = new Probe("run", ["pass"]);
    const ensure = await next.event("ensure");
    expect(ensure).toMatchObject({ status: "dirty", kind: "a" });
    expect(String(ensure.cause)).toContain("took over");
  });

  it("resets when a write landed after the last audit", () => {
    const saved = { tables: { "public.notes": { count: 1, hash: "a" }, "auth.users": { count: 3, hash: "b" } } };
    expect(compareSnapshots(saved, saved)).toEqual([]);
    const later = { tables: { "public.notes": { count: 2, hash: "c" }, "auth.users": { count: 3, hash: "x" } } };
    const drift = compareSnapshots(saved, later);
    expect(drift).toEqual(["public.notes: 1 rows at the last reset, 2 now", "auth.users: same 3 rows, content changed"]);
    expect(decideReset({ state: { status: "clean", resetHash: "h" }, hash: "h", fresh: false, force: false, drift: drift.join("; ") })).toMatchObject({ reset: true, kind: "a" });
  });
});
