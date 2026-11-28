// Test plan
// Goal: the /api/learn routes decide course access themselves and give a lesson's private columns only to an enrolled
//   learner or an admin, in the order and shape the /learn pages read (TM-U5 AC4, G1, G2, G6, G8).
// Layer: api (the production build as a process on the test stack, under the network guard).
// Subject: GET /api/learn/lesson, /api/learn/outline and /api/learn/quiz.
// Data: four minted users (enrolled in the fixture course and in seed course 2, enrolled only in a second fixture
//   course, not enrolled, admin) and owned fixtures: a course whose chapter and lesson order values disagree with the insertion order, a lesson with a video
//   address, a lesson filed under that course's chapter while its course_id names seed course 1 (with an exercise),
//   and a lesson with an exercise inside the course. All are reserved before they are written and removed by the scope.
// Invariants: the order is session (401), course (404), access (403), lesson (404); a refusal carries no lesson
//   column and no outline; the exercise marker and the private columns are bound to the authorized course.
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  inject,
  it,
} from "vitest";
import { afterAllCleanup, afterEachCleanup } from "../helpers/api-timeout-note";
import {
  apiTestEnv,
  freePort,
  startApi,
  type RunningApi,
} from "../helpers/api-process";
import { apiDatabaseUrl } from "../helpers/api-role";
import {
  apiSessions,
  bearer,
  type MintedSession,
} from "../helpers/api-session";
import { enumerateRoutes } from "../helpers/api-routes";

const stack = inject("apiStack");
const sessions = apiSessions(stack);

const SEED_COURSE = "javascript-can-ban";
const SEED_LESSON = "bien-va-kieu-du-lieu";
const SEED_LESSON_WITHOUT_EXERCISE = "ham-va-vong-lap";
const VIDEO = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

type Lesson = { id: number; slug: string; has_exercise: boolean };
type Chapter = { id: number; title: string; lessons: Lesson[] };

let api: RunningApi;
let enrolled: MintedSession;
let plain: MintedSession;
let onlyElsewhere: MintedSession;
let admin: MintedSession;
let course: string;
let tag: string;
let slugs: Record<string, string>;
const extra: RunningApi[] = [];

beforeAll(async () => {
  const { scope } = sessions;
  tag = scope.tag;
  enrolled = await sessions.mint("learn-enrolled");
  plain = await sessions.mint("learn-plain");
  onlyElsewhere = await sessions.mint("learn-elsewhere");
  admin = await sessions.mint("learn-admin");
  const insert = async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await scope.db
      .from(table)
      .insert(row)
      .select("id")
      .single();
    if (error)
      throw new Error(`fixture insert into ${table}: ${error.message}`);
    return (data as { id: number }).id;
  };

  // The admin role is set by the service role and restored by the scope before the user is deleted.
  await scope.acquire("profiles", admin.userId, ["role"], { role: "user" });
  const promoted = await scope.db
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", admin.userId);
  if (promoted.error) throw new Error(promoted.error.message);

  const courseName = scope.label("TM-U5 order course");
  course = `tm-u5-order-${tag}`;
  await scope.reserve("courses", { name: courseName });
  const courseId = await insert("courses", {
    name: courseName,
    slug: course,
    price: 0,
  });
  const chapterNames = [
    scope.label("TM-U5 chapter inserted first, shown second"),
    scope.label("TM-U5 chapter inserted second, shown first"),
  ];
  for (const title of chapterNames) await scope.reserve("chapters", { title });
  const later = await insert("chapters", {
    course_id: courseId,
    title: chapterNames[0],
    order_index: 2,
  });
  const first = await insert("chapters", {
    course_id: courseId,
    title: chapterNames[1],
    order_index: 1,
  });

  slugs = {
    fifth: `tm-u5-fifth-${tag}`,
    second: `tm-u5-second-${tag}`,
    nullLate: `tm-u5-null-late-${tag}`,
    nullEarly: `tm-u5-null-early-${tag}`,
    inLater: `tm-u5-in-later-${tag}`,
    video: `tm-u5-video-${tag}`,
    cross: `tm-u5-cross-${tag}`,
  };
  const titles = Object.fromEntries(
    Object.keys(slugs).map((key) => [key, scope.label(`TM-U5 lesson ${key}`)]),
  );
  for (const title of Object.values(titles))
    await scope.reserve("lessons", { title });
  // Inserted in this order: the order values and created_at disagree with it, and two lessons have no order_index.
  const lesson = (key: string, row: Record<string, unknown>) =>
    insert("lessons", {
      title: titles[key],
      slug: slugs[key],
      content: `secret content of ${key} ${tag}`,
      ...row,
    });
  await lesson("fifth", {
    course_id: courseId,
    chapter_id: first,
    order_index: 5,
  });
  const secondId = await lesson("second", {
    course_id: courseId,
    chapter_id: first,
    order_index: 1,
  });
  await lesson("nullLate", {
    course_id: courseId,
    chapter_id: first,
    order_index: null,
    created_at: "2026-02-01T00:00:00Z",
  });
  await lesson("nullEarly", {
    course_id: courseId,
    chapter_id: first,
    order_index: null,
    created_at: "2026-01-01T00:00:00Z",
  });
  await lesson("inLater", {
    course_id: courseId,
    chapter_id: later,
    order_index: 1,
  });
  await lesson("video", {
    course_id: courseId,
    chapter_id: later,
    order_index: 2,
    video_url: VIDEO,
  });
  // Filed under this course's chapter, owned by seed course 1, and holding an exercise: the exercises policy
  // authorizes on the lesson's course_id, so the API must not report its exercise (G8).
  const crossId = await lesson("cross", {
    course_id: 1,
    chapter_id: later,
    order_index: 3,
  });

  const question = (id: number) => scope.label(`TM-U5 question ${id}`);
  for (const id of [secondId, crossId]) {
    await scope.reserve("exercises", { question: question(id) });
    await insert("exercises", {
      lesson_id: id,
      question: question(id),
      option_a: "a",
      option_b: "b",
      option_c: "c",
      option_d: "d",
      correct_answer: "a",
    });
  }
  // A second course the learner below is enrolled in and nothing else: it makes an enrollment row exist for the
  // caller, so only the course predicate of the access check can refuse the first course.
  const otherName = scope.label("TM-U5 other course");
  await scope.reserve("courses", { name: otherName });
  const otherCourseId = await insert("courses", {
    name: otherName,
    slug: `tm-u5-other-${tag}`,
    price: 0,
  });
  const enroll = async (user: MintedSession, id: number) => {
    await scope.reserve("enrollments", { user_id: user.userId, course_id: id });
    await insert("enrollments", { user_id: user.userId, course_id: id });
  };
  for (const id of [courseId, 2]) await enroll(enrolled, id);
  await enroll(onlyElsewhere, otherCourseId);
  api = await startApi(apiTestEnv(stack));
});

