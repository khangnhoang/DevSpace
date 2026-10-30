// Test plan
// Goal: course content is public except the private lesson columns and the exercises, and only an admin writes it.
// Layer: rls (local Supabase stack, requests through the API as each actor).
// Subject: policies and column grants on courses, chapters, lessons and exercises (H2-1b, baseline policies).
// Allowed paths: anyone reads courses, chapters and the granted lesson columns; an enrolled learner reads the
//   exercises of their course; an admin reads all exercises and writes content.
// Denied paths: anon and learner read lessons.content or video_url; anon and a learner without enrollment read
//   no exercises; a learner inserts, updates or deletes courses, chapters and lessons.
// Known bugs: none.
// Invariants: the seed rows (courses 1 and 2, chapters 1 and 2, lessons 1 to 4) are never write targets; rows a
//   test inserts, including the [C7] update and delete targets, have recorded intents/IDs and are deleted
//   afterwards through the service role without sweeping other markers.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { admin, anon, expectDenied, fixtures, learner, must, student, startFixtureScope, finishFixtureScope, ownedInsert } from "./helpers";

const MARKER = `rls-test-${randomUUID()}`;
const LESSON_COLUMNS = "id, title, slug, course_id, chapter_id, order_index, created_at, has_video, word_count";

beforeEach(() => { startFixtureScope(); });
afterEach(finishFixtureScope);

const ids = (rows: { id: number }[] | null) => (rows ?? []).map((row) => row.id).sort((a, b) => a - b);

describe("public reads", () => {
  it("[C1] anon reads the seed courses and chapters", async () => {
    const courses = await anon.from("courses").select("id");
    const chapters = await anon.from("chapters").select("id");
    expect(courses.error).toBeNull();
    expect(ids(courses.data)).toEqual([1, 2]);
    expect(chapters.error).toBeNull();
    expect(ids(chapters.data)).toEqual([1, 2]);
  });

  it("[C2] anon reads the four lessons through the granted columns", async () => {
    const { data, error } = await anon.from("lessons").select(LESSON_COLUMNS);
    expect(error).toBeNull();
    expect(ids(data)).toEqual([1, 2, 3, 4]);
  });
});

describe("private lesson columns", () => {
  const actors = { anon, learner };
  it.each([
    ["anon", "content"],
    ["anon", "video_url"],
    ["learner", "content"],
    ["learner", "video_url"],
  ] as const)("[C3] %s cannot select lessons.%s", async (actor, column) => {
    const { data, error } = await actors[actor].from("lessons").select(column);
    expect(data).toBeNull();
    expectDenied(error);
  });
});

describe("exercises", () => {
  it.each([
    ["anon", anon],
    ["learner", learner],
  ] as const)("[C4] %s reads no exercises", async (_actor, client) => {
    expect(must(await fixtures.from("exercises").select("id"))).toHaveLength(3);

    const { data, error } = await client.from("exercises").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("[C5] a student reads only the exercises of their course", async () => {
    const { data, error } = await student.from("exercises").select("id, lesson_id");
    expect(error).toBeNull();
    expect(ids(data)).toEqual([1, 2]);
    expect(data?.every((row) => row.lesson_id === 3)).toBe(true);
  });

  it("[C6] an admin reads all seed exercises", async () => {
    const { data, error } = await admin.from("exercises").select("id");
    expect(error).toBeNull();
    expect(ids(data)).toEqual([1, 2, 3]);
  });
});

describe("a learner cannot write content", () => {
  const newRows = {
    courses: { name: `${MARKER} course`, slug: `${MARKER}-course`, price: 0 },
    chapters: { course_id: 1, title: `${MARKER} chapter`, order_index: 9 },
    lessons: { course_id: 1, chapter_id: 1, title: `${MARKER} lesson`, slug: `${MARKER}-lesson`, order_index: 9 },
  } as const;
  const targetRows = {
    courses: { name: `${MARKER} target course`, slug: `${MARKER}-target-course`, price: 0 },
    chapters: { course_id: 1, title: `${MARKER} target chapter`, order_index: 9 },
    lessons: { course_id: 1, chapter_id: 1, title: `${MARKER} target lesson`, slug: `${MARKER}-target-lesson`, order_index: 9 },
  } as const;
  // Cleanup has adopted the fixture ID before any update, including a regressed allowed update.
  const changes = {
    courses: { name: `${MARKER} changed by learner` },
    chapters: { title: `${MARKER} changed by learner` },
    lessons: { title: `${MARKER} changed by learner` },
  } as const;
  const unchangedColumn = { courses: "name", chapters: "title", lessons: "title" } as const;

  describe.each(["courses", "chapters", "lessons"] as const)("%s", (table) => {
    it(`[C7] cannot insert a valid row into ${table}`, async () => {
      const before = must(await fixtures.from(table).select("id")).length;

      const { data, error } = await ownedInsert(table, newRows[table], ownedValues => learner.from(table).insert<(typeof newRows)[typeof table]>(ownedValues).select("id"));
      expect(data).toBeNull();
      expectDenied(error);
      expect(must(await fixtures.from(table).select("id"))).toHaveLength(before);
    });

    // The update and delete targets are marker rows made here, not seed rows: if a write policy regresses, only
    // rows that afterEach already removes are touched (a deleted seed course would cascade into its children).
    it(`[C7] updates no row of ${table}`, async () => {
      const column = unchangedColumn[table];
      const { id } = must(await ownedInsert(table, targetRows[table], ownedValues => fixtures.from(table).insert<(typeof targetRows)[typeof table]>(ownedValues).select("id").single()));
      const before = must(await fixtures.from(table).select(`id, ${column}`).eq("id", id).single());

      const { data, error } = await learner.from(table).update(changes[table]).eq("id", id).select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
      expect(must(await fixtures.from(table).select(`id, ${column}`).eq("id", id).single())).toEqual(before);
    });

    it(`[C7] deletes no row of ${table}`, async () => {
      const { id } = must(await ownedInsert(table, targetRows[table], ownedValues => fixtures.from(table).insert<(typeof targetRows)[typeof table]>(ownedValues).select("id").single()));

      const { data, error } = await learner.from(table).delete().eq("id", id).select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
      expect(must(await fixtures.from(table).select("id").eq("id", id))).toHaveLength(1);
    });
  });
});

describe("admin content writes", () => {
  it("[C8] an admin inserts, updates and deletes a chapter", async () => {
    const created = await ownedInsert("chapters", { course_id: 1, title: `${MARKER} chapter`, order_index: 9 }, ownedValues => admin.from("chapters").insert(ownedValues).select("id, title"));
    expect(created.error).toBeNull();
    expect(created.data).toHaveLength(1);
    const id = created.data![0].id;

    const updated = await admin.from("chapters").update({ title: `${MARKER} renamed` }).eq("id", id).select("title");
    expect(updated.error).toBeNull();
    expect(updated.data).toEqual([{ title: `${MARKER} renamed` }]);

    const deleted = await admin.from("chapters").delete().eq("id", id).select("id");
    expect(deleted.error).toBeNull();
    expect(deleted.data).toEqual([{ id }]);
    expect(must(await fixtures.from("chapters").select("id").eq("id", id))).toEqual([]);
  });
});
