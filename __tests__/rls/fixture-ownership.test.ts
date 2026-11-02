// Test plan
// Goal: exact owned cleanup preserves other scopes/manual-like sentinels across failure and lost responses.
// Layer: rls/local API persistence with real Auth; controlled failures occur after committed writes.
// Subject: FixtureScope acquisition, intent reconciliation, cleanup and field restoration.
// Allowed paths: positively attributed resources and acquired fields are cleaned/restored.
// Denied paths: occupied preflight, unrelated selectors and another scope's resources.
// Known bugs: none.
// Invariants: the probes own every sentinel and restore every seed field they acquire; no reset.
import { afterEach, beforeEach, describe, expect, inject, it } from "vitest";
import { FixtureScope, userExists, withFixtureScope, cleanupEntries, type RunMarker } from "../helpers/fixture-ownership";
import { compareSnapshots, takeSnapshot } from "../../scripts/test-stack/audit.mjs";
import { fixtures, must, IDS, admin, student, learner, startFixtureScope, finishFixtureScope } from "./helpers";

const stack = inject("localStack");
// Same verified test endpoint, with credentials of a role that does not exist.
const lookupFailureUrl = (dbUrl: string) => { const url = new URL(dbUrl); url.username = "fixture_lookup_failure"; url.password = "fixture-only"; return url.toString(); };
// These probes fail cleanups and occupy selectors on purpose; their own run marker keeps that out of the real run state,
// which is covered by the last rows. A marker that remembers causes serves those rows.
const recorder = () => { const causes: string[] = []; return { causes, check: () => causes[0] ?? null, mark: (cause: string) => { causes.push(cause); } } satisfies RunMarker & { causes: string[] }; };
const scope = (run: RunMarker = recorder()) => new FixtureScope(fixtures, stack.dbUrl, { run });
beforeEach(startFixtureScope);
afterEach(finishFixtureScope);

