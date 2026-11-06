// Test plan
// Goal: compatibility resources cannot outlive a clean shared test lifecycle.
// Layer: unit; Docker is an external boundary, with real files/locks and a killed subprocess for recovery.
// Subject: exact ownership validation and shared recovery/stop/end-of-run integration.
// Invariants: temporary state directories only; uncertain identity never permits deletion or a clean result.
import { spawn, type SpawnSyncReturns } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as compat from "../../scripts/test-stack/graphql-compat.mjs";
import {
  runOnTestStack,
  stopOnTestStack,
} from "../../scripts/test-stack/run.mjs";
import { readState, writeState } from "../../scripts/test-stack/state.mjs";

let dir: string;
const record = {
  owner: "devspace-se-u3-11111111-1111-4111-8111-111111111111",
  name: "devspace-se-u3-11111111-1111-4111-8111-111111111111-db",
  image: compat.GRAPHQL_COMPAT_IMAGE,
  id: "a".repeat(64),
};
const item = () => ({
  Id: record.id,
  Config: {
    Image: record.image,
    Labels: { [compat.GRAPHQL_COMPAT_LABEL]: record.owner },
  },
  HostConfig: { NetworkMode: "none", PortBindings: {} },
  Mounts: [{ Type: "tmpfs" }],
});
const result = (
  stdout: string,
  status = 0,
  stderr = "",
): SpawnSyncReturns<string> => ({
  pid: 0,
  output: [null, stdout, stderr],
  stdout,
  stderr,
  status,
  signal: null,
});
const save = (value: unknown = record) =>
  writeFileSync(compat.graphqlCompatJournal(dir), JSON.stringify(value));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "devspace-graphql-compat-"));
  vi.stubEnv("DOCKER_CONTEXT", "unit-local");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

function engine(value = item()) {
  let present = true;
  return vi.fn((args: string[]) => {
    if (args[0] === "context") return result("unix:///var/run/docker.sock");
    if (args[0] === "rm") {
      present = false;
      return result(record.id);
    }
    return present
      ? result(JSON.stringify([value]))
      : result("", 1, "No such container");
  });
}

