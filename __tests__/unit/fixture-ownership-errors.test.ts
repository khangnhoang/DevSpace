// Test plan
// Goal: failed reconciliation never becomes an unverified delete or a released journal.
// Layer: unit, controlled SDK errors only; actual persistence is tested locally in the rls project.
// Subject: cleanup result handling and retention of unresolved ownership.
// Allowed paths: retry after verified absence.
// Denied paths: read failure, delete failure, ambiguous/residual rows.
// Known bugs: none.
// Invariants: no database/network access; every temporary journal is probe-owned.
import { expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FixtureScope, withFixtureScope } from "../helpers/fixture-ownership";
import { acquireRun, inspectRun, releaseRun, forgetEntry } from "../helpers/run-ownership.mjs";

it.each(["read", "delete", "residual", "ambiguous"])("retains ownership after %s failure and attempts independent cleanup", async failure => {
  const root = mkdtempSync(join(tmpdir(), "fixture-error-probe-"));
  const ref = acquireRun({ endpoint: "probe", api: "http://127.0.0.1" }, "unit", root);
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
  const scope = new FixtureScope(ref, db, "unused");
  try {
    await scope.reserve("notifications", { title: "owned" });
    await scope.reserve("coupons", { code: "independent" });
    mode = "cleanup";
    await expect(scope.cleanup()).rejects.toThrow("unresolved entries retained");
    expect(inspectRun(ref).entries).toHaveLength(1);
    expect(deletes).toBe(["read", "ambiguous"].includes(failure) ? 0 : 1);
    mode = "retry";
    await scope.cleanup(); await scope.cleanup();
    expect(inspectRun(ref).entries).toEqual([]);
    releaseRun(ref);
  } finally {
    for (const entry of inspectSafe()) forgetEntry(ref, entry.id);
    rmSync(root, { recursive: true, force: true });
  }
  function inspectSafe() { try { return inspectRun(ref).entries; } catch { return []; } }
});

it("preserves the original setup/test failure together with cleanup diagnostics", async () => {
  const original = new Error("setup failed after creation"), cleanup = new Error("delete failed");
  const failure = await withFixtureScope({ cleanup: async () => { throw cleanup; } }, async () => { throw original; }).catch(error => error);
  expect(failure).toBeInstanceOf(AggregateError);
  expect(failure.errors).toEqual([original, cleanup]);
  expect(failure.cause).toBe(original);
});
