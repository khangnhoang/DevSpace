// Test plan
// Goal: only enrolled authors create reviews; comments retain their owner and lesson for every writer, deleted comments are hidden from every API role, and only enrolled learners or admins create comments.
// Layer: rls (local Supabase API actors), plus separately awaited local SQL service_role and catalog probes.
// Subject: security-hotfix SH-P3/SH-P4 (historical P3/K1, P4/K2), review policies and comment trigger; security-engineering SE-P4 (comments policies and public.soft_delete_comment).
// Allowed paths: own enrolled INSERT/UPDATE/upsert, owner content edit, owner/admin soft delete through the function, enrolled or admin comment INSERT.
// Denied paths: anon/unenrolled/forged reviews, another user's edits, owner/admin/service_role reassignment, any read or edit of a deleted comment, unenrolled/forged/pre-deleted comment INSERT, a direct soft delete.
// Known bugs: none in this subject; unrelated files retain their known-bug cases.
// Invariants: mutations use owned fixtures; full pre-existing comment/review rows survive cleanup unchanged.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type pg from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  admin,
  anon,
  expectDenied,
  fixtures,
  IDS,
  learner,
  must,
  student,
  startFixtureScope,
  finishFixtureScope,
  ownedInsert,
  withPg,
} from "./helpers";

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
  if (seedComments)
    expect(
      must(await fixtures.from("comments").select("*").order("id")),
    ).toEqual(seedComments);
  if (seedReviews)
    expect(
      must(await fixtures.from("reviews").select("*").order("id")),
    ).toEqual(seedReviews);
});
async function commentFixture(): Promise<number> {
  const values = {
    user_id: IDS.student,
    lesson_id: 3,
    content: `${MARKER} target comment`,
  };
  return must(
    await ownedInsert("comments", values, (ownedValues) =>
      fixtures.from("comments").insert(ownedValues).select("id").single(),
    ),
  ).id;
}
const review = (userId: string) => ({
  user_id: userId,
  course_id: 2,
  rating: 4,
  content: `${MARKER} review`,
});
async function reviewFixture(): Promise<number> {
  return must(
    await ownedInsert("reviews", review(IDS.student), (values) =>
      student.from("reviews").insert(values).select("id").single(),
    ),
  ).id;
}
const readComment = async (id: number) =>
  must(await fixtures.from("comments").select("*").eq("id", id).single());
const readReview = async (id: number) =>
  must(await fixtures.from("reviews").select("*").eq("id", id).single());