afterEach(
  afterEachCleanup(() => extra.splice(0).map((one) => () => one.stop())),
);

afterAll(
  afterAllCleanup("learn", () => [() => api?.stop(), () => sessions.cleanup()]),
);

const get = (path: string, session?: MintedSession) =>
  fetch(`${api.url}${path}`, { headers: session ? bearer(session) : {} });
const lessonPath = (courseSlug: string, lessonSlug: string, route = "lesson") =>
  `/api/learn/${route}?course=${encodeURIComponent(courseSlug)}&lesson=${encodeURIComponent(lessonSlug)}`;
const outlinePath = (courseSlug: string) =>
  `/api/learn/outline?course=${encodeURIComponent(courseSlug)}`;

// The framework's own refusal for each status, and nothing else: an exact compare, so a nested field or a lesson text
// anywhere in a refusal body fails it.
const REFUSALS: Record<number, { message: string; statusCode: number }> = {
  401: { message: "Unauthorized", statusCode: 401 },
  403: { message: "Forbidden", statusCode: 403 },
  404: { message: "Not Found", statusCode: 404 },
};

async function expectRefusal(response: Response, status: 401 | 403 | 404) {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual(REFUSALS[status]);
}

const ROUTES = [
  (c: string, l: string) => lessonPath(c, l, "lesson"),
  (c: string, l: string) => lessonPath(c, l, "quiz"),
  (c: string) => outlinePath(c),
];

