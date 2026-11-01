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
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, renameSync, unlinkSync, rmdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { assertUnmanagedReadiness } from "../helpers/local-readiness.mjs";
import { awaitWritersExit } from "../helpers/managed-run.mjs";
import { acquireRun, releaseRun, closeRun, inspectRun, recordEntry, forgetEntry, runEnvironment, joinRun, claimRecovery, closeScope, admitHttp, admitBrowserRequest, coordinationRoot, targetKey } from "../helpers/run-ownership.mjs";

const moduleUrl = pathToFileURL(join(process.cwd(), "__tests__/helpers/run-ownership.mjs")).href;
const roots: string[] = [];
const children: ChildProcess[] = [];
const target = { endpoint: "127.0.0.1:54322/postgres", project: "probe", database: "probe-db", gateway: "probe-api", api: "http://127.0.0.1:54321" };
const root = () => { const dir = mkdtempSync(join(tmpdir(), "devspace-ownership-probe-")); roots.push(dir); return dir; };
async function child(script: string, env = process.env) {
  const proc = spawn(process.execPath, ["--input-type=module", "-e", script], { env, stdio: ["ignore", "pipe", "pipe"] });
  children.push(proc);
  let output = "";
  let errors = "";
  proc.stderr!.on("data", data => { errors += String(data); });
  await new Promise<void>((resolve, reject) => {
    proc.stdout!.on("data", data => { output += String(data); if (output.includes("\n")) resolve(); });
    proc.once("error", reject);
    proc.once("exit", code => { if (!output.includes("\n")) reject(new Error(`probe exited ${code}`)); });
  });
  return { proc, output, errors: () => errors };
}
afterEach(async () => {
  for (const proc of children.splice(0)) if (proc.exitCode === null && proc.signalCode === null) { const exited = once(proc, "exit"); proc.kill(); await exited; }
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("run ownership", { timeout: 20_000 }, () => {
  it("waits for a writer gate before reading create/rename/remove and owner phase", async () => {
    const ref = acquireRun(target, "probe", root());
    const dir = join(ref.root, targetKey(ref.target));
    const gate = join(dir, "gate");
    const file = join(dir, "entries", "00000000-0000-0000-0000-000000000001.json");
    mkdirSync(gate);
    writeFileSync(`${file}.incomplete.tmp`, "{");
    const { proc, output: admission } = await child(`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const mkdir=fs.mkdirSync;let announced=false;fs.mkdirSync=(path,...args)=>{if(path===${JSON.stringify(gate)}&&!announced){announced=true;console.log('waiting');}return mkdir(path,...args);};syncBuiltinESMExports();const {inspectRun}=await import(${JSON.stringify(moduleUrl)});console.log(JSON.stringify(inspectRun(${JSON.stringify(ref)})));`);
    let output = "";
    proc.stdout!.on("data", data => { output += String(data); });
    const exited = once(proc, "exit");
    // Simulate the exact protected publication/removal steps while the reader waits.
    writeFileSync(`${file}.incomplete.tmp`, JSON.stringify({ id: "probe", kind: "request" }));
    renameSync(`${file}.incomplete.tmp`, file);
    unlinkSync(file);
    const owner = JSON.parse(readFileSync(join(dir, "owner.json"), "utf8"));
    writeFileSync(join(dir, "owner.json.next.tmp"), JSON.stringify({ ...owner, phase: "closing" }));
    renameSync(join(dir, "owner.json.next.tmp"), join(dir, "owner.json"));
    rmdirSync(gate);
    await exited;
    expect(admission.trim()).toBe("waiting");
    expect(proc.exitCode).toBe(0);
    expect(JSON.parse(output.trim())).toMatchObject({ owner: { phase: "closing" }, entries: [] });
    releaseRun(ref);
  });
  it("reads coherent snapshots while an independent process repeatedly publishes and removes entries", async () => {
    const ref = acquireRun(target, "probe", root());
    const { proc, errors } = await child(`import {recordEntry,forgetEntry} from ${JSON.stringify(moduleUrl)};console.log('ready');for(let n=0;n<1500;n++){const id=recordEntry(${JSON.stringify(ref)},{kind:'request',scope:'probe',payload:'x'.repeat(4096)});forgetEntry(${JSON.stringify(ref)},id);}`);
    let reads = 0;
    while (proc.exitCode === null && proc.signalCode === null) {
      const snapshot = inspectRun(ref);
      expect(snapshot.entries.length).toBeLessThanOrEqual(1);
      for (const entry of snapshot.entries) expect(entry.payload).toHaveLength(4096);
      reads++;
      await new Promise(resolve => setImmediate(resolve));
    }
    expect(proc.exitCode, errors()).toBe(0); expect(reads).toBeGreaterThan(0);
    expect(inspectRun(ref).entries).toEqual([]);
    releaseRun(ref);
  }, 60_000);
  it("retains interrupted artifacts and corrupt published metadata as explicit failures", () => {
    const ref = acquireRun(target, "probe", root());
    const dir = join(ref.root, targetKey(ref.target), "entries");
    const file = join(dir, "00000000-0000-0000-0000-000000000001.json");
    writeFileSync(`${file}.interrupted.tmp`, "{");
    expect(() => inspectRun(ref)).toThrow("Interrupted or unknown ownership metadata");
    unlinkSync(`${file}.interrupted.tmp`);
    writeFileSync(file, "{");
    expect(() => inspectRun(ref)).toThrow();
    // Only this probe's synthetic malformed evidence is removed, never real interrupted metadata.
    unlinkSync(file); releaseRun(ref);
  });
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
  it("fences late HTTP admission while retaining already admitted handlers", () => {
    const ref = acquireRun(target, "probe", root());
    const scope = recordEntry(ref, { kind: "scope", scope: "test", state: "open" });
    const http = admitHttp(ref, "test");
    closeScope(ref, "test");
    expect(() => recordEntry(ref, { kind: "scope", scope: "next", state: "open" })).toThrow("Previous fixture cleanup is unresolved");
    expect(() => admitHttp(ref, "test")).toThrow("no open fixture scope");
    expect(() => admitBrowserRequest(ref, "test", "/rest/v1/notes")).toThrow("no open fixture scope");
    expect(inspectRun(ref).entries.some(entry => entry.id === http)).toBe(true);
    expect(() => releaseRun(ref)).toThrow("Unresolved");
    forgetEntry(ref, http); forgetEntry(ref, scope); releaseRun(ref);
  });
  it("keeps the production coordination root independent of TEMP/HOME overrides", () => {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `import {coordinationRoot} from ${JSON.stringify(moduleUrl)}; console.log(coordinationRoot);`], { env: { ...process.env, HOME: root(), TEMP: root(), TMP: root(), ProgramData: root() }, encoding: "utf8" });
    expect(result.status).toBe(0); expect(result.stdout.trim()).toBe(coordinationRoot);
  });
  it.each(["dev", "e2e"])("preload preserves %s HTTP behavior and fences only test scopes", async mode => {
    const ref = acquireRun(target, mode, root());
    const marker = mode === "e2e" ? recordEntry(ref, { kind: "scope", scope: "http-probe", state: "open" }) : undefined;
    const { proc, output } = await child("import {createServer} from 'node:http'; const server=createServer((req,res)=>{res.end('ok'); if(req.url==='/shutdown') server.close();}); server.listen(0,'127.0.0.1',()=>console.log(server.address().port));", runEnvironment(ref));
    try {
      const url = `http://127.0.0.1:${Number(output.trim())}`;
      const headers = mode === "e2e" ? { "X-DevSpace-Fixture-Scope": "http-probe" } : undefined;
      expect(await (await fetch(url, { method: "POST", headers })).text()).toBe("ok");
      closeScope(ref, "http-probe");
      const late = await fetch(url, { method: "POST", headers });
      await late.text(); expect(late.status).toBe(mode === "e2e" ? 409 : 200);
      if (marker) forgetEntry(ref, marker);
      const exited = once(proc, "exit");
      await (await fetch(`${url}/shutdown`)).text();
      await exited;
    } finally {
      if (proc.exitCode === null && proc.signalCode === null) { const exited = once(proc, "exit"); proc.kill(); await exited; }
      releaseRun(ref);
    }
  });
  it("retains an aborted HTTP handler until its actual promise settles", async () => {
    const directory = root(), gate = join(directory, "continue");
    const ref = acquireRun(target, "e2e", directory);
    const marker = recordEntry(ref, { kind: "scope", scope: "abort-probe", state: "open" });
    const script = `import {createServer} from 'node:http'; import {existsSync} from 'node:fs'; const server=createServer(async(req,res)=>{if(req.url==='/shutdown'){res.end('closed');server.close();return;} res.writeHead(200);res.write('started');while(!existsSync(${JSON.stringify(gate)}))await new Promise(r=>setTimeout(r,10));res.end('done');});server.listen(0,'127.0.0.1',()=>console.log(server.address().port));`;
    const { proc, output } = await child(script, runEnvironment(ref));
    try {
      const url = `http://127.0.0.1:${Number(output.trim())}`;
      const controller = new AbortController();
      const response = await fetch(url, { method: "POST", signal: controller.signal, headers: { "X-DevSpace-Fixture-Scope": "abort-probe" } });
      controller.abort(); await response.text().catch(() => undefined);
      expect(inspectRun(ref).entries.some(entry => entry.kind === "http")).toBe(true);
      closeScope(ref, "abort-probe");
      writeFileSync(gate, "continue");
      const deadline = Date.now() + 5000;
      while (inspectRun(ref).entries.some(entry => entry.kind === "http") && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
      expect(inspectRun(ref).entries.some(entry => entry.kind === "http")).toBe(false);
      forgetEntry(ref, marker);
      const exited = once(proc, "exit"); await (await fetch(`${url}/shutdown`)).text(); await exited;
    } finally {
      if (proc.exitCode === null && proc.signalCode === null) { const exited = once(proc, "exit"); proc.kill(); await exited; }
      releaseRun(ref);
    }
  });
  it("refuses a detached mutation scheduled after its response handler ends", async () => {
    let writes = 0;
    const sink = createHttpServer((_request, response) => { writes++; response.end("unexpected write"); });
    await new Promise<void>(resolve => sink.listen(0, "127.0.0.1", resolve));
    const address = sink.address(); if (!address || typeof address === "string") throw new Error("No probe sink address");
    const api = `http://127.0.0.1:${address.port}`;
    const ref = acquireRun({ ...target, api }, "e2e", root());
    const marker = recordEntry(ref, { kind: "scope", scope: "late-probe", state: "open" });
    const script = `import {createServer} from 'node:http';const server=createServer((req,res)=>{res.end('ok');if(req.url==='/shutdown'){server.close();return;}setImmediate(async()=>{try{await fetch(${JSON.stringify(api)},{method:'POST'});console.log('late sent');}catch{console.log('late blocked');}});});server.listen(0,'127.0.0.1',()=>console.log(server.address().port));`;
    const { proc, output } = await child(script, runEnvironment(ref));
    try {
      const outcome = new Promise<string>(resolve => proc.stdout!.on("data", data => { const value = String(data); if (value.includes("late ")) resolve(value.trim()); }));
      const url = `http://127.0.0.1:${Number(output.trim())}`;
      await (await fetch(url, { method: "POST", headers: { "X-DevSpace-Fixture-Scope": "late-probe" } })).text();
      expect(await outcome).toBe("late blocked"); expect(writes).toBe(0);
      forgetEntry(ref, marker);
      const exited = once(proc, "exit"); await (await fetch(`${url}/shutdown`)).text(); await exited;
    } finally {
      if (proc.exitCode === null && proc.signalCode === null) { const exited = once(proc, "exit"); proc.kill(); await exited; }
      await new Promise<void>(resolve => sink.close(() => resolve()));
      releaseRun(ref);
    }
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
  it.each(["request", "unknown"])("explicit recovery refuses unresolved %s evidence", async kind => {
    const dir = root();
    const { proc, output } = await child(`import {acquireRun,recordEntry} from ${JSON.stringify(moduleUrl)}; const ref=acquireRun(${JSON.stringify(target)},'probe',${JSON.stringify(dir)}); recordEntry(ref,{kind:${JSON.stringify(kind)},scope:'probe'}); console.log(JSON.stringify(ref)); setInterval(()=>{},1000);`);
    const ref = JSON.parse(output.trim());
    const exited = once(proc, "exit"); proc.kill(); await exited;
    expect(() => claimRecovery(ref)).toThrow(kind === "request" ? "Unresolved outbound request" : "Unknown journal entry");
    expect(inspectRun(ref).entries).toHaveLength(1);
    // This probe never emitted a request; its own synthetic evidence can be removed after that assertion.
    forgetEntry(ref, inspectRun(ref).entries[0].id); releaseRun(ref, true);
  });
  it("holds ownership while a registered descendant remains alive", async () => {
    const dir = root(); const ref = acquireRun(target, "probe", dir);
    const { proc } = await child(`import {joinRun} from ${JSON.stringify(moduleUrl)}; joinRun(${JSON.stringify(ref)}); console.log('ready'); setInterval(()=>{},1000);`);
    expect(inspectRun(ref).members).toHaveLength(1);
    expect(() => releaseRun(ref)).toThrow("descendants");
    const exited = once(proc, "exit"); proc.kill(); await exited;
    releaseRun(ref);
  });
  it("releases after a closed run's registered writer exits within the deadline", async () => {
    const ref = acquireRun(target, "probe", root());
    const { proc } = await child(`import {joinRun} from ${JSON.stringify(moduleUrl)}; joinRun(${JSON.stringify(ref)}); console.log('ready'); setTimeout(()=>{},300);`);
    expect(() => releaseRun(ref)).toThrow("descendants");
    closeRun(ref);
    await awaitWritersExit(ref, 5000);
    expect(proc.exitCode ?? proc.signalCode).not.toBeNull();
    releaseRun(ref);
  });
  it("keeps ownership and the member record when a registered writer outlives the deadline", async () => {
    const ref = acquireRun(target, "probe", root());
    const { proc } = await child(`import {joinRun} from ${JSON.stringify(moduleUrl)}; joinRun(${JSON.stringify(ref)}); console.log('ready'); setInterval(()=>{},1000);`);
    closeRun(ref);
    const started = Date.now();
    await awaitWritersExit(ref, 200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(200);
    expect(() => releaseRun(ref)).toThrow("Writer descendants are still alive; ownership retained");
    expect(inspectRun(ref).members.map(member => member.pid)).toContain(proc.pid);
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
