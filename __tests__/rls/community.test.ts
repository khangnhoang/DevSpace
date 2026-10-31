// Test plan
// Goal: only enrolled authors create reviews; comments retain their owner and lesson for every writer.
// Layer: rls (local Supabase API actors), plus separately awaited local SQL service_role and catalog probes.
// Subject: security-hotfix SH-P3/SH-P4 (historical P3/K1, P4/K2), review policies and comment trigger.
// Allowed paths: own enrolled INSERT/UPDATE/upsert, owner content edit and admin soft-delete.
// Denied paths: anon/unenrolled/forged reviews, another user's edits and owner/admin/service_role reassignment.
// Known bugs: none in this subject; unrelated files retain their known-bug cases.
// Invariants: mutations use owned fixtures; full pre-existing comment/review rows survive cleanup unchanged.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { admin, anon, expectDenied, fixtures, IDS, learner, must, student, startFixtureScope, finishFixtureScope, ownedInsert, withPg } from "./helpers";

const MARKER = `rls-test-${randomUUID()}`;
let seedComments: Record<string, unknown>[] | undefined;
let seedReviews: Record<string, unknown>[] | undefined;
beforeEach(async () => {
  startFixtureScope();
  seedComments = undefined;
  seedReviews = undefined;
  seedComments = must(await fixtures.from("comments").select("*").order("id"));
  seedReviews = must(await fixtures.from("reviews").select("*").order("id"));
});
afterEach(async () => {
  await finishFixtureScope();
  if (seedComments) expect(must(await fixtures.from("comments").select("*").order("id"))).toEqual(seedComments);
  if (seedReviews) expect(must(await fixtures.from("reviews").select("*").order("id"))).toEqual(seedReviews);
});
async function commentFixture(): Promise<number> {
  const values = { user_id: IDS.student, lesson_id: 3, content: `${MARKER} target comment` };
  return must(await ownedInsert("comments", values, ownedValues => fixtures.from("comments").insert(ownedValues).select("id").single())).id;
}
const review = (userId: string) => ({ user_id: userId, course_id: 2, rating: 4, content: `${MARKER} review` });
async function reviewFixture(): Promise<number> {
  return must(await ownedInsert("reviews", review(IDS.student), values => student.from("reviews").insert(values).select("id").single())).id;
}
const readComment = async (id: number) => must(await fixtures.from("comments").select("*").eq("id", id).single());
const readReview = async (id: number) => must(await fixtures.from("reviews").select("*").eq("id", id).single());

// These exact empty selectors are reserved before hostile writes, including requests without RETURNING.
describe("reviews", () => {
  it("[R1] a learner who is not enrolled cannot review the paid course", async () => {
    const { error } = await ownedInsert("reviews", review(IDS.learner), values => learner.from("reviews").insert(values));
    expectDenied(error);
    expect(must(await fixtures.from("reviews").select("id").eq("user_id", IDS.learner).eq("course_id", 2))).toEqual([]);
  });

  it("[R2] an enrolled student reviews the paid course as themself", async () => {
    expect(must(await fixtures.from("enrollments").select("id").eq("user_id", IDS.student).eq("course_id", 2))).toHaveLength(1);
    const id = await reviewFixture();
    expect(await readReview(id)).toMatchObject(review(IDS.student));
  });

  it("[R6] anon cannot insert a review for an enrolled student", async () => {
    const { error } = await ownedInsert("reviews", review(IDS.student), values => anon.from("reviews").insert(values));
    expectDenied(error);
    expect(must(await fixtures.from("reviews").select("id").eq("user_id", IDS.student).eq("course_id", 2))).toEqual([]);
  });

  it("[K1] an enrolled student cannot insert a review as another user (SH-P3)", async () => {
    expect(must(await fixtures.from("enrollments").select("id").eq("user_id", IDS.student).eq("course_id", 2))).toHaveLength(1);
    const { error } = await ownedInsert("reviews", review(IDS.learner), values => student.from("reviews").insert(values));
    expectDenied(error);
    expect(must(await fixtures.from("reviews").select("id").eq("user_id", IDS.learner).eq("course_id", 2))).toEqual([]);
  });

  it("[R7] the author can update their own review", async () => {
    const id = await reviewFixture();
    const change = { rating: 5, content: `${MARKER} edited review` };
    const { data, error } = await student.from("reviews").update(change).eq("id", id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id }]);
    expect(await readReview(id)).toMatchObject({ ...review(IDS.student), ...change });
  });

  it("[R8] the author cannot reassign their review", async () => {
    const id = await reviewFixture();
    const before = await readReview(id);
    const { error } = await student.from("reviews").update({ user_id: IDS.learner }).eq("id", id);
    expectDenied(error);
    expect(await readReview(id)).toEqual(before);
  });

  it("[R9] own enrolled upsert supports both insert and update branches", async () => {
    const values = review(IDS.student);
    const inserted = must(await ownedInsert("reviews", values, owned => student.from("reviews").upsert(owned, { onConflict: "user_id,course_id" }).select("id").single()));
    expect(await readReview(inserted.id)).toMatchObject(values);
    const changed = { ...values, rating: 5, content: `${MARKER} upsert edited` };
    const updated = must(await student.from("reviews").upsert(changed, { onConflict: "user_id,course_id" }).select("id").single());
    expect(updated.id).toBe(inserted.id);
    expect(await readReview(inserted.id)).toMatchObject(changed);
    expect(must(await fixtures.from("reviews").select("id").eq("user_id", IDS.student).eq("course_id", 2))).toEqual([{ id: inserted.id }]);
  });

  it("[R10] another user updates no rows of the student's review", async () => {
    const id = await reviewFixture();
    const before = await readReview(id);
    const { data, error } = await learner.from("reviews").update({ rating: 1 }).eq("id", id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(await readReview(id)).toEqual(before);
  });

  it("[R11] an enrolled student's forged upsert inserts no review", async () => {
    const { error } = await ownedInsert("reviews", review(IDS.learner), values => student.from("reviews").upsert(values, { onConflict: "user_id,course_id" }));
    expectDenied(error);
    expect(must(await fixtures.from("reviews").select("id").eq("user_id", IDS.learner).eq("course_id", 2))).toEqual([]);
  });
});

