// Test plan
// Goal: failed reconciliation never becomes an unverified delete or a silently clean scope.
// Layer: unit, controlled SDK/catalog results only; actual persistence is tested locally in the rls project.
// Subject: cleanup result handling and retention of unresolved ownership and the unclean mark of the run.
// Allowed paths: retry after verified absence.
// Denied paths: read failure, delete failure, ambiguous/residual rows.
// Known bugs: none.
// Invariants: no database/network access; every run marker is probe-owned.
import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FixtureScope, withFixtureScope } from "../helpers/fixture-ownership";

vi.mock("pg", () => ({ default: { Client: class {
  async connect() {}
  async query() { return { rows: [] }; }
  async end() {}
} } }));

it.each(["read", "delete", "residual", "ambiguous"])("retains ownership and marks the run after %s failure, attempts independent cleanup and allows a retry", async failure => {
  let mode = "preflight";
  let deletes = 0;
  const db = {
    from: (table: string) => ({
      select: () => ({ match: async () => {
        if (mode === "preflight" || mode === "retry" || table === "coupons") return { data: [], error: null };
        if (failure === "read") return { data: null, error: { message: "read unavailable" } };
        return { data: failure === "ambiguous" ? [{ id: 1 }, { id: 2 }] : [{ id: 1 }], error: null };
      } }),
      delete: () => ({ in: async () => { deletes++; return { data: [], error: failure === "delete" ? { message: "delete refused" } : null }; } }),
    }),
  } as unknown as SupabaseClient;
  const causes: string[] = [];
  const run = { check: () => causes[0] ?? null, mark: (cause: string) => { causes.push(cause); } };
  const scope = new FixtureScope(db, "unused", { run });
  await scope.reserve("notifications", { title: "owned" });
  await scope.reserve("coupons", { code: "independent" });
  mode = "cleanup";
  await expect(scope.cleanup()).rejects.toThrow("unresolved entries retained");
  expect(scope.entries).toHaveLength(1);
  expect(deletes).toBe(["read", "ambiguous"].includes(failure) ? 0 : 1);
  // The failed cleanup stops every later scope of the run.
  expect(causes).toHaveLength(1);
  expect(causes[0]).toContain("fixture cleanup failed");
  expect(() => new FixtureScope(db, "unused", { run })).toThrow("Previous fixture cleanup is unresolved");
  mode = "retry";
  await scope.cleanup(); await scope.cleanup();
  expect(scope.entries).toEqual([]);
});

it("refuses a selector another open scope of the process holds, and frees it once that scope is clean", async () => {
  const db = { from: () => ({ select: () => ({ match: async () => ({ data: [], error: null }) }), delete: () => ({ in: async () => ({ data: [], error: null }) }) }) } as unknown as SupabaseClient;
  const run = { check: () => null, mark: () => {} };
  const first = new FixtureScope(db, "unused", { run });
  const second = new FixtureScope(db, "unused", { run });
  await first.reserve("notifications", { title: "shared", type: "system" });
  await expect(second.reserve("notifications", { type: "system", title: "shared" })).rejects.toThrow("already reserved");
  await first.cleanup();
  await second.reserve("notifications", { title: "shared", type: "system" });
  await second.cleanup();
});

it("preserves the original setup/test failure together with cleanup diagnostics", async () => {
  const original = new Error("setup failed after creation"), cleanup = new Error("delete failed");
  const failure = await withFixtureScope({ cleanup: async () => { throw cleanup; } }, async () => { throw original; }).catch(error => error);
  expect(failure).toBeInstanceOf(AggregateError);
  expect(failure.errors).toEqual([original, cleanup]);
  expect(failure.cause).toBe(original);
});