// These exact empty selectors are reserved before hostile writes, including requests without RETURNING.
describe("reviews", () => {
  it("[R1] a learner who is not enrolled cannot review the paid course", async () => {
    const { error } = await ownedInsert(
      "reviews",
      review(IDS.learner),
      (values) => learner.from("reviews").insert(values),
    );
    expectDenied(error);
    expect(
      must(
        await fixtures
          .from("reviews")
          .select("id")
          .eq("user_id", IDS.learner)
          .eq("course_id", 2),
      ),
    ).toEqual([]);
  });

  it("[R2] an enrolled student reviews the paid course as themself", async () => {
    expect(
      must(
        await fixtures
          .from("enrollments")
          .select("id")
          .eq("user_id", IDS.student)
          .eq("course_id", 2),
      ),
    ).toHaveLength(1);
    const id = await reviewFixture();
    expect(await readReview(id)).toMatchObject(review(IDS.student));
  });

  it("[R6] anon cannot insert a review for an enrolled student", async () => {
    const { error } = await ownedInsert(
      "reviews",
      review(IDS.student),
      (values) => anon.from("reviews").insert(values),
    );
    expectDenied(error);
    expect(
      must(
        await fixtures
          .from("reviews")
          .select("id")
          .eq("user_id", IDS.student)
          .eq("course_id", 2),
      ),
    ).toEqual([]);
  });

  it("[K1] an enrolled student cannot insert a review as another user (SH-P3)", async () => {
    expect(
      must(
        await fixtures
          .from("enrollments")
          .select("id")
          .eq("user_id", IDS.student)
          .eq("course_id", 2),
      ),
    ).toHaveLength(1);
    const { error } = await ownedInsert(
      "reviews",
      review(IDS.learner),
      (values) => student.from("reviews").insert(values),
    );
    expectDenied(error);
    expect(
      must(
        await fixtures
          .from("reviews")
          .select("id")
          .eq("user_id", IDS.learner)
          .eq("course_id", 2),
      ),
    ).toEqual([]);
  });

  it("[R7] the author can update their own review", async () => {
    const id = await reviewFixture();
    const change = { rating: 5, content: `${MARKER} edited review` };
    const { data, error } = await student
      .from("reviews")
      .update(change)
      .eq("id", id)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id }]);
    expect(await readReview(id)).toMatchObject({
      ...review(IDS.student),
      ...change,
    });
  });

  it("[R8] the author cannot reassign their review", async () => {
    const id = await reviewFixture();
    const before = await readReview(id);
    const { error } = await student
      .from("reviews")
      .update({ user_id: IDS.learner })
      .eq("id", id);
    expectDenied(error);
    expect(await readReview(id)).toEqual(before);
  });

  it("[R9] own enrolled upsert supports both insert and update branches", async () => {
    const values = review(IDS.student);
    const inserted = must(
      await ownedInsert("reviews", values, (owned) =>
        student
          .from("reviews")
          .upsert(owned, { onConflict: "user_id,course_id" })
          .select("id")
          .single(),
      ),
    );
    expect(await readReview(inserted.id)).toMatchObject(values);
    const changed = {
      ...values,
      rating: 5,
      content: `${MARKER} upsert edited`,
    };
    const updated = must(
      await student
        .from("reviews")
        .upsert(changed, { onConflict: "user_id,course_id" })
        .select("id")
        .single(),
    );
    expect(updated.id).toBe(inserted.id);
    expect(await readReview(inserted.id)).toMatchObject(changed);
    expect(
      must(
        await fixtures
          .from("reviews")
          .select("id")
          .eq("user_id", IDS.student)
          .eq("course_id", 2),
      ),
    ).toEqual([{ id: inserted.id }]);
  });

  it("[R10] another user updates no rows of the student's review", async () => {
    const id = await reviewFixture();
    const before = await readReview(id);
    const { data, error } = await learner
      .from("reviews")
      .update({ rating: 1 })
      .eq("id", id)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(await readReview(id)).toEqual(before);
  });

  it("[R11] an enrolled student's forged upsert inserts no review", async () => {
    const { error } = await ownedInsert(
      "reviews",
      review(IDS.learner),
      (values) =>
        student
          .from("reviews")
          .upsert(values, { onConflict: "user_id,course_id" }),
    );
    expectDenied(error);
    expect(
      must(
        await fixtures
          .from("reviews")
          .select("id")
          .eq("user_id", IDS.learner)
          .eq("course_id", 2),
      ),
    ).toEqual([]);
  });
});

describe("comments", () => {
  it("[R3] a learner cannot comment as the student", async () => {
    const values = {
      user_id: IDS.student,
      lesson_id: 3,
      content: `${MARKER} forged comment`,
    };
    const { error } = await ownedInsert("comments", values, (owned) =>
      learner.from("comments").insert(owned),
    );
    expectDenied(error);
    expect(
      must(
        await fixtures
          .from("comments")
          .select("id")
          .eq("content", values.content),
      ),
    ).toEqual([]);
  });

  it("[R4] a learner updates no rows of the student's comment", async () => {
    const id = await commentFixture();
    const before = await readComment(id);
    const { data, error } = await learner
      .from("comments")
      .update({ content: `${MARKER} hijacked` })
      .eq("id", id)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(await readComment(id)).toEqual(before);
  });

  it("[R5] an admin soft-deletes the student's comment through the function", async () => {
    const id = await commentFixture();
    const before = await readComment(id);
    const { data, error } = await admin.rpc("soft_delete_comment", {
      comment_id: id,
    });
    expect(error).toBeNull();
    expect(data).toBe(true);
    const after = await readComment(id);
    expect(after.deleted_at).not.toBeNull();
    expect(after).toMatchObject({
      user_id: before.user_id,
      lesson_id: before.lesson_id,
      content: before.content,
    });
  });

  it("[R12] the owner edits content without changing comment identity", async () => {
    const id = await commentFixture();
    const content = `${MARKER} owner edited`;
    const { data, error } = await student
      .from("comments")
      .update({ content })
      .eq("id", id)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id }]);
    expect(await readComment(id)).toMatchObject({
      user_id: IDS.student,
      lesson_id: 3,
      content,
    });
  });

  for (const [actorName, actor] of [
    ["owner", student],
    ["admin JWT", admin],
  ] as const) {
    for (const [column, value] of [
      ["lesson_id", 4],
      ["user_id", IDS.learner],
    ] as const) {
      it(`[K2] ${actorName} cannot reassign comment ${column} (SH-P4)`, async () => {
        const id = await commentFixture();
        const before = await readComment(id);
        const { error } = await actor
          .from("comments")
          .update({ [column]: value })
          .eq("id", id);
        expectDenied(error);
        expect(await readComment(id)).toEqual(before);
      });
    }
  }

  for (const [column, value] of [
    ["lesson_id", 4],
    ["user_id", IDS.learner],
  ] as const) {
    it(`[R13] local SQL service_role cannot reassign comment ${column}`, async () => {
      const id = await commentFixture();
      const before = await readComment(id);
      // A distinct SQL connection exercises the privileged writer; fixtures never sends this request.
      await withPg(async (client) => {
        await client.query("begin");
        try {
          await client.query("set local role service_role");
          expect(
            (await client.query("select current_user as actor")).rows,
          ).toEqual([{ actor: "service_role" }]);
          await expect(
            client.query(
              `update public.comments set ${column} = $1 where id = $2`,
              [value, id],
            ),
          ).rejects.toMatchObject({ code: "42501" });
        } finally {
          await client.query("rollback");
        }
      });
      expect(await readComment(id)).toEqual(before);
    });
  }
});

