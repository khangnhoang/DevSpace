// Test plan
// Goal: coordinator death between real side effects never releases the target or permits late residue.
// Layer: rls plus controlled subprocess/HTTP lifecycle using the normal Node preload and recovery API.
// Subject: durable writer/request journal and explicit same-target recovery.
// Allowed paths: recover exact recorded resources only after every writer stops and outbound requests settle.
// Denied paths: live owner, wrong target, another contender and unknown request outcome.
// Known bugs: none.
// Invariants: outer RLS ownership protects the real stack; the private experiment and sentinel are probe-owned.
import { expect, inject, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { FixtureScope, type RunReference } from "../helpers/fixture-ownership";
import { acquireRun, inspectRun, alive, recordEntry, forgetEntry } from "../helpers/run-ownership.mjs";
import { recoverOwnedRun } from "../../scripts/test-data/recovery.mjs";
import { fixtures, must, IDS } from "./helpers";

it("retains a killed coordinator's paused writer and recovers without late or unrelated loss", async () => {
  const root = mkdtempSync(join(tmpdir(), "devspace-real-recovery-probe-"));
  const stack = inject("localStack");
  const outer = inject("ownership");
  const sentinel = new FixtureScope(outer, fixtures, stack.dbUrl);
  const experiment = recordEntry(outer, { kind: "experiment", scope: "lifecycle-experiment", root });
  const title = sentinel.label("E2E manual sentinel");
  const proc = spawn(process.execPath, [join(process.cwd(), "__tests__/helpers/probes/lifecycle-coordinator.mjs"), root], { stdio: ["ignore", "pipe", "pipe"] });
  let ref: RunReference | undefined;
  let first = "", later = "", port = 0;
  let writerScope = "";
  let request: Promise<unknown> | undefined;
  let buffer = "";
  let stderr = "";
  let bodyFailure: unknown;
  proc.stderr!.on("data", data => { stderr += String(data); });
  const messages = new Map<string, () => void>();
  const waitFor = (phase: string) => new Promise<void>(resolve => messages.set(phase, resolve));
  const listening = waitFor("listening"), written = waitFor("first-written");
  proc.stdout!.on("data", chunk => {
    buffer += String(chunk);
    while (buffer.includes("\n")) {
      const end = buffer.indexOf("\n"); const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      const value = JSON.parse(line);
      if (value.ref) ref = value.ref;
      if (value.port) port = value.port;
      if (value.scope) writerScope = value.scope;
      if (value.first) { first = value.first; later = value.later; }
      messages.get(value.phase)?.();
    }
  });
  try {
    await sentinel.reserve("notifications", { title });
    must(await fixtures.from("notifications").insert({ receiver_id: IDS.learner, title, type: "system" }));
    await Promise.race([listening, once(proc, "exit").then(() => { throw new Error(`probe startup failed: ${stderr}`); })]);
    request = fetch(`http://127.0.0.1:${port}`, { method: "POST", headers: { "X-DevSpace-Fixture-Scope": writerScope } }).then(response => response.text()).catch(() => undefined);
    await written;
    expect(ref).toBeDefined();
    const run = ref!;
    expect(must(await fixtures.from("notifications").select("id").eq("title", first))).toHaveLength(1);
    expect(inspectRun(run).entries.some(entry => entry.kind === "http")).toBe(true);
    await expect(recoverOwnedRun(run, stack)).rejects.toThrow("writer is alive");
    await expect(recoverOwnedRun({ ...run, target: { ...run.target, database: "wrong" } }, stack)).rejects.toThrow("target differs");
    const moduleUrl = pathToFileURL(join(process.cwd(), "__tests__/helpers/run-ownership.mjs")).href;
    const contender = spawnSync(process.execPath, ["--input-type=module", "-e", `import {acquireRun} from ${JSON.stringify(moduleUrl)}; acquireRun(${JSON.stringify(run.target)},'contender',${JSON.stringify(root)});`], { encoding: "utf8" });
    expect(contender.status).not.toBe(0); expect(contender.stderr).toContain("already owned");
    const exited = once(proc, "exit"); proc.kill(); await exited;
    expect(() => acquireRun(run.target, "contender", root)).toThrow("already owned");
    const deadline = Date.now() + 10_000;
    while (inspectRun(run).members.some(member => alive(member.pid)) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
    expect(inspectRun(run).members.every(member => !alive(member.pid))).toBe(true);
    await request;
    await recoverOwnedRun(run, stack);
    expect(must(await fixtures.from("notifications").select("id").in("title", [first, later]))).toEqual([]);
    expect(must(await fixtures.from("notifications").select("id").eq("title", title))).toHaveLength(1);
    const next = acquireRun(run.target, "contender", root);
    const { releaseRun } = await import("../helpers/run-ownership.mjs"); releaseRun(next);
  } catch (error) { bodyFailure = error; }
  finally {
    const failures: unknown[] = bodyFailure ? [bodyFailure] : [];
    if (proc.exitCode === null && proc.signalCode === null) { const exited = once(proc, "exit"); proc.kill(); await exited; }
    if (ref) {
      try { inspectRun(ref); await recoverOwnedRun(ref, stack); }
      catch (error) {
        // Never erase uncertain ownership evidence after a failing probe.
        if (!String(error).includes("ENOENT")) failures.push(error);
      }
    }
    try { await sentinel.cleanup(); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, `Lifecycle probe failed; preserve journal at ${root}`, { cause: failures[0] });
    forgetEntry(outer, experiment);
    rmSync(root, { recursive: true, force: true });
  }
}, 60_000);
