// Run only by hook-timeout.test.ts, in its own Vitest process with a short hookTimeout (hook-timeout.config.mts).
// It registers the cleanup the way the rls files do (a real afterEach that receives Vitest's context) and appends
// what happens to the file named by PROBE_LOG: "marked <cause>" when the run is marked, "settled" when the pending
// cleanup operation finishes.
import { appendFileSync } from "node:fs";
import { afterEach, beforeEach, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FixtureScope,
  runCleanupHook,
  type RunMarker,
} from "../../helpers/fixture-ownership";
import { OwnedObjects } from "../../helpers/storage-object-scope";

const log = process.env.PROBE_LOG!;
const kind = process.env.PROBE_KIND!;
const note = (line: string) => appendFileSync(log, `${line}\n`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const causes: string[] = [];
const run: RunMarker = {
  check: () => causes[0] ?? null,
  mark: (cause) => {
    causes.push(cause);
    note(`marked ${cause}`);
  },
};

if (kind === "objects") {
  const objects = new OwnedObjects({
    run,
    remove: async () => {
      await sleep(1500);
      note("settled");
    },
    exists: async () => false,
  });
  it("owns a name", () => {
    objects.own("a.png");
  });
  afterEach((context) => objects.cleanup(context));
}

if (kind === "scope") {
  // The first read of cleanup is held; reserve and its own reads answer at once.
  let reads = 0;
  const db = {
    from: () => ({
      select: () => ({
        match: async () => {
          if (++reads === 2) {
            await sleep(1500);
            note("settled");
          }
          return { data: [], error: null };
        },
      }),
    }),
  } as unknown as SupabaseClient;
  let scope: FixtureScope;
  beforeEach(async () => {
    reads = 0;
    scope = new FixtureScope(db, "unused", { run });
    await scope.reserve("notifications", { title: "owned" });
  });
  it("holds a fixture", () => {});
  afterEach((context) => runCleanupHook(context, run, () => scope.cleanup()));
}

if (kind === "test-timeout") {
  // The test body times out first, so the hook starts with a signal that is already aborted.
  const objects = new OwnedObjects({
    run,
    remove: async () => note("settled"),
    exists: async () => false,
  });
  it("is too slow", async () => {
    objects.own("a.png");
    await sleep(1500);
  }, 100);
  afterEach((context) => objects.cleanup(context));
}
