// Test plan
// Goal: the `api` project marks the run unclean when one of its tests times out or its fixture cleanup outlives its
//   deadline, and the cleanup still runs to its end, so a timeout stays dirty and leaves no residue (QE-P8).
// Layer: unit; a real Vitest process runs the probe with a short testTimeout (no database, no network).
// Subject: noteTimedOutTests and cleanupWithDeadline in __tests__/helpers/api-timeout-note.ts, which
//   __tests__/api/setup.ts and the api session helper register.
// Allowed paths: a test that ends in time marks nothing.
// Denied paths: a timed-out test marks the run and its cleanup still runs; a cleanup past its deadline marks the run
//   before it settles and settles anyway.
// Known bugs: none.
// Invariants: the probe's marker is its own; nothing here touches the shared run state.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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

  it("marks the run before a cleanup past its deadline settles, and the cleanup settles", async () => {
    const events = await probe("slow-cleanup");
    const marked = events.findIndex((line) =>
      line.startsWith("marked cleanup hook aborted: probe cleanup"),
    );
    const settled = events.indexOf("settled");
    expect(marked, events.join("\n")).toBeGreaterThanOrEqual(0);
    expect(settled, "no residue: the cleanup ran to its end").toBeGreaterThan(
      marked,
    );
  }, 30_000);
});