// SE-P4. The stored row of a deleted comment is proved present through the service role before every "hidden" claim.
async function deletedFixture(): Promise<{ id: number; content: string }> {
  const id = await commentFixture();
  const original = await readComment(id);
  must(
    await fixtures
      .from("comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id),
  );
  const stored = await readComment(id);
  expect(stored.deleted_at).not.toBeNull();
  expect(stored.content).toBe(original.content);
  return { id, content: stored.content };
}
const actors = [
  ["anon", anon],
  ["learner", learner],
  ["student owner", student],
  ["admin", admin],
] as const;
const claims = (sub: string) => JSON.stringify({ sub, role: "authenticated" });

describe("deleted comments are hidden from the API (SE-P4)", () => {
  it("[R15] G3: a direct soft delete through REST is refused once deleted rows are hidden", async () => {
    const id = await commentFixture();
    const before = await readComment(id);
    // The pre-function code path: the new row would be invisible, so PostgreSQL refuses the UPDATE.
    const withReturn = await student
      .from("comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    expectDenied(withReturn.error);
    const withoutReturn = await student
      .from("comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    expectDenied(withoutReturn.error);
    expect(await readComment(id)).toEqual(before);
  });

  for (const [name, actor] of actors) {
    it(`[R16] ${name} gets no deleted comment by lesson, id, user or deleted_at filter`, async () => {
      const { id } = await deletedFixture();
      const byLesson = must(
        await actor
          .from("comments")
          .select("id, deleted_at")
          .eq("lesson_id", 3),
      );
      expect(byLesson.map((row) => row.id)).not.toContain(id);
      expect(byLesson.every((row) => row.deleted_at === null)).toBe(true);
      expect(
        must(await actor.from("comments").select("id, content").eq("id", id)),
      ).toEqual([]);
      expect(
        must(
          await actor
            .from("comments")
            .select("id")
            .eq("user_id", IDS.student)
            .eq("id", id),
        ),
      ).toEqual([]);
      expect(
        must(
          await actor
            .from("comments")
            .select("id")
            .not("deleted_at", "is", null)
            .eq("id", id),
        ),
      ).toEqual([]);
      expect(
        must(
          await actor
            .from("comments")
            .select("id")
            .not("deleted_at", "is", null),
        ).map((row) => row.id),
      ).not.toContain(id);
      expect(
        must(await actor.from("comments").select("id").order("id")).map(
          (row) => row.id,
        ),
      ).not.toContain(id);
    });
  }

  it("[R17] non-deleted comments stay readable by anon", async () => {
    const id = await commentFixture();
    expect(
      must(await anon.from("comments").select("id, content").eq("id", id)),
    ).toHaveLength(1);
    expect(must(await anon.from("comments").select("id").eq("id", 1))).toEqual([
      { id: 1 },
    ]);
  });

  for (const [name, actor] of [
    ["student owner", student],
    ["admin", admin],
    ["learner", learner],
  ] as const) {
    it(`[R18] ${name} edits, restores or re-deletes no deleted comment`, async () => {
      const { id } = await deletedFixture();
      const before = await readComment(id);
      for (const change of [
        { content: `${MARKER} revived` },
        { deleted_at: null },
        { deleted_at: new Date().toISOString() },
      ]) {
        const { data, error } = await actor
          .from("comments")
          .update(change)
          .eq("id", id)
          .select("id");
        // Refused outright or filtered to zero rows; a returned row would be an edit or a restore.
        if (error) expectDenied(error);
        else expect(data).toEqual([]);
        expect(await readComment(id)).toEqual(before);
      }
    });
  }

  it("[R19] an owner UPDATE of a deleted comment that references no column changes no deleted row", async () => {
    const { id, content } = await deletedFixture();
    const before = await readComment(id);
    await withPg(async (client) => {
      await client.query("begin");
      try {
        await client.query("set local role authenticated");
        await client.query(
          "select set_config('request.jwt.claims', $1, true)",
          [claims(IDS.student)],
        );
        expect(
          (await client.query("select auth.uid()::text as uid")).rows,
        ).toEqual([{ uid: IDS.student }]);
        // No WHERE and no RETURNING: only the UPDATE policy's USING decides which rows are reachable.
        const result = await client.query(
          "update public.comments set content = 'rls-test-no-column-probe'",
        );
        expect(result.rowCount).toBeGreaterThan(0);
        await client.query("reset role");
        const probed = (
          await client.query(
            "select content, deleted_at from public.comments where id = $1",
            [id],
          )
        ).rows[0];
        expect(probed.content).toBe(content);
        expect(probed.deleted_at).not.toBeNull();
      } finally {
        await client.query("rollback");
      }
    });
    expect(await readComment(id)).toEqual(before);
  });
});

describe("soft_delete_comment (SE-P4)", () => {
  it("[R21] the owner soft-deletes their comment and the content stays stored", async () => {
    const id = await commentFixture();
    const before = await readComment(id);
    const { data, error } = await student.rpc("soft_delete_comment", {
      comment_id: id,
    });
    expect(error).toBeNull();
    expect(data).toBe(true);
    const after = await readComment(id);
    expect(after.deleted_at).not.toBeNull();
    expect(after).toMatchObject({
      user_id: before.user_id,
      lesson_id: before.lesson_id,
      content: before.content,
    });
    expect(
      must(await student.from("comments").select("id").eq("id", id)),
    ).toEqual([]);
  });

  it("[R22] a second delete of the same comment changes nothing and reports not found", async () => {
    const { id } = await deletedFixture();
    const before = await readComment(id);
    for (const actor of [student, admin]) {
      const { data, error } = await actor.rpc("soft_delete_comment", {
        comment_id: id,
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    }
    expect(await readComment(id)).toEqual(before);
  });

  it("[R23] another non-admin changes nothing", async () => {
    const id = await commentFixture();
    const before = await readComment(id);
    const { data, error } = await learner.rpc("soft_delete_comment", {
      comment_id: id,
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
    expect(await readComment(id)).toEqual(before);
  });

  it("[R24] anon cannot execute the function and changes nothing", async () => {
    const id = await commentFixture();
    const before = await readComment(id);
    const { error } = await anon.rpc("soft_delete_comment", { comment_id: id });
    expectDenied(error);
    expect(await readComment(id)).toEqual(before);
  });

  it("[R25] an unknown comment id reports not found", async () => {
    const { data, error } = await student.rpc("soft_delete_comment", {
      comment_id: 2147483000,
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });
});

describe("comment INSERT needs enrollment or admin (SE-P4)", () => {
  const comment = (
    userId: string,
    lessonId: number,
    label: string,
    extra: Record<string, unknown> = {},
  ) => ({
    user_id: userId,
    lesson_id: lessonId,
    content: `${MARKER} ${label}`,
    ...extra,
  });

  it("[R26] an enrolled student comments as themself on a lesson of their course", async () => {
    expect(
      must(
        await fixtures
          .from("enrollments")
          .select("id")
          .eq("user_id", IDS.student)
          .eq("course_id", 2),
      ),
    ).toHaveLength(1);
    const values = comment(IDS.student, 3, "enrolled student");
    const row = must(
      await ownedInsert("comments", values, (owned) =>
        student
          .from("comments")
          .insert(owned)
          .select("id, deleted_at")
          .single(),
      ),
    );
    expect(row.deleted_at).toBeNull();
    expect(await readComment(row.id)).toMatchObject(values);
  });

  for (const lessonId of [1, 3]) {
    it(`[R27] an admin comments on lesson ${lessonId} without enrollment`, async () => {
      expect(
        must(
          await fixtures
            .from("enrollments")
            .select("id")
            .eq("user_id", IDS.admin),
        ),
      ).toEqual([]);
      const values = comment(IDS.admin, lessonId, `admin lesson ${lessonId}`);
      const row = must(
        await ownedInsert("comments", values, (owned) =>
          admin.from("comments").insert(owned).select("id").single(),
        ),
      );
      expect(await readComment(row.id)).toMatchObject(values);
    });

    it(`[R28] a learner who is not enrolled cannot comment on lesson ${lessonId} (${lessonId === 1 ? "free" : "paid"} course)`, async () => {
      expect(
        must(
          await fixtures
            .from("enrollments")
            .select("id")
            .eq("user_id", IDS.learner),
        ),
      ).toEqual([]);
      const values = comment(
        IDS.learner,
        lessonId,
        `unenrolled lesson ${lessonId}`,
      );
      const { error } = await ownedInsert("comments", values, (owned) =>
        learner.from("comments").insert(owned),
      );
      expectDenied(error);
      expect(
        must(
          await fixtures
            .from("comments")
            .select("id")
            .eq("content", values.content),
        ),
      ).toEqual([]);
    });
  }

  it("[R29] an enrolled student cannot comment on a lesson of a course they are not enrolled in", async () => {
    const values = comment(IDS.student, 1, "student other course");
    const { error } = await ownedInsert("comments", values, (owned) =>
      student.from("comments").insert(owned),
    );
    expectDenied(error);
    expect(
      must(
        await fixtures
          .from("comments")
          .select("id")
          .eq("content", values.content),
      ),
    ).toEqual([]);
  });

  it("[R30] an enrolled student cannot forge another user as the author", async () => {
    const values = comment(IDS.admin, 3, "forged author");
    const { error } = await ownedInsert("comments", values, (owned) =>
      student.from("comments").insert(owned),
    );
    expectDenied(error);
    expect(
      must(
        await fixtures
          .from("comments")
          .select("id")
          .eq("content", values.content),
      ),
    ).toEqual([]);
  });

  for (const [name, actor, userId] of [
    ["an enrolled student", student, IDS.student],
    ["an admin", admin, IDS.admin],
  ] as const) {
    it(`[R31] ${name} cannot insert a comment that is already deleted`, async () => {
      const values = comment(userId, 3, `pre-deleted ${name}`, {
        deleted_at: new Date().toISOString(),
      });
      const { error } = await ownedInsert("comments", values, (owned) =>
        actor.from("comments").insert(owned),
      );
      expectDenied(error);
      expect(
        must(
          await fixtures
            .from("comments")
            .select("id")
            .eq("content", values.content),
        ),
      ).toEqual([]);
    });
  }

  it("[R32] anon cannot insert a comment", async () => {
    const values = comment(IDS.student, 3, "anon");
    const { error } = await ownedInsert("comments", values, (owned) =>
      anon.from("comments").insert(owned),
    );
    expectDenied(error);
    expect(
      must(
        await fixtures
          .from("comments")
          .select("id")
          .eq("content", values.content),
      ),
    ).toEqual([]);
  });
});

it("[R14] the immutable-comment trigger is attached with invoker privileges and no public API execute access", async () => {
  await withPg(async (client) => {
    const { rows } =
      await client.query(`select p.prosecdef, p.proconfig, t.tgtype, t.tgenabled, t.tgqual,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
      exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_execute
      from pg_proc p join pg_trigger t on t.tgfoid = p.oid
      where p.oid = to_regprocedure('public.prevent_comment_reassign()')
        and t.tgrelid = 'public.comments'::regclass and t.tgname = 'comments_prevent_reassign' and not t.tgisinternal`);
    expect(rows).toEqual([
      {
        prosecdef: false,
        proconfig: ['search_path=""'],
        tgtype: 19,
        tgenabled: "O",
        tgqual: null,
        anon_execute: false,
        authenticated_execute: false,
        public_execute: false,
      },
    ]);
  });
});

// SE-P4 catalog and rollback. The rollback runs inside one rolled-back transaction, so it can leave nothing behind.
const commentsCatalog = async (client: pg.Client) => ({
  policies: (
    await client.query(`select policyname, cmd, roles::text as roles,
      regexp_replace(coalesce(qual, ''), '[[:space:]]+', ' ', 'g') as qual,
      regexp_replace(coalesce(with_check, ''), '[[:space:]]+', ' ', 'g') as with_check
    from pg_policies where schemaname = 'public' and tablename = 'comments' order by policyname`)
  ).rows,
  fn: (
    await client.query(`select p.prosecdef, pg_get_userbyid(p.proowner) as owner, p.proconfig,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
      exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_execute
    from pg_proc p where p.oid = to_regprocedure('public.soft_delete_comment(bigint)')`)
  ).rows,
  triggers: (
    await client.query(`select tgname, tgenabled from pg_trigger
    where tgrelid = 'public.comments'::regclass and not tgisinternal order by tgname`)
  ).rows,
});

const previousComments = [
  {
    policyname: "Authenticated users can comment",
    cmd: "INSERT",
    roles: "{authenticated}",
    qual: "",
    with_check: "(auth.uid() = user_id)",
  },
  {
    policyname: "Owners and Admins can update/soft-delete comments",
    cmd: "UPDATE",
    roles: "{authenticated}",
    qual: "((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))",
    with_check: "((( SELECT auth.uid() AS uid) = user_id) OR is_admin())",
  },
  {
    policyname: "Public view ALL comments",
    cmd: "SELECT",
    roles: "{public}",
    qual: "true",
    with_check: "",
  },
];

it("[R33] comments carry exactly one SELECT, INSERT and UPDATE policy and the function is a locked-down security definer", async () => {
  await withPg(async (client) => {
    const catalog = await commentsCatalog(client);
    expect(catalog.policies).toEqual([
      {
        policyname: "Owners and Admins can update/soft-delete comments",
        cmd: "UPDATE",
        roles: "{authenticated}",
        qual: "((deleted_at IS NULL) AND ((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))))",
        with_check: "((( SELECT auth.uid() AS uid) = user_id) OR is_admin())",
      },
      {
        policyname: "comments_insert_enrolled_or_admin",
        cmd: "INSERT",
        roles: "{authenticated}",
        qual: "",
        with_check:
          "((user_id = ( SELECT auth.uid() AS uid)) AND (deleted_at IS NULL) AND (is_admin() OR (EXISTS ( SELECT 1 FROM (lessons l JOIN enrollments e ON ((e.course_id = l.course_id))) WHERE ((l.id = comments.lesson_id) AND (e.user_id = ( SELECT auth.uid() AS uid)))))))",
      },
      {
        policyname: "comments_select_not_deleted",
        cmd: "SELECT",
        roles: "{public}",
        qual: "(deleted_at IS NULL)",
        with_check: "",
      },
    ]);
    expect(catalog.fn).toEqual([
      {
        prosecdef: true,
        owner: "postgres",
        proconfig: ['search_path=""'],
        anon_execute: false,
        authenticated_execute: true,
        public_execute: false,
      },
    ]);
    expect(catalog.triggers).toEqual([
      { tgname: "comments_prevent_reassign", tgenabled: "O" },
      { tgname: "update_comments_updated_at", tgenabled: "O" },
    ]);
  });
});

it("[R34] the rollback restores the previous comment policies exactly, drops the function, keeps data, and the migration reapplies", async () => {
  const name = "20261106174213_se_u4_comment_integrity";
  const read = async (dir: string, file: string) =>
    (
      await readFile(
        new URL(`../../supabase/${dir}/${file}`, import.meta.url),
        "utf8",
      )
    )
      .replace(/^begin;$/m, "")
      .replace(/^commit;$/m, "");
  const up = await read("migrations", `${name}.sql`);
  const down = await read("rollbacks", `${name}.down.sql`);
  const rowsBefore = must(
    await fixtures.from("comments").select("*").order("id"),
  );
  await withPg(async (client) => {
    await client.query("begin");
    try {
      const forward = await commentsCatalog(client);
      await client.query(down);
      const previous = await commentsCatalog(client);
      expect(previous.policies).toEqual(previousComments);
      expect(previous.fn).toEqual([]);
      expect(previous.triggers).toEqual(forward.triggers);
      const inTransaction = (
        await client.query("select count(*)::int as n from public.comments")
      ).rows[0].n;
      expect(inTransaction).toBe(rowsBefore.length);
      await client.query(up);
      expect(await commentsCatalog(client)).toEqual(forward);
    } finally {
      await client.query("rollback");
    }
  });
  expect(must(await fixtures.from("comments").select("*").order("id"))).toEqual(
    rowsBefore,
  );
});