describe("the order of the refusals (AC4, G1, G2)", () => {
  it("[AC4] a request with no session is 401 on every route and reaches no lesson data", async () => {
    for (const route of ROUTES) {
      await expectRefusal(await get(route(course, slugs.second)), 401);
    }
  });

  it("[AC4] a course slug that does not exist is 404, even for a caller with no access to anything", async () => {
    for (const route of ROUTES) {
      for (const session of [plain, enrolled, admin]) {
        await expectRefusal(
          await get(route("no-such-course", slugs.second), session),
          404,
        );
      }
    }
  });

  it("[AC4] a session that is neither enrolled nor admin is 403 and the body holds no lesson column or outline", async () => {
    for (const route of ROUTES) {
      const response = await get(route(course, slugs.second), plain);
      const text = await response.clone().text();
      expect(text).not.toMatch(/content|video_url|chapters|lesson|secret/);
      expect(JSON.parse(text)).toEqual({
        message: "Forbidden",
        statusCode: 403,
      });
      await expectRefusal(response, 403);
    }
  });

  it("[AC4] a learner enrolled only in another course is 403 on every route, and before the lesson is looked up", async () => {
    for (const route of ROUTES)
      await expectRefusal(
        await get(route(course, slugs.second), onlyElsewhere),
        403,
      );
    // A lesson slug that does not exist in the course they are refused: access is decided first, so it is 403, not 404.
    for (const route of ["lesson", "quiz"])
      await expectRefusal(
        await get(lessonPath(course, "no-such-lesson", route), onlyElsewhere),
        403,
      );
  });

  it("[AC4] a caller who is not enrolled in the asked course is refused even when it names another course's id or user", async () => {
    // The seed course 2 is a real course the plain user is not enrolled in; extra parameters are ignored.
    await expectRefusal(
      await get(lessonPath(SEED_COURSE, SEED_LESSON), plain),
      403,
    );
    const url = `${lessonPath(course, slugs.second)}&courseId=2&userId=${enrolled.userId}`;
    await expectRefusal(await get(url, plain), 403);
  });

  it("[AC4] an enrolled caller asking for a lesson slug outside the course is 404, also for a lesson that exists elsewhere", async () => {
    for (const route of ["lesson", "quiz"]) {
      for (const session of [enrolled, admin]) {
        await expectRefusal(
          await get(lessonPath(course, "no-such-lesson", route), session),
          404,
        );
        // The seed lesson belongs to course 2, and the fixture course is asked for.
        await expectRefusal(
          await get(lessonPath(course, SEED_LESSON, route), session),
          404,
        );
      }
    }
  });

  it("[G8] a lesson filed under the course's chapter but owned by another course is 404 and gives no private column", async () => {
    for (const route of ["lesson", "quiz"]) {
      for (const session of [enrolled, admin]) {
        await expectRefusal(
          await get(lessonPath(course, slugs.cross, route), session),
          404,
        );
      }
    }
  });
});

describe("the answers of an enrolled learner and an admin (AC4)", () => {
  it("[AC4] the lesson route gives the verdict, the lesson, its private columns and the outline", async () => {
    for (const [session, isAdmin] of [
      [enrolled, false],
      [admin, true],
    ] as const) {
      const response = await get(lessonPath(course, slugs.video), session);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Object.keys(body).sort()).toEqual([
        "chapters",
        "content",
        "course",
        "isAdmin",
        "lesson",
        "user",
        "video_url",
      ]);
      expect(body.user).toEqual({ id: session.userId });
      expect(body.isAdmin).toBe(isAdmin);
      expect(body.course).toEqual({ id: expect.any(Number), slug: course });
      expect(body.content).toBe(`secret content of video ${tag}`);
      expect(body.video_url).toBe(VIDEO);
      expect(Object.keys(body.lesson).sort()).toEqual([
        "chapter_id",
        "course_id",
        "created_at",
        "has_video",
        "id",
        "order_index",
        "slug",
        "title",
      ]);
      expect(body.lesson).toMatchObject({ slug: slugs.video, has_video: true });
      expect(body.lesson).not.toHaveProperty("content");
      expect(body.lesson).not.toHaveProperty("video_url");
    }
  });

  it("[AC4] a lesson with no video has has_video false and a null video address", async () => {
    const body = await (
      await get(lessonPath(course, slugs.second), enrolled)
    ).json();
    expect(body.lesson.has_video).toBe(false);
    expect(body.video_url).toBeNull();
  });

  it("[AC4] the quiz route gives the verdict, the lesson's id, title and slug and the outline, with no private column", async () => {
    const response = await get(
      lessonPath(course, slugs.second, "quiz"),
      enrolled,
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("secret content");
    expect(text).not.toContain("video_url");
    const body = JSON.parse(text);
    expect(Object.keys(body).sort()).toEqual([
      "chapters",
      "course",
      "isAdmin",
      "lesson",
      "user",
    ]);
    expect(Object.keys(body.lesson).sort()).toEqual(["id", "slug", "title"]);
  });

  it("[AC4] the outline route gives the verdict and the outline in the page's order", async () => {
    for (const session of [enrolled, admin]) {
      const response = await get(outlinePath(course), session);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Object.keys(body).sort()).toEqual([
        "chapters",
        "course",
        "isAdmin",
        "user",
      ]);
      const chapters = body.chapters as Chapter[];
      expect(chapters.map((chapter) => chapter.title)).toEqual([
        expect.stringContaining("inserted second, shown first"),
        expect.stringContaining("inserted first, shown second"),
      ]);
      // order_index 1, 5, then the two null ones by created_at; the second chapter by order_index.
      expect(chapters[0].lessons.map((lesson) => lesson.slug)).toEqual([
        slugs.second,
        slugs.fifth,
        slugs.nullEarly,
        slugs.nullLate,
      ]);
      expect(chapters[1].lessons.map((lesson) => lesson.slug)).toEqual([
        slugs.inLater,
        slugs.video,
        slugs.cross,
      ]);
      for (const chapter of chapters)
        expect(Object.keys(chapter).sort()).toEqual([
          "id",
          "lessons",
          "order_index",
          "title",
        ]);
      for (const lesson of chapters.flatMap((chapter) => chapter.lessons))
        expect(Object.keys(lesson).sort()).toEqual([
          "has_exercise",
          "has_video",
          "id",
          "slug",
          "title",
        ]);
    }
  });

  it("[G8] the exercise marker is true for a lesson of the course that has one, and false for the foreign lesson's exercise", async () => {
    const body = await (await get(outlinePath(course), enrolled)).json();
    const bySlug = new Map(
      (body.chapters as Chapter[])
        .flatMap((chapter) => chapter.lessons)
        .map((lesson) => [lesson.slug, lesson.has_exercise]),
    );
    expect(bySlug.get(slugs.second)).toBe(true);
    expect(bySlug.get(slugs.fifth)).toBe(false);
    expect(
      bySlug.has(slugs.cross),
      "the lesson is listed by its chapter, as the page always did",
    ).toBe(true);
    expect(bySlug.get(slugs.cross)).toBe(false);
    expect(JSON.stringify(body)).not.toContain("secret content");
  });

  it("[AC1] the seed course 2 lists its lessons in order with the exercise marker of lesson 3 only", async () => {
    const body = await (await get(outlinePath(SEED_COURSE), enrolled)).json();
    const lessons = (body.chapters as Chapter[]).flatMap(
      (chapter) => chapter.lessons,
    );
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      SEED_LESSON,
      SEED_LESSON_WITHOUT_EXERCISE,
    ]);
    expect(lessons.map((lesson) => lesson.has_exercise)).toEqual([true, false]);
  });
});

