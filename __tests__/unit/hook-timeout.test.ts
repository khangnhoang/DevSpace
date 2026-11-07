// Test plan
// Goal: a cleanup hook that times out marks the run before its pending cleanup settles (QE-P8, AC2).
// Layer: unit; a real Vitest process runs the probe with a short hookTimeout (no database, no network).
// Subject: runCleanupHook in __tests__/helpers/fixture-ownership.ts as OwnedObjects.cleanup and the fixture scope cleanup use it.
// Allowed paths: a cleanup that ends in time marks nothing and leaves no listener.
// Denied paths: a hookTimeout abort, or a signal already aborted by the test's own timeout, marks the run, and a later scope refuses.
// Known bugs: none.
// Invariants: the probe's marker is its own; nothing here touches the shared run state.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { runCleanupHook, type RunMarker } from "../helpers/fixture-ownership";

const root = fileURLToPath(new URL("../../", import.meta.url));
const temp = mkdtempSync(join(tmpdir(), "hook-timeout-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

async function probe(kind: string): Promise<string[]> {
  const log = join(temp, `${kind}.log`);
  const args = [
    join(root, "node_modules/vitest/vitest.mjs"),
    "run",
    "--config",
    join(root, "__tests__/unit/probes/hook-timeout.config.mts"),
  ];
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: { ...process.env, PROBE_KIND: kind, PROBE_LOG: log },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  await new Promise((resolve) => child.once("exit", resolve));
  try {
    return readFileSync(log, "utf8").split("\n").filter(Boolean);
  } catch {
    throw new Error(`the probe wrote no log:\n${output}`);
  }
}

const marker = () => {
  const causes: string[] = [];
  return {
    causes,
    check: () => causes[0] ?? null,
    mark: (cause: string) => {
      causes.push(cause);
    },
  } satisfies RunMarker & { causes: string[] };
};

describe("a cleanup hook that exceeds hookTimeout", () => {
  it("marks the run before the pending OwnedObjects removal settles", async () => {
    const events = await probe("objects");
    const marked = events.findIndex((line) =>
      line.startsWith("marked cleanup hook aborted"),
    );
    expect(marked, events.join("\n")).toBeGreaterThanOrEqual(0);
    const settled = events.indexOf("settled");
    expect(settled === -1 || marked < settled, events.join("\n")).toBe(true);
  }, 30_000);

  it("marks the run before the pending fixture scope cleanup settles", async () => {
    const events = await probe("scope");
    const marked = events.findIndex((line) =>
      line.startsWith("marked cleanup hook aborted"),
    );
    expect(marked, events.join("\n")).toBeGreaterThanOrEqual(0);
    const settled = events.indexOf("settled");
    expect(settled === -1 || marked < settled, events.join("\n")).toBe(true);
  }, 30_000);

  it("marks the run when the test's own timeout already aborted the signal before the hook starts", async () => {
    const events = await probe("test-timeout");
    expect(
      events.some((line) => line.startsWith("marked cleanup hook aborted")),
      events.join("\n"),
    ).toBe(true);
    expect(
      events.some((line) => line.startsWith("marked test timed out")),
      events.join("\n"),
    ).toBe(true);
  }, 30_000);
});

describe("runCleanupHook", () => {
  it("marks nothing for a cleanup that ends in time, and removes its listener so a later abort marks nothing", async () => {
    const run = marker();
    const controller = new AbortController();
    await runCleanupHook(
      { signal: controller.signal, task: { name: "t" } },
      run,
      async () => {},
    );
    controller.abort();
    expect(run.causes).toEqual([]);
  });

  it("marks a signal that is already aborted on entry, and still runs the cleanup", async () => {
    const run = marker();
    const controller = new AbortController();
    controller.abort();
    let ran = false;
    await runCleanupHook(
      { signal: controller.signal, task: { name: "t" } },
      run,
      async () => {
        ran = true;
      },
    );
    expect(ran).toBe(true);
    expect(run.causes).toEqual(["cleanup hook aborted: t"]);
  });
});
