// Test plan
// Goal: per-user data (enrollments, payments, notes, progress, notifications) is visible and writable only by
//   its owner, enrollments need a free course, and payments and notifications cannot be forged by a learner.
// Layer: rls (local Supabase stack, requests through the API as each actor).
// Subject: baseline policies on enrollments, payments, notes, user_progress and notifications.
// Allowed paths: a learner enrolls themself in a free course; a student reads and edits their own rows; an admin
//   inserts a notification.
// Denied paths: enrolling in a paid course or for someone else; reading another user's rows; inserting a
//   payment or a notification as a learner; writing a note or progress row for another user; changing another
//   user's notification.
// Known bugs: none.
// Invariants: only acquired seed fields are restored; inserted IDs are cleaned through the service role.
//   The progress-delete row uses a temporary owned row and preserves the seed identity/timestamp.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { admin, anon, expectDenied, fixtures, IDS, learner, must, student, startFixtureScope, finishFixtureScope, fixtureScope, ownedInsert } from "./helpers";

const MARKER = `rls-test-${randomUUID()}`;
const SEED_NOTE = "Nhớ phân biệt let và const.";

beforeEach(() => { startFixtureScope(); });
afterEach(finishFixtureScope);

describe("enrollments", () => {
  it("[E1] a learner enrolls themself in the free course", async () => {
    const { data, error } = await ownedInsert("enrollments", { user_id: IDS.learner, course_id: 1 }, ownedValues => learner
      .from("enrollments")
      .insert(ownedValues)
      .select("user_id, course_id"));
    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: IDS.learner, course_id: 1 }]);
  });

  it("[E2] a learner cannot enroll themself in the paid course", async () => {
    const { error } = await ownedInsert("enrollments", { user_id: IDS.learner, course_id: 2 }, ownedValues => learner.from("enrollments").insert(ownedValues));
    expectDenied(error);
    expect(must(await fixtures.from("enrollments").select("id").eq("user_id", IDS.learner))).toEqual([]);
  });

  it("[E3] a learner cannot enroll the student in the free course", async () => {
    expect(must(await fixtures.from("enrollments").select("id").eq("user_id", IDS.student).eq("course_id", 1))).toEqual([]);

    const { error } = await ownedInsert("enrollments", { user_id: IDS.student, course_id: 1 }, ownedValues => learner.from("enrollments").insert(ownedValues));
    expectDenied(error);
    expect(must(await fixtures.from("enrollments").select("id").eq("user_id", IDS.student).eq("course_id", 1))).toEqual([]);
  });

  it("[E4] a learner reads no enrollments", async () => {
    expect(must(await fixtures.from("enrollments").select("id"))).toHaveLength(1);

    const { data, error } = await learner.from("enrollments").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("payments", () => {
  it("[E5] a learner reads no payments", async () => {
    expect(must(await fixtures.from("payments").select("id"))).toHaveLength(1);

    const { data, error } = await learner.from("payments").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("[E5] a student reads only their own payment", async () => {
    const { data, error } = await student.from("payments").select("id, user_id, status");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: 1, user_id: IDS.student, status: "success" }]);
  });

  it("[E6] a learner cannot insert a payment", async () => {
    const { error } = await ownedInsert("payments", { user_id: IDS.learner, course_id: 2, amount: 199000, status: "approved" }, ownedValues => learner
      .from("payments")
      .insert(ownedValues));
    expectDenied(error);
    expect(must(await fixtures.from("payments").select("id").eq("user_id", IDS.learner))).toEqual([]);
  });
});

describe("notes, progress and notifications", () => {
  it.each(["notes", "user_progress", "notifications"] as const)("[N1] a learner reads none of the student's %s", async (table) => {
    const owner = table === "notifications" ? "receiver_id" : "user_id";
    expect(must(await fixtures.from(table).select("id").eq(owner, IDS.student))).toHaveLength(1);

    const { data, error } = await learner.from(table).select("id").eq(owner, IDS.student);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("[N2] a learner cannot insert a note for the student", async () => {
    const { error } = await ownedInsert("notes", { user_id: IDS.student, lesson_id: 4, content: `${MARKER} note` }, ownedValues => learner
      .from("notes")
      .insert(ownedValues));
    expectDenied(error);
    expect(must(await fixtures.from("notes").select("id").like("content", `${MARKER}%`))).toEqual([]);
  });

  it("[N2] a learner cannot insert a progress row for the student", async () => {
    expect(must(await fixtures.from("user_progress").select("id").eq("user_id", IDS.student).eq("lesson_id", 4))).toEqual([]);

    const { error } = await ownedInsert("user_progress", { user_id: IDS.student, lesson_id: 4 }, ownedValues => learner.from("user_progress").insert(ownedValues));
    expectDenied(error);
    expect(must(await fixtures.from("user_progress").select("id").eq("user_id", IDS.student).eq("lesson_id", 4))).toEqual([]);
  });

  it("[N3] a student updates their own note", async () => {
    await fixtureScope().acquire("notes", 1, ["content"], { content: SEED_NOTE });
    const { data, error } = await student.from("notes").update({ content: `${MARKER} edited` }).eq("id", 1).select("content");
    expect(error).toBeNull();
    expect(data).toEqual([{ content: `${MARKER} edited` }]);
  });

  it("[N3] a student deletes their own progress row", async () => {
    const seed = must(await fixtures.from("user_progress").select("id,user_id,lesson_id,completed_at").eq("id", 1).single());
    const values = { user_id: IDS.student, lesson_id: 4 };
    const { id } = must(await ownedInsert("user_progress", values, ownedValues => fixtures.from("user_progress").insert(ownedValues).select("id").single()));
    const { data, error } = await student.from("user_progress").delete().eq("id", id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id }]);
    expect(must(await fixtures.from("user_progress").select("id").eq("id", id))).toEqual([]);
    expect(must(await fixtures.from("user_progress").select("id,user_id,lesson_id,completed_at").eq("id", 1).single())).toEqual(seed);
  });

  it("[N4] a learner cannot insert a notification", async () => {
    const { error } = await ownedInsert("notifications", { receiver_id: IDS.learner, title: `${MARKER} learner`, type: "system" }, ownedValues => learner
      .from("notifications")
      .insert(ownedValues));
    expectDenied(error);
    expect(must(await fixtures.from("notifications").select("id").like("title", `${MARKER}%`))).toEqual([]);
  });

  it("[N4] an anon client cannot insert a notification", async () => {
    const { error } = await ownedInsert("notifications", { receiver_id: IDS.learner, title: `${MARKER} anon`, type: "system" }, ownedValues => anon
      .from("notifications")
      .insert(ownedValues));
    expectDenied(error);
    expect(must(await fixtures.from("notifications").select("id").like("title", `${MARKER}%`))).toEqual([]);
  });

  it("[N4] an admin inserts a notification", async () => {
    // No returning clause: the admin has no SELECT policy for the learner's notification, and PostgREST
    // would report the denied read-back of the new row as an insert error.
    const { error } = await ownedInsert("notifications", { receiver_id: IDS.learner, actor_id: IDS.admin, title: `${MARKER} admin`, type: "system" }, ownedValues => admin
      .from("notifications")
      .insert(ownedValues));
    expect(error).toBeNull();
    expect(must(await fixtures.from("notifications").select("receiver_id").like("title", `${MARKER}%`))).toEqual([
      { receiver_id: IDS.learner },
    ]);
  });

  it("[N5] a learner updates no rows of the student's notification", async () => {
    await fixtureScope().acquire("notifications", 1, ["is_read"], { is_read: false });
    const { data, error } = await learner.from("notifications").update({ is_read: true }).eq("id", 1).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(must(await fixtures.from("notifications").select("is_read").eq("id", 1).single())).toEqual({ is_read: false });
  });
});