describe("compatibility ownership recovery", () => {
  it("does not contact Docker when no intent is recorded", () => {
    const docker = engine();
    expect(compat.reconcileGraphqlCompatibility({ dir, docker })).toBe(false);
    expect(docker).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "removes only the recorded container, verifies absence and clears intent (id recorded: %s)",
    (withId) => {
      save(withId ? record : { ...record, id: undefined });
      writeFileSync(
        `${compat.graphqlCompatJournal(dir)}.next`,
        "interrupted ID update",
      );
      const docker = engine();
      expect(compat.reconcileGraphqlCompatibility({ dir, docker })).toBe(true);
      expect(docker.mock.calls.filter(([args]) => args[0] === "rm")).toEqual([
        [["rm", "-f", record.id]],
      ]);
      expect(existsSync(compat.graphqlCompatJournal(dir))).toBe(false);
      expect(existsSync(`${compat.graphqlCompatJournal(dir)}.next`)).toBe(
        false,
      );
    },
  );

  it.each(["label", "image", "id", "network", "ports", "mount"])(
    "preserves the journal and refuses deletion on mismatched %s",
    (field) => {
      save();
      const value = item();
      if (field === "label")
        value.Config.Labels[compat.GRAPHQL_COMPAT_LABEL] = "someone-else";
      if (field === "image") value.Config.Image = "unowned-image";
      if (field === "id") value.Id = "b".repeat(64);
      if (field === "network") value.HostConfig.NetworkMode = "bridge";
      if (field === "ports") value.HostConfig.PortBindings = { "5432/tcp": [] };
      if (field === "mount") value.Mounts = [{ Type: "bind" }];
      const docker = engine(value);
      expect(() =>
        compat.reconcileGraphqlCompatibility({ dir, docker }),
      ).toThrow();
      expect(docker.mock.calls.some(([args]) => args[0] === "rm")).toBe(false);
      expect(
        JSON.parse(readFileSync(compat.graphqlCompatJournal(dir), "utf8")),
      ).toEqual(record);
    },
  );

  it("refuses malformed intent before calling Docker", () => {
    save({ ...record, name: "supabase_db_devspace-local" });
    const docker = engine();
    expect(() =>
      compat.reconcileGraphqlCompatibility({ dir, docker }),
    ).toThrow();
    expect(docker).not.toHaveBeenCalled();
    expect(existsSync(compat.graphqlCompatJournal(dir))).toBe(true);
  });

  it("keeps intent on an unavailable engine or unsuccessful removal", () => {
    save();
    const docker = engine();
    const unavailable = (args: string[]) =>
      args[0] === "inspect" ? result("", 1, "permission denied") : docker(args);
    expect(() =>
      compat.reconcileGraphqlCompatibility({ dir, docker: unavailable }),
    ).toThrow(/retain/);
    expect(existsSync(compat.graphqlCompatJournal(dir))).toBe(true);
    const cannotRemove = (args: string[]) =>
      args[0] === "rm" ? result("", 1, "permission denied") : docker(args);
    expect(() =>
      compat.reconcileGraphqlCompatibility({ dir, docker: cannotRemove }),
    ).toThrow(/retain/);
    expect(existsSync(compat.graphqlCompatJournal(dir))).toBe(true);
  });
});

const ensure = async () => ({
  stack: {
    dbUrl: "unused",
    apiUrl: "unused",
    anonKey: "unused",
    serviceRoleKey: "unused",
    project: "unit-only",
  },
  decision: { reset: false, kind: null, reason: "unit-only" },
  hash: "h",
  snapshot: { tables: {} },
});
const audit = {
  takeSnapshot: async () => ({ tables: {} }),
  compareSnapshots: () => [],
};

describe("shared compatibility recovery boundary", () => {
  it("recovers before a command excluding G3 and tells its preflight the prior state is dirty", async () => {
    writeState({ status: "clean" }, dir);
    const recovery = vi
      .spyOn(compat, "reconcileGraphqlCompatibility")
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    const preflight = vi.fn(async ({ state }) => {
      expect(state.status).toBe("dirty");
      return ensure();
    });
    expect(
      await runOnTestStack({
        dir,
        command: "npm test -- profiles.test.ts",
        beforeChild: undefined,
        ensure: preflight,
        audit,
        runChild: async () => 0,
      }),
    ).toBe(0);
    expect(recovery).toHaveBeenCalledTimes(2);
    expect(readState(dir)?.status).toBe("clean");
  });

  it("blocks preflight and stop when ownership cannot be reconciled", async () => {
    vi.spyOn(compat, "reconcileGraphqlCompatibility").mockImplementation(() => {
      throw new Error("uncertain compatibility identity");
    });
    const preflight = vi.fn(ensure),
      stop = vi.fn();
    await expect(
      runOnTestStack({
        dir,
        command: "npm run test:e2e",
        beforeChild: undefined,
        ensure: preflight,
        audit,
        runChild: async () => 0,
      }),
    ).rejects.toThrow(/uncertain/);
    expect(preflight).not.toHaveBeenCalled();
    expect(readState(dir)?.status).toBe("dirty");
    await expect(stopOnTestStack({ dir, stop })).rejects.toThrow(/uncertain/);
    expect(stop).not.toHaveBeenCalled();
    expect(readState(dir)?.status).toBe("dirty");
  });

  it("reconciles compatibility intent before stopping the managed stack", async () => {
    const recovery = vi
      .spyOn(compat, "reconcileGraphqlCompatibility")
      .mockReturnValue(true);
    const stop = vi.fn(async () => {
      expect(recovery).toHaveBeenCalledOnce();
    });
    await stopOnTestStack({ dir, stop });
    expect(stop).toHaveBeenCalledOnce();
    expect(readState(dir)?.status).toBe("dirty");
  });

  it("cannot publish clean when end-of-run reconciliation fails", async () => {
    vi.spyOn(compat, "reconcileGraphqlCompatibility")
      .mockReturnValueOnce(false)
      .mockImplementation(() => {
        throw new Error("compatibility cleanup failed");
      });
    const snapshot = vi.fn(audit.takeSnapshot);
    expect(
      await runOnTestStack({
        dir,
        command: "npm test",
        beforeChild: undefined,
        ensure,
        audit: { ...audit, takeSnapshot: snapshot },
        runChild: async () => 0,
      }),
    ).toBe(1);
    expect(snapshot).not.toHaveBeenCalled();
    expect(readState(dir)).toMatchObject({
      status: "dirty",
      cause: expect.stringContaining("compatibility cleanup failed"),
    });
  });

  it("retains interrupted intent and refuses a later command excluding G3 when ownership is malformed", async () => {
    const env: NodeJS.ProcessEnv = { ...process.env, STACK_PROBE_DIR: dir };
    delete env.DEVSPACE_TEST_RUN;
    delete env.DEVSPACE_TEST_RUN_DIR;
    delete env.NODE_OPTIONS;
    const child = spawn(
      process.execPath,
      ["__tests__/helpers/stack-probe.mjs", "run", "hang-compat-intent"],
      { env, stdio: ["ignore", "pipe", "pipe"] },
    );
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.stderr!.resume();
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () =>
            reject(new Error("interruption probe did not record its intent")),
          20_000,
        );
        child.stdout!.on("data", (data) => {
          if (data.toString().includes('"compat-intent"')) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
      child.kill("SIGKILL");
      await exited;
      const saved = readFileSync(compat.graphqlCompatJournal(dir), "utf8");
      const preflight = vi.fn(ensure);
      await expect(
        runOnTestStack({
          dir,
          command: "npm test -- profiles.test.ts",
          beforeChild: undefined,
          ensure: preflight,
          audit,
          runChild: async () => 0,
        }),
      ).rejects.toThrow();
      expect(preflight).not.toHaveBeenCalled();
      expect(readState(dir)?.status).toBe("dirty");
      expect(readFileSync(compat.graphqlCompatJournal(dir), "utf8")).toBe(
        saved,
      );
    } finally {
      child.kill("SIGKILL");
      await exited;
    }
  }, 40_000);
});