describe("comments", () => {
  it("[R3] a learner cannot comment as the student", async () => {
    const values = { user_id: IDS.student, lesson_id: 3, content: `${MARKER} forged comment` };
    const { error } = await ownedInsert("comments", values, owned => learner.from("comments").insert(owned));
    expectDenied(error);
    expect(must(await fixtures.from("comments").select("id").eq("content", values.content))).toEqual([]);
  });

  it("[R4] a learner updates no rows of the student's comment", async () => {
    const id = await commentFixture();
    const before = await readComment(id);
    const { data, error } = await learner.from("comments").update({ content: `${MARKER} hijacked` }).eq("id", id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(await readComment(id)).toEqual(before);
  });

  it("[R5] an admin soft-deletes the student's comment", async () => {
    const id = await commentFixture();
    const before = await readComment(id);
    const deletedAt = new Date().toISOString();
    const { data, error } = await admin.from("comments").update({ deleted_at: deletedAt }).eq("id", id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id }]);
    const after = await readComment(id);
    expect(Date.parse(after.deleted_at)).toBe(Date.parse(deletedAt));
    expect(after).toMatchObject({ user_id: before.user_id, lesson_id: before.lesson_id, content: before.content });
  });

  it("[R12] the owner edits content without changing comment identity", async () => {
    const id = await commentFixture();
    const content = `${MARKER} owner edited`;
    const { data, error } = await student.from("comments").update({ content }).eq("id", id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id }]);
    expect(await readComment(id)).toMatchObject({ user_id: IDS.student, lesson_id: 3, content });
  });

  for (const [actorName, actor] of [["owner", student], ["admin JWT", admin]] as const) {
    for (const [column, value] of [["lesson_id", 4], ["user_id", IDS.learner]] as const) {
      it(`[K2] ${actorName} cannot reassign comment ${column} (SH-P4)`, async () => {
        const id = await commentFixture();
        const before = await readComment(id);
        const { error } = await actor.from("comments").update({ [column]: value }).eq("id", id);
        expectDenied(error);
        expect(await readComment(id)).toEqual(before);
      });
    }
  }

  for (const [column, value] of [["lesson_id", 4], ["user_id", IDS.learner]] as const) {
    it(`[R13] local SQL service_role cannot reassign comment ${column}`, async () => {
      const id = await commentFixture();
      const before = await readComment(id);
      // A distinct SQL connection exercises the privileged writer; fixtures never sends this request.
      await withPg(async client => {
        await client.query("begin");
        try {
          await client.query("set local role service_role");
          expect((await client.query("select current_user as actor")).rows).toEqual([{ actor: "service_role" }]);
          await expect(client.query(`update public.comments set ${column} = $1 where id = $2`, [value, id])).rejects.toMatchObject({ code: "42501" });
        } finally { await client.query("rollback"); }
      });
      expect(await readComment(id)).toEqual(before);
    });
  }
});

it("[R14] the immutable-comment trigger is attached with invoker privileges and no public API execute access", async () => {
  await withPg(async client => {
    const { rows } = await client.query(`select p.prosecdef, p.proconfig, t.tgtype, t.tgenabled, t.tgqual,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
      exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_execute
      from pg_proc p join pg_trigger t on t.tgfoid = p.oid
      where p.oid = to_regprocedure('public.prevent_comment_reassign()')
        and t.tgrelid = 'public.comments'::regclass and t.tgname = 'comments_prevent_reassign' and not t.tgisinternal`);
    expect(rows).toEqual([{ prosecdef: false, proconfig: ['search_path=""'], tgtype: 19, tgenabled: "O", tgqual: null,
      anon_execute: false, authenticated_execute: false, public_execute: false }]);
  });
});
