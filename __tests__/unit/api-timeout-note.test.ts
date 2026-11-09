// Test plan
// Goal: the `api` project marks the run unclean when one of its tests times out, when a cleanup hook outlives its
//   timeout, or when any step of an afterAll cleanup outlives the deadline around the whole body, and every cleanup
//   step still runs to its end, so a timeout stays dirty and leaves no residue (QE-P8).
// Layer: unit; a real Vitest process runs the probe with a short testTimeout and hookTimeout (no database, no network).
// Subject: noteTimedOutTests, afterEachCleanup and afterAllCleanup in __tests__/helpers/api-timeout-note.ts, which
//   __tests__/api/setup.ts and every file of __tests__/api register.
// Allowed paths: a test that ends in time marks nothing.
// Denied paths: a timed-out test marks the run and its cleanup still runs, also when that cleanup throws; a cleanup hook
//   past its timeout, and a step after an earlier one that ended in time, mark the run before they settle and settle
//   anyway; a failing step does not stop the steps after it.
// Known bugs: none.
// Invariants: the probe's marker is its own; nothing here touches the shared run state.
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import config from "../../vitest.config.mts";
import { API_HOOK_TIMEOUT_MS } from "../helpers/api-timeouts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const temp = mkdtempSync(join(tmpdir(), "api-timeout-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

async function probe(kind: string): Promise<string[]> {
  const log = join(temp, `${kind}.log`);
  const child = spawn(
    process.execPath,
    [
      join(root, "node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      join(root, "__tests__/unit/probes/api-timeout.config.mts"),
    ],
    {
      cwd: root,
      env: { ...process.env, PROBE_KIND: kind, PROBE_LOG: log },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
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

describe("the api project's timeout wiring", () => {
  it("registers the timeout note for every file of the api project, and keeps its hook timeout in step with the deadline", () => {
    type Project = {
      test?: { name?: string; setupFiles?: string[]; hookTimeout?: number };
    };
    const projects = (config.test?.projects ?? []) as Project[];
    const api = projects.find((project) => project.test?.name === "api");
    expect(api?.test?.setupFiles).toContain("__tests__/api/setup.ts");
    expect(api?.test?.hookTimeout).toBe(API_HOOK_TIMEOUT_MS);
  });

  it("marks the run when a test times out, and its cleanup still runs", async () => {
    const events = await probe("slow-test");
    expect(
      events.some((line) =>
        line.startsWith("marked test timed out: is too slow"),
      ),
      events.join("\n"),
    ).toBe(true);
    expect(
      events,
      "the fixture is removed although the run is unclean",
    ).toContain("cleaned");
  }, 30_000);

  it("marks nothing for a test that ends in time", async () => {
    const events = await probe("fast-test");
    expect(events).toEqual(["cleaned"]);
  }, 30_000);

  it("marks the run for a timed-out test even when the file's own cleanup then throws", async () => {
    const events = await probe("slow-test-throwing-cleanup");
    expect(
      events.some((line) =>
        line.startsWith("marked test timed out: is too slow"),
      ),
      events.join("\n"),
    ).toBe(true);
    expect(events, "the cleanup ran").toContain("cleaned");
  }, 30_000);

  it("marks the run before an afterEach cleanup hook past its timeout settles, and the step settles", async () => {
    const events = await probe("hook-timeout");
    const marked = events.findIndex((line) =>
      line.startsWith("marked cleanup hook aborted"),
    );
    const settled = events.indexOf("settled");
    expect(marked, events.join("\n")).toBeGreaterThanOrEqual(0);
    expect(settled, "no residue: the step ran to its end").toBeGreaterThan(
      marked,
    );
  }, 30_000);

  it("marks the run before a step past the deadline settles, although the step before it ended in time", async () => {
    const events = await probe("late-step");
    const first = events.indexOf("first step done");
    const marked = events.findIndex((line) =>
      line.startsWith("marked cleanup hook aborted: probe cleanup"),
    );
    const settled = events.indexOf("settled");
    expect(first, events.join("\n")).toBeGreaterThanOrEqual(0);
    expect(marked, events.join("\n")).toBeGreaterThan(first);
    expect(settled, "no residue: the step ran to its end").toBeGreaterThan(
      marked,
    );
  }, 30_000);

  it("runs the steps after a step that failed", async () => {
    const events = await probe("failing-step");
    expect(events).toContain("second step ran");
  }, 30_000);

  it("leaves no cleanup hook of an api file outside the shared helper", () => {
    const dir = join(root, "__tests__/api");
    const bare = readdirSync(dir)
      .filter((name) => name.endsWith(".test.ts"))
      .filter((name) =>
        /^\s*(afterAll|afterEach)\(\s*(async|\()/m.test(
          readFileSync(join(dir, name), "utf8"),
        ),
      );
    expect(
      bare,
      "register the hook through afterEachCleanup or afterAllCleanup",
    ).toEqual([]);
  });
});