describe("fixture ownership persistence", () => {
  it("blocks parent and Auth cascades into another scope, then safely retries after its cleanup", async () => {
    const a = scope(), b = scope();
    try {
      const slug = `e2e-parent-${a.tag}`, email = `e2e-${a.tag}@devspace.test`;
      await a.reserve("courses", { slug }); await a.reserveAuth(email);
      const courseId = must(await fixtures.from("courses").insert({ name: a.label("parent"), slug, price: 0 }).select("id").single()).id;
      const auth = await fixtures.auth.admin.createUser({ email, password: "ownership-local-pass-1", email_confirm: true });
      if (auth.error || !auth.data.user) throw new Error(auth.error?.message ?? "missing Auth user");
      const userId = auth.data.user.id;
      const lessonSlug = `e2e-child-${b.tag}`, content = b.label("foreign comment");
      await b.reserve("lessons", { slug: lessonSlug }); await b.reserve("comments", { content });
      const lesson = must(await fixtures.from("lessons").insert({ title: b.label("child"), slug: lessonSlug, course_id: courseId }).select("*").single());
      const comment = must(await fixtures.from("comments").insert({ user_id: userId, lesson_id: lesson.id, content }).select("*").single());
      await expect(a.cleanup()).rejects.toThrow("unresolved entries retained");
      expect(must(await fixtures.from("lessons").select("*").eq("id", lesson.id).single())).toEqual(lesson);
      expect(must(await fixtures.from("comments").select("*").eq("id", comment.id).single())).toEqual(comment);
      expect(await userExists(fixtures, userId)).toBe(true);
      expect(must(await fixtures.from("courses").select("id").eq("id", courseId))).toHaveLength(1);
      await b.cleanup(); await a.cleanup();
      expect(await userExists(fixtures, userId)).toBe(false);
      expect(must(await fixtures.from("courses").select("id").eq("id", courseId))).toEqual([]);
    } finally { await b.cleanup(); await a.cleanup(); }
  });
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
      await expect(failed.reserve("notifications", { title })).rejects.toThrow("already reserved");
      must(await fixtures.from("notifications").insert({ receiver_id: IDS.learner, title, type: "system" }));
      await expect(failed.reserve("notifications", { title })).rejects.toThrow("already occupied");
      const initial = await owner.acquire("notes", 1, ["content"]);
      const manualNote = owner.label("rls-test existing manual note");
      must(await student.from("notes").update({ content: manualNote }).eq("id", 1));
      await expect(failed.acquire("notes", 1, ["content"], initial)).rejects.toThrow("differ from baseline");
      expect(failed.entries).toEqual([]);
      const before = must(await fixtures.from("notifications").select("id,title,is_read").eq("title", title));
      await failed.cleanup();
      expect(must(await fixtures.from("notifications").select("id,title,is_read").eq("title", title))).toEqual(before);
      expect(must(await fixtures.from("notes").select("content").eq("id", 1).single()).content).toBe(manualNote);
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
    const commentOwner = scope();
    const seedComment = must(await fixtures.from("comments").select("*").eq("id", 1).single());
    try {
      // Content and updated_at change during this probe, so reserve an immutable creation identity.
      const createdAt = new Date().toISOString();
      await commentOwner.reserve("comments", { created_at: createdAt, user_id: IDS.student });
      const commentId = must(await fixtures.from("comments").insert({ user_id: IDS.student, lesson_id: 3, content: commentOwner.label("rls-test acquired comment fixture"), created_at: createdAt }).select("id").single()).id;
      const before = {
        profile: must(await fixtures.from("profiles").select("full_name,role,email").eq("id", IDS.learner).single()),
        comment: must(await fixtures.from("comments").select("content,lesson_id,user_id,deleted_at").eq("id", commentId).single()),
        note: must(await fixtures.from("notes").select("content,timestamp,user_id,lesson_id").eq("id", 1).single()),
      };
      const failure = new Error("injected failure after acquired-field mutations");
      await expect(withFixtureScope(owner, async () => {
        await owner.acquire("profiles", IDS.learner, ["full_name"]);
        await owner.acquire("comments", commentId, ["content"]);
        await owner.acquire("notes", 1, ["content"]);
        must(await learner.from("profiles").update({ full_name: owner.label("test") }).eq("id", IDS.learner));
        must(await student.from("comments").update({ content: owner.label("test") }).eq("id", commentId));
        must(await student.from("notes").update({ content: owner.label("test") }).eq("id", 1));
        throw failure;
      })).rejects.toBe(failure);
      expect(must(await fixtures.from("profiles").select("full_name,role,email").eq("id", IDS.learner).single())).toEqual(before.profile);
      expect(must(await fixtures.from("comments").select("content,lesson_id,user_id,deleted_at").eq("id", commentId).single())).toEqual(before.comment);
      expect(must(await fixtures.from("comments").select("*").eq("id", 1).single())).toEqual(seedComment);
      expect(must(await fixtures.from("notes").select("content,timestamp,user_id,lesson_id").eq("id", 1).single())).toEqual(before.note);
    } finally { await owner.cleanup(); await commentOwner.cleanup(); }
  });

  it("retains exact Auth ownership on a real lookup failure and preserves an unrelated user", async () => {
    const owner = scope(), foreign = scope();
    const email = `e2e-${owner.tag}@devspace.test`, foreignEmail = `e2e-${foreign.tag}@devspace.test`;
    try {
      await owner.reserveAuth(email); await foreign.reserveAuth(foreignEmail);
      const created = await fixtures.auth.admin.createUser({ email, password: "ownership-local-pass-1", email_confirm: true });
      const sentinel = await fixtures.auth.admin.createUser({ email: foreignEmail, password: "ownership-local-pass-1", email_confirm: true });
      expect(created.error).toBeNull(); expect(sentinel.error).toBeNull();
      const id = created.data.user!.id, sentinelId = sentinel.data.user!.id;
      // The real local SQL server refuses this invented, nonexistent role; no policy/schema is changed.
      await expect(cleanupEntries(owner, fixtures, lookupFailureUrl(stack.dbUrl))).rejects.toThrow("unresolved entries retained");
      expect(owner.entries.some(entry => entry.kind === "auth" && entry.email === email)).toBe(true);
      expect(await userExists(fixtures, id)).toBe(true); expect(await userExists(fixtures, sentinelId)).toBe(true);
      await owner.cleanup();
      expect(await userExists(fixtures, id)).toBe(false); expect(await userExists(fixtures, sentinelId)).toBe(true);
    } finally { await owner.cleanup(); await foreign.cleanup(); }
  });
  it("marks the run on residue found at a reservation and refuses every later scope, without touching the residue", async () => {
    const run = recorder();
    const owner = scope(run);
    const title = owner.label("rls-test residue");
    must(await fixtures.from("notifications").insert({ receiver_id: IDS.learner, title, type: "system" }));
    try {
      await expect(owner.reserve("notifications", { title })).rejects.toThrow("already occupied");
      expect(run.causes).toHaveLength(1);
      expect(run.causes[0]).toMatch(/^residue: notifications selector/);
      expect(() => scope(run)).toThrow("Previous fixture cleanup is unresolved or the run is unclean");
      expect(must(await fixtures.from("notifications").select("id").eq("title", title))).toHaveLength(1);
    } finally {
      must(await fixtures.from("notifications").delete().eq("title", title));
      await owner.cleanup();
    }
    expect(must(await fixtures.from("notifications").select("id").eq("title", title))).toEqual([]);
  });

  it("audits a scope's cleanup as clean and reports a write that lands after it", async () => {
    const owner = scope();
    const title = owner.label("rls-test delayed write");
    const before = await takeSnapshot(stack.dbUrl);
    try {
      await owner.reserve("notifications", { title });
      must(await fixtures.from("notifications").insert({ receiver_id: IDS.learner, title, type: "system" }));
      await owner.cleanup();
      expect(compareSnapshots(before, await takeSnapshot(stack.dbUrl))).toEqual([]);
      // The delayed write is what a writer that outlives its scope would do; the end-of-run audit must name it.
      must(await fixtures.from("notifications").insert({ receiver_id: IDS.learner, title, type: "system" }));
      expect(compareSnapshots(before, await takeSnapshot(stack.dbUrl))).toEqual([expect.stringMatching(/^public\.notifications: /)]);
    } finally {
      must(await fixtures.from("notifications").delete().eq("title", title));
      await owner.cleanup();
    }
    expect(compareSnapshots(before, await takeSnapshot(stack.dbUrl))).toEqual([]);
  });
});
