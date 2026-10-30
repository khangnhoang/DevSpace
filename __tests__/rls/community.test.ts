// Test plan
// Goal: reviews and comments can be written only by an enrolled author, comments change only by their owner or
//   an admin, and the two known gaps (P3, P4) stay visible until they are fixed.
// Layer: rls (local Supabase stack, requests through the API as each actor).
// Subject: baseline policies on reviews and comments.
// Allowed paths: an enrolled student reviews a course as themself; an admin soft-deletes a comment.
// Denied paths: reviewing a course without enrollment; commenting as another user; updating another user's comment.
// Known bugs: P3 (K1), a student can write a review as another user; P4 (K2), a comment owner can move their
//   comment to another lesson.
// Invariants: mutable comments are owned fixtures because every UPDATE advances updated_at. The full seed
//   comment stays unchanged; review/comment IDs are cleaned even after unexpectedly successful denied writes.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { knownBug } from "../helpers/known-bug";
import { admin, expectDenied, fixtures, IDS, learner, must, student, startFixtureScope, finishFixtureScope, ownedInsert } from "./helpers";

const MARKER = `rls-test-${randomUUID()}`;

let seedComment: Record<string, unknown> | undefined;
beforeEach(async () => {
  startFixtureScope();
  seedComment = undefined;
  seedComment = must(await fixtures.from("comments").select("*").eq("id", 1).single());
});
afterEach(async () => {
  await finishFixtureScope();
  if (seedComment) expect(must(await fixtures.from("comments").select("*").eq("id", 1).single())).toEqual(seedComment);
});
async function commentFixture(): Promise<number> {
  const values = { user_id: IDS.student, lesson_id: 3, content: `${MARKER} target comment` };
  return must(await ownedInsert("comments", values, ownedValues => fixtures.from("comments").insert(ownedValues).select("id").single())).id;
}

const review = (userId: string) => ({ user_id: userId, course_id: 2, rating: 4, content: `${MARKER} review` });

describe("reviews", () => {
  it("[R1] a learner who is not enrolled cannot review the paid course", async () => {
    const { error } = await ownedInsert("reviews", review(IDS.learner), ownedValues => learner.from("reviews").insert(ownedValues));
    expectDenied(error);
    expect(must(await fixtures.from("reviews").select("id").eq("user_id", IDS.learner))).toEqual([]);
  });

  it("[R2] an enrolled student reviews the paid course as themself", async () => {
    const { data, error } = await ownedInsert("reviews", review(IDS.student), ownedValues => student.from("reviews").insert(ownedValues).select("user_id, course_id"));
    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: IDS.student, course_id: 2 }]);
  });
});

describe("comments", () => {
  it("[R3] a learner cannot comment as the student", async () => {
    const { error } = await ownedInsert("comments", { user_id: IDS.student, lesson_id: 3, content: `${MARKER} forged comment` }, ownedValues => learner
      .from("comments")
      .insert(ownedValues));
    expectDenied(error);
    expect(must(await fixtures.from("comments").select("id").like("content", `${MARKER}%`))).toEqual([]);
  });

  it("[R4] a learner updates no rows of the student's comment", async () => {
    const id = await commentFixture();
    const before = must(await fixtures.from("comments").select("content").eq("id", id).single());

    const { data, error } = await learner.from("comments").update({ content: `${MARKER} hijacked` }).eq("id", id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(must(await fixtures.from("comments").select("content").eq("id", id).single())).toEqual(before);
  });

  it("[R5] an admin soft-deletes the student's comment", async () => {
    const id = await commentFixture();
    const deletedAt = new Date().toISOString();
    const { data, error } = await admin.from("comments").update({ deleted_at: deletedAt }).eq("id", id).select("id, deleted_at");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].deleted_at).not.toBeNull();
  });
});

describe("known bugs", () => {
  knownBug("P3", "[K1] a student can write a review as another user", async (bug) => {
    const enrolled = must(await fixtures.from("enrollments").select("id").eq("user_id", IDS.student).eq("course_id", 2));
    expect(enrolled).toHaveLength(1);
    expect(must(await fixtures.from("reviews").select("id").eq("user_id", IDS.learner).eq("course_id", 2))).toEqual([]);

    const { error } = await ownedInsert("reviews", review(IDS.learner), ownedValues => student.from("reviews").insert(ownedValues));
    expect([null, "42501"]).toContain(error?.code ?? null);

    const forged = must(await fixtures.from("reviews").select("id").eq("user_id", IDS.learner).eq("course_id", 2));
    await bug(() => expect(forged).toEqual([]));
  });

  knownBug("P4", "[K2] a comment owner can move their comment to another lesson", async (bug) => {
    const id = await commentFixture();
    const before = must(await fixtures.from("comments").select("user_id, lesson_id").eq("id", id).single());
    expect(before).toEqual({ user_id: IDS.student, lesson_id: 3 });

    const { error } = await student.from("comments").update({ lesson_id: 4 }).eq("id", id);
    expect([null, "42501"]).toContain(error?.code ?? null);

    const after = must(await fixtures.from("comments").select("lesson_id").eq("id", id).single());
    await bug(() => expect(after.lesson_id).toBe(3));
  });
});
