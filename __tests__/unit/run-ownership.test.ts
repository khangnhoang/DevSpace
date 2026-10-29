// Test plan
// Goal: target ownership survives coordinator death and refuses live, foreign and unresolved writers.
// Layer: unit/subprocess, no database.
// Subject: shared journal protocol and inherited Node preload.
// Allowed paths: explicit release of an empty, settled run; explicit recovery of a dead empty run.
// Denied paths: same-target contention, live/stale implicit takeover, unresolved requests and descendants.
// Known bugs: none.
// Invariants: all processes and temporary coordination roots are owned by this probe.
import { afterEach, describe, expect, it } from "vitest";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { createServer } from "node:net";
import { assertUnmanagedReadiness } from "../helpers/local-readiness.mjs";
import { acquireRun, releaseRun, inspectRun, recordEntry, forgetEntry, runEnvironment, joinRun } from "../helpers/run-ownership.mjs";

const moduleUrl = pathToFileURL(join(process.cwd(), "__tests__/helpers/run-ownership.mjs")).href;
const roots: string[] = [];
const children: ChildProcess[] = [];
const target = { endpoint: "127.0.0.1:54322/postgres", project: "probe", database: "probe-db", gateway: "probe-api", api: "http://127.0.0.1:54321" };
const root = () => { const dir = mkdtempSync(join(tmpdir(), "devspace-ownership-probe-")); roots.push(dir); return dir; };
async function child(script: string, env = process.env) {
  const proc = spawn(process.execPath, ["--input-type=module", "-e", script], { env, stdio: ["ignore", "pipe", "pipe"] });
  children.push(proc);
  let output = "";
  await new Promise<void>((resolve, reject) => {
    proc.stdout!.on("data", data => { output += String(data); if (output.includes("\n")) resolve(); });
    proc.once("error", reject);
    proc.once("exit", code => { if (!output.includes("\n")) reject(new Error(`probe exited ${code}`)); });
  });
  return { proc, output };
}
afterEach(async () => {
  for (const proc of children.splice(0)) if (proc.exitCode === null && proc.signalCode === null) { const exited = once(proc, "exit"); proc.kill(); await exited; }
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("run ownership", { timeout: 20_000 }, () => {
  it("contends across independent processes/checkouts, including managed dev", () => {
    const dir = root();
    const ref = acquireRun(target, "dev", dir);
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `import {acquireRun} from ${JSON.stringify(moduleUrl)}; acquireRun(${JSON.stringify(target)}, 'rls', ${JSON.stringify(dir)});`], { cwd: root(), encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("already owned or unresolved");
    releaseRun(ref);
    releaseRun(acquireRun(target, "e2e", dir));
  });
  it("allows different targets independently", () => {
    const dir = root();
    const first = acquireRun(target, "e2e", dir);
    const second = acquireRun({ ...target, endpoint: "127.0.0.1:55000/postgres" }, "rls", dir);
    releaseRun(first); releaseRun(second);
  });
  it("does not steal ambiguous acquisition metadata", () => {
    const dir = root(); const ref = acquireRun(target, "rls", dir);
    expect(() => acquireRun(target, "rls", dir)).toThrow("already owned");
    expect(() => releaseRun({ ...ref, run: "foreign" })).toThrow("does not match");
    releaseRun(ref);
  });
  it("retains unsettled request evidence and supports idempotent cleanup at its caller", () => {
    const ref = acquireRun(target, "rls", root());
    const id = recordEntry(ref, { kind: "request", scope: "a", label: "outstanding mutation" });
    expect(() => releaseRun(ref)).toThrow("Unresolved");
    expect(inspectRun(ref).entries).toHaveLength(1);
    forgetEntry(ref, id); releaseRun(ref);
  });
  it("refuses recovery of a live owner or a mismatched target", () => {
    const ref = acquireRun(target, "rls", root());
    expect(() => releaseRun(ref, true)).toThrow("live/foreign");
    expect(() => releaseRun({ ...ref, target: { ...target, database: "wrong" } }, true)).toThrow("does not match");
    releaseRun(ref);
  });
  it("explicitly recovers a dead coordinator, never on ordinary acquisition", async () => {
    const dir = root();
    const { proc, output } = await child(`import {acquireRun} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(acquireRun(${JSON.stringify(target)}, 'probe', ${JSON.stringify(dir)}))); setInterval(()=>{},1000);`);
    const ref = JSON.parse(output.trim());
    const exited = once(proc, "exit"); proc.kill(); await exited;
    expect(() => acquireRun(target, "rls", dir)).toThrow("already owned");
    releaseRun(ref, true);
    releaseRun(acquireRun(target, "rls", dir));
  });
  it("holds ownership while a registered descendant remains alive", async () => {
    const dir = root(); const ref = acquireRun(target, "probe", dir);
    const { proc } = await child(`import {joinRun} from ${JSON.stringify(moduleUrl)}; joinRun(${JSON.stringify(ref)}); console.log('ready'); setInterval(()=>{},1000);`);
    expect(inspectRun(ref).members).toHaveLength(1);
    expect(() => releaseRun(ref)).toThrow("descendants");
    const exited = once(proc, "exit"); proc.kill(); await exited;
    releaseRun(ref);
  });
  it("registers preload descendants before application code", async () => {
    const ref = acquireRun(target, "probe", root());
    const { proc } = await child("console.log('ready'); setInterval(()=>{},1000);", runEnvironment(ref));
    expect(inspectRun(ref).members.map(member => member.pid)).toContain(proc.pid);
    const exited = once(proc, "exit"); proc.kill(); await exited;
    releaseRun(ref);
  });
  it("does not admit a forged process-tree reference", async () => {
    const dir = root(); const ref = acquireRun(target, "probe", dir);
    joinRun(ref);
    // The immutable owner record cannot be replaced by an environment value alone.
    const invalid = { ...ref, run: "00000000-0000-0000-0000-000000000000" };
    expect(() => runEnvironment(invalid)).toThrow("does not match");
    releaseRun(ref);
  });
  it("failed unmanaged readiness leaves the acquisition empty and releasable", async () => {
    const ref = acquireRun(target, "probe", root());
    const server = createServer();
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(3000, "127.0.0.1", resolve); });
    try {
      await expect(assertUnmanagedReadiness({ dbUrl: "never-used" })).rejects.toThrow("Port 3000 is in use");
      expect(inspectRun(ref).entries).toEqual([]);
      releaseRun(ref);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
  it("forwards a signal and releases only after its child stops", async () => {
    const dir = root();
    const managedUrl = pathToFileURL(join(process.cwd(), "__tests__/helpers/managed-run.mjs")).href;
    const { proc } = await child(`import {acquireRun} from ${JSON.stringify(moduleUrl)}; import {runManagedChild} from ${JSON.stringify(managedUrl)}; const ref=acquireRun(${JSON.stringify(target)},'probe',${JSON.stringify(dir)}); process.exitCode=await runManagedChild(ref,['-e',"console.log('ready'); setInterval(()=>{},1000)"]);`);
    const exited = once(proc, "exit"); proc.kill("SIGTERM"); await exited;
    // Windows terminates a process for SIGTERM without invoking JS handlers: explicit recovery is required.
    try { releaseRun(acquireRun(target, "probe", dir)); }
    catch (error) {
      expect(String(error)).toContain("already owned");
      const { readdirSync, readFileSync } = await import("node:fs");
      const owner = JSON.parse(readFileSync(join(dir, readdirSync(dir)[0], "owner.json"), "utf8"));
      const deadline = Date.now() + 5000;
      while (inspectRun(owner).members.some(member => {
        try { process.kill(member.pid, 0); return true; } catch { return false; }
      }) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
      releaseRun(owner, true);
    }
  });
});