describe("the routes are not public (G6)", () => {
  it("[G6] the three learn routes are declared private in both builds, and the public set is unchanged", () => {
    for (const folder of ["dist", "dist-e2e"] as const) {
      const routes = enumerateRoutes(folder).declared;
      const learn = routes
        .filter((route) => route.path.startsWith("/api/learn/"))
        .map((route) => `${route.method} ${route.path} ${route.public}`)
        .sort();
      expect(learn).toEqual([
        "GET /api/learn/lesson false",
        "GET /api/learn/outline false",
        "GET /api/learn/quiz false",
      ]);
    }
  });

  it("[G6] none of the three learn routes is @Sensitive(): a lesson load takes the cached session check", () => {
    for (const folder of ["dist", "dist-e2e"] as const) {
      const { sensitive } = enumerateRoutes(folder);
      expect(
        sensitive.filter((route) => route.includes("/api/learn/")),
        folder,
      ).toEqual([]);
    }
    // The enumeration does see a marker: the fixture route that carries @Sensitive() is listed.
    expect(enumerateRoutes("dist-e2e").sensitive).toContain(
      "GET /api/e2e/sensitive",
    );
  });

  it("[G6] a request with a cookie that is no session is refused as well", async () => {
    await expectRefusal(
      await fetch(`${api.url}${outlinePath(course)}`, {
        headers: { cookie: "sb-127-auth-token=not-a-session" },
      }),
      401,
    );
  });
});

describe("input and failures", () => {
  it("rejects a missing, repeated or empty parameter with 400 before any lookup", async () => {
    for (const path of [
      "/api/learn/lesson",
      `/api/learn/lesson?course=${course}`,
      `/api/learn/lesson?course=${course}&lesson=`,
      `/api/learn/lesson?course=${course}&lesson=a&lesson=b`,
      "/api/learn/outline",
      `/api/learn/quiz?lesson=${slugs.second}`,
    ]) {
      const response = await get(path, enrolled);
      expect(response.status, path).toBe(400);
      expect(await response.json()).toMatchObject({
        message: "Dữ liệu không hợp lệ.",
      });
    }
  });

  it("answers 503 with no detail when the database is down", async () => {
    const closed = await freePort();
    const url = new URL(apiDatabaseUrl(stack.dbUrl));
    url.port = String(closed);
    const down = await startApi(
      apiTestEnv(stack, { DATABASE_URL: url.toString() }),
    );
    extra.push(down);
    for (const route of ROUTES) {
      const response = await fetch(
        `${down.url}${route(course, slugs.second)}`,
        {
          headers: bearer(enrolled),
        },
      );
      expect(response.status).toBe(503);
      expect(await response.text()).not.toMatch(
        /postgres|ECONNREFUSED|127\.0\.0\.1|devspace_api|secret/i,
      );
    }
  });
});
