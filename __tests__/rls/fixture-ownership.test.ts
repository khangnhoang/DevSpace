// Test plan
// Goal: exact owned cleanup preserves other scopes/manual-like sentinels across failure and lost responses.
// Layer: rls/local API persistence with real Auth; controlled failures occur after committed writes.
// Subject: FixtureScope acquisition, intent reconciliation, cleanup and field restoration.
// Allowed paths: positively attributed resources and acquired fields are cleaned/restored.
// Denied paths: occupied preflight, unrelated selectors and another scope's resources.
// Known bugs: none.
// Invariants: the probes own every sentinel and restore every seed field they acquire; no reset.
import { describe, expect, inject, it } from "vitest";
import { FixtureScope, userExists, withFixtureScope } from "../helpers/fixture-ownership";
import { inspectRun } from "../helpers/run-ownership.mjs";
import { fixtures, must, IDS, admin, student, learner } from "./helpers";

const ref = inject("ownership");
const stack = inject("localStack");
const scope = () => new FixtureScope(ref, fixtures, stack.dbUrl);

describe("fixture ownership persistence", () => {
  it("cleans A while preserving B and manual-like content/coupon/payment/notification/Auth sentinels", async () => {
    const a = scope(), b = scope(), sentinel = scope();
    const created: { scope: FixtureScope; table: string; id: number }[] = [];
    const users: { scope: FixtureScope; id: string }[] = [];
    try {
      for (const owner of [a, b, sentinel]) {
        const rows = [
          ["courses", { name: owner.label("E2E manual"), slug: `e2e-${owner.tag}`, price: 0 }, "slug"],
          ["coupons", { code: owner.code("E2E-manual"), discount_percent: 10, used_count: 0, is_active: true }, "code"],
          ["notifications", { receiver_id: IDS.learner, title: owner.label("rls-test manual"), type: "system" }, "title"],
        ] as const;
        for (const [table, values, key] of rows) {
          await owner.reserve(table, { [key]: values[key as keyof typeof values] });
          const { id } = must(await fixtures.from(table).insert<Record<string, unknown>>(values).select("id").single());
          created.push({ scope: owner, table, id });
        }
        const courseId = created.find(row => row.scope === owner && row.table === "courses")!.id;
        await owner.reserve("payments", { user_id: IDS.learner, course_id: courseId });
        const { id } = must(await fixtures.from("payments").insert({ user_id: IDS.learner, course_id: courseId, amount: 0, status: "pending" }).select("id").single());
        created.push({ scope: owner, table: "payments", id });
        const email = `e2e-${owner.tag}@devspace.test`;
        await owner.reserveAuth(email);
        const result = await fixtures.auth.admin.createUser({ email, password: "ownership-local-pass-1", email_confirm: true });
        if (result.error || !result.data.user) throw new Error(result.error?.message ?? "missing Auth user");
        users.push({ scope: owner, id: result.data.user.id });
      }
      await a.cleanup(); await a.cleanup();
      for (const row of created) expect(must(await fixtures.from(row.table).select("id").eq("id", row.id))).toHaveLength(row.scope === a ? 0 : 1);
      for (const user of users) expect(await userExists(fixtures, user.id)).toBe(user.scope !== a);
    } finally { await a.cleanup(); await b.cleanup(); await sentinel.cleanup(); }
  });

  it("a failed preflight acquires no ownership and never rewrites a sentinel", async () => {
    const owner = scope(), failed = scope();
    const title = owner.label("E2E occupied");
    try {
      await owner.reserve("notifications", { title });
      must(await fixtures.from("notifications").insert({ receiver_id: IDS.learner, title, type: "system" }));
      await expect(failed.reserve("notifications", { title })).rejects.toThrow("already occupied");
      await expect(failed.acquire("notes", 1, ["content"], { content: "different baseline" })).rejects.toThrow("differ from baseline");
      expect(inspectRun(ref).entries.filter(entry => entry.scope === failed.id)).toEqual([]);
      const before = must(await fixtures.from("notifications").select("id,title,is_read").eq("title", title));
      await failed.cleanup();
      expect(must(await fixtures.from("notifications").select("id,title,is_read").eq("title", title))).toEqual(before);
    } finally { await owner.cleanup(); await failed.cleanup(); }
  });

  it("cleans committed no-returning and lost-response rows/Auth after a simulated assertion/setup failure", async () => {
    const owner = scope();
    const title = owner.label("rls-test unavailable response");
    const email = `e2e-${owner.tag}@devspace.test`;
    try {
      await owner.reserve("notifications", { title });
      await owner.reserveAuth(email);
      const original = new Error("injected setup/assertion failure");
      await expect(withFixtureScope(owner, async () => {
        const result = await admin.from("notifications").insert({ receiver_id: IDS.learner, actor_id: IDS.admin, title, type: "system" });
        expect(result.error).toBeNull(); expect(result.data).toBeNull();
        const auth = await fixtures.auth.admin.createUser({ email, password: "ownership-local-pass-1", email_confirm: true });
        expect(auth.error).toBeNull();
        // Deliberately withhold returned IDs from the ownership caller after the real writes commit.
        expect(await owner.authIds(email)).toHaveLength(1);
        throw original;
      })).rejects.toBe(original);
      await owner.cleanup(); await owner.cleanup();
      expect(must(await fixtures.from("notifications").select("id").eq("title", title))).toEqual([]);
      expect(await owner.authIds(email)).toEqual([]);
    } finally { await owner.cleanup(); }
  });

  it("restores precisely acquired profile/comment/note fields after actor mutation and failure", async () => {
    const owner = scope();
    const before = {
      profile: must(await fixtures.from("profiles").select("full_name,role,email").eq("id", IDS.learner).single()),
      comment: must(await fixtures.from("comments").select("content,lesson_id,user_id,deleted_at").eq("id", 1).single()),
      note: must(await fixtures.from("notes").select("content,timestamp,user_id,lesson_id").eq("id", 1).single()),
    };
    try {
      await owner.acquire("profiles", IDS.learner, ["full_name"]);
      await owner.acquire("comments", 1, ["content"]);
      await owner.acquire("notes", 1, ["content"]);
      must(await learner.from("profiles").update({ full_name: owner.label("test") }).eq("id", IDS.learner));
      must(await student.from("comments").update({ content: owner.label("test") }).eq("id", 1));
      must(await student.from("notes").update({ content: owner.label("test") }).eq("id", 1));
      await owner.cleanup();
      expect(must(await fixtures.from("profiles").select("full_name,role,email").eq("id", IDS.learner).single())).toEqual(before.profile);
      expect(must(await fixtures.from("comments").select("content,lesson_id,user_id,deleted_at").eq("id", 1).single())).toEqual(before.comment);
      expect(must(await fixtures.from("notes").select("content,timestamp,user_id,lesson_id").eq("id", 1).single())).toEqual(before.note);
    } finally { await owner.cleanup(); }
  });
});
