// Test plan
// Goal: a Storage test fixture follows the shared unclean-run rules of FixtureScope.
// Layer: unit (in-memory run marker and fake Storage; no database).
// Subject: OwnedObjects in __tests__/helpers/storage-object-scope.ts.
// Allowed paths: an open run admits a writer, removes each recorded name and verifies it absent.
// Denied paths: a run marked by a failed removal, a failed or positive verification or a timeout refuses the next writer.
// Known bugs: none.
// Invariants: every name is attempted independently and unresolved names stay in the error.
import { describe, expect, it } from "vitest";
import type { RunMarker } from "../helpers/fixture-ownership";
import { OwnedObjects } from "../helpers/storage-object-scope";

const recorder = () => {
  const causes: string[] = [];
  return {
    causes,
    check: () => causes[0] ?? null,
    mark: (cause: string) => {
      causes.push(cause);
    },
  } satisfies RunMarker & { causes: string[] };
};
const scope = (
  run: RunMarker,
  fake: {
    remove?: (name: string) => Promise<void>;
    exists?: (name: string) => Promise<boolean>;
  } = {},
) =>
  new OwnedObjects({
    run,
    remove: fake.remove ?? (async () => {}),
    exists: fake.exists ?? (async () => false),
  });

describe("OwnedObjects", () => {
  it("removes and verifies every recorded name on an open run", async () => {
    const removed: string[] = [];
    const run = recorder();
    const objects = scope(run, {
      remove: async (name) => {
        removed.push(name);
      },
    });
    objects.own("a.png");
    objects.own("b/c.png");
    await objects.cleanup({});
    expect(removed).toEqual(["a.png", "b/c.png"]);
    expect(run.causes).toEqual([]);
    objects.own("d.png");
  });

  it("marks the run when a removal throws, attempts the other names, keeps unresolved names and refuses the next writer", async () => {
    const attempted: string[] = [];
    const run = recorder();
    const objects = scope(run, {
      remove: async (name) => {
        attempted.push(name);
        if (name === "a.png") throw new Error("storage down");
      },
    });
    objects.own("a.png");
    objects.own("b.png");
    await expect(objects.cleanup({})).rejects.toThrow(
      /a\.png \(storage down\)/,
    );
    expect(attempted).toEqual(["a.png", "b.png"]);
    expect(run.causes).toHaveLength(1);
    expect(() => scope(run).own("next.png")).toThrow("run is unclean");
  });

  it("marks the run when the verification read throws", async () => {
    const run = recorder();
    const objects = scope(run, {
      exists: async () => {
        throw new Error("read failed");
      },
    });
    objects.own("a.png");
    await expect(objects.cleanup({})).rejects.toThrow(/read failed/);
    expect(() => scope(run).own("next.png")).toThrow("run is unclean");
  });

  it("marks the run when the object is still present after removal", async () => {
    const run = recorder();
    const objects = scope(run, { exists: async () => true });
    objects.own("a.png");
    await expect(objects.cleanup({})).rejects.toThrow(
      /a\.png \(still present\)/,
    );
    expect(() => scope(run).own("next.png")).toThrow("run is unclean");
  });

  it("marks the run after a timed-out test even when the cleanup succeeds, and refuses the next writer", async () => {
    const run = recorder();
    const objects = scope(run);
    objects.own("a.png");
    await objects.cleanup({
      task: {
        name: "slow test",
        result: { errors: [{ message: "Test timed out in 5000ms." }] },
      },
    });
    expect(run.causes).toEqual(["test timed out: slow test"]);
    expect(() => objects.own("next.png")).toThrow("run is unclean");
  });
});
