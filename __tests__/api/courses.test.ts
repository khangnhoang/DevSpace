// Test plan
// Goal: `GET /api/courses/home` gives an anonymous caller the course list the home page shows, in the documented shape
//   and order, with the first lesson slug rule of the page, and answers 503 with no detail when the database is down.
// Layer: api (the production build as a process on the test stack, under the network guard).
// Subject: AC1 to AC3 of the TM-U4 detail plan, guardrail G1.
// Data: the seed's two courses (ids 1 and 2), and two owned fixtures: a course with no lesson, and a course whose
//   lower-id lesson has the higher order_index. Both are reserved by name before they are written and removed by the scope.
// Invariants: the route needs no session; no lesson row, no lesson content and no other column is in the answer.
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
import { apiSessions } from "../helpers/api-session";

const stack = inject("apiStack");
const sessions = apiSessions(stack);
const KEYS = [
  "description",
  "firstLessonSlug",
  "id",
  "image_url",
  "name",
  "price",
  "slug",
];

type Item = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  firstLessonSlug: string | null;
};

let api: RunningApi;
let noLessons: string;
let reversed: string;
const extra: RunningApi[] = [];

beforeAll(async () => {
  const { scope } = sessions;
  noLessons = scope.label("TM-U4 course without lessons");
  reversed = scope.label("TM-U4 course with a reversed lesson");
  const lessonA = scope.label("TM-U4 lesson A, lower id, later in order");
  const lessonB = scope.label("TM-U4 lesson B, higher id, first in order");
  await scope.reserve("courses", { name: noLessons });
  await scope.reserve("courses", { name: reversed });
  await scope.reserve("lessons", { title: lessonA });
  await scope.reserve("lessons", { title: lessonB });
  const insert = async (table: string, row: Record<string, unknown>) => {
    const { error } = await scope.db.from(table).insert(row);
    if (error)
      throw new Error(`fixture insert into ${table}: ${error.message}`);
  };
  await insert("courses", {
    name: noLessons,
    slug: `tm-u4-none-${scope.tag}`,
    price: 0,
  });
  await insert("courses", {
    name: reversed,
    slug: `tm-u4-reversed-${scope.tag}`,
    price: 5000,
  });
  const { data } = await scope.db
    .from("courses")
    .select("id")
    .eq("name", reversed)
    .single();
  const courseId = (data as { id: number }).id;
  // Inserted in this order, so lesson A has the lower id and the higher order_index.
  await insert("lessons", {
    title: lessonA,
    slug: `tm-u4-lesson-a-${scope.tag}`,
    course_id: courseId,
    order_index: 5,
  });
  await insert("lessons", {
    title: lessonB,
    slug: `tm-u4-lesson-b-${scope.tag}`,
    course_id: courseId,
    order_index: 1,
  });
  api = await startApi(apiTestEnv(stack));
});

afterEach(
  afterEachCleanup(() => extra.splice(0).map((one) => () => one.stop())),
);

afterAll(
  afterAllCleanup("courses", () => [
    () => api?.stop(),
    () => sessions.cleanup(),
  ]),
);

async function home(): Promise<Item[]> {
  const response = await fetch(`${api.url}/api/courses/home`);
  expect(response.status).toBe(200);
  return (await response.json()) as Item[];
}

describe("GET /api/courses/home (AC1, AC2)", () => {
  it("[AC1] an anonymous caller gets 200 and an array ordered by course id, each item with exactly the seven keys", async () => {
    const response = await fetch(`${api.url}/api/courses/home`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const items = (await response.json()) as Item[];
    expect(
      items.length,
      "the seed and the fixtures hold courses",
    ).toBeGreaterThanOrEqual(4);
    expect(items.map((item) => item.id)).toEqual(
      [...items.map((item) => item.id)].sort((a, b) => a - b),
    );
    for (const item of items) expect(Object.keys(item).sort()).toEqual(KEYS);
    const free = items.find((item) => item.id === 1);
    expect(free).toEqual({
      id: 1,
      name: "Làm quen với HTML",
      slug: "lam-quen-voi-html",
      description: "Khóa học miễn phí giới thiệu các thẻ HTML đầu tiên.",
      image_url: null,
      price: 0,
      firstLessonSlug: "cau-truc-mot-trang-html",
    });
    expect(items.find((item) => item.id === 2)?.price).toBe(199000);
  });

  it("[AC1] a request with a cookie that is no session is still answered, because the route is public", async () => {
    const response = await fetch(`${api.url}/api/courses/home`, {
      headers: { cookie: "sb-127-auth-token=not-a-session" },
    });
    expect(response.status).toBe(200);
  });

  it("[AC2] the first lesson slug is that of the lowest lesson id, not the lowest order_index", async () => {
    const item = (await home()).find((one) => one.name === reversed);
    expect(item?.firstLessonSlug).toBe(`tm-u4-lesson-a-${sessions.scope.tag}`);
  });

  it("[AC2] a course with no lesson has firstLessonSlug null", async () => {
    const item = (await home()).find((one) => one.name === noLessons);
    expect(item).toBeDefined();
    expect(item?.firstLessonSlug).toBeNull();
  });

  it("[G1] no lesson row, lesson content or video address is in the answer", async () => {
    const text = await (await fetch(`${api.url}/api/courses/home`)).text();
    expect(text).not.toContain("Một trang HTML gồm thẻ html");
    expect(text).not.toMatch(
      /"(content|video_url|lessons|instructor_id|created_at)"/,
    );
  });
});

describe("GET /api/courses/home with the database down (AC3)", () => {
  it("[AC3] answers 503 with no detail, and the API keeps serving", async () => {
    const closed = await freePort();
    const url = new URL(apiDatabaseUrl(stack.dbUrl));
    url.port = String(closed);
    const down = await startApi(
      apiTestEnv(stack, { DATABASE_URL: url.toString() }),
    );
    extra.push(down);
    const response = await fetch(`${down.url}/api/courses/home`);
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toMatch(
      /postgres|ECONNREFUSED|127\.0\.0\.1|devspace_api/i,
    );
    expect((await fetch(`${down.url}/api/health`)).status).toBe(200);
  });
});
