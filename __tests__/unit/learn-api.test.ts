import { afterEach, describe, expect, it, vi } from "vitest";
import {
  learnOutcome,
  lessonAnswer,
  outlineAnswer,
  queryValue,
  quizAnswer,
  readLearn,
  type LearnRead,
} from "../../lib/learn-api";

const access = {
  user: { id: "u1" },
  course: { id: 2, slug: "js" },
  isAdmin: false,
};
const chapters = [
  {
    id: 1,
    title: "Chương 1",
    order_index: 1,
    lessons: [
      {
        id: 3,
        title: "Bài 3",
        slug: "b3",
        has_video: false,
        has_exercise: true,
      },
    ],
  },
];
const lesson = {
  id: 3,
  title: "Bài 3",
  slug: "b3",
  course_id: 2,
  chapter_id: 1,
  order_index: 1,
  created_at: "2026-01-01T00:00:00+00:00",
  has_video: false,
};

const json = (status: number, body: unknown = {}) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.restoreAllMocks());

describe("readLearn: how a /api/learn answer reaches a page", () => {
  it("maps the API's own refusals: 401 to unauthenticated, 403 to forbidden, 404 to missing", async () => {
    for (const [status, expected] of [
      [401, "unauthenticated"],
      [403, "forbidden"],
      [404, "missing"],
    ] as const) {
      const read = await readLearn(() => json(status), outlineAnswer);
      expect(read.status, String(status)).toBe(expected);
    }
  });

  it("returns the parsed body of a 200 that matches its schema, without the keys the pages do not read", async () => {
    const read = await readLearn(
      () => json(200, { ...access, chapters, extra: "dropped" }),
      outlineAnswer,
    );
    expect(read).toEqual({ status: "ok", data: { ...access, chapters } });
  });

  it("treats a 5xx, an unreadable body, a redirect and a 200 of the wrong shape as unavailable, never as a refusal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const calls: (() => Promise<Response>)[] = [
      () => json(500),
      () => json(502),
      () => json(503),
      () => json(302),
      () => json(200, { unexpected: true }),
      () => json(200, { ...access, chapters: "nope" }),
      () => Promise.resolve(new Response("not json", { status: 200 })),
    ];
    for (const call of calls) {
      expect((await readLearn(call, outlineAnswer)).status).toBe("unavailable");
    }
  });

  it("treats an unreachable API as unavailable and logs the error's type only", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const read = await readLearn(
      () => Promise.reject(new TypeError("fetch failed: secret-cookie=abc")),
      outlineAnswer,
    );
    expect(read.status).toBe("unavailable");
    expect(JSON.stringify(log.mock.calls)).toContain("TypeError");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-cookie");
  });

  it("logs a status and not the body of an unavailable answer", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await readLearn(
      () => json(500, { content: "private lesson text" }),
      lessonAnswer,
    );
    expect(JSON.stringify(log.mock.calls)).toContain("500");
    expect(JSON.stringify(log.mock.calls)).not.toContain("private lesson text");
  });

  it("lets the framework's own signal through instead of swallowing it as an outage", async () => {
    const signal = new Error("NEXT_PRERENDER_INTERRUPTED");
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      readLearn(
        () => Promise.reject(signal),
        outlineAnswer,
        (error) => {
          throw error;
        },
      ),
    ).rejects.toBe(signal);
  });
});

describe("the response schemas", () => {
  it("accepts the lesson answer the API sends, with a null video address and null content", () => {
    const parsed = lessonAnswer.safeParse({
      ...access,
      lesson,
      content: null,
      video_url: null,
      chapters,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an answer that lacks the verdict, the lesson or the outline", () => {
    for (const body of [
      { lesson, content: "x", video_url: null, chapters },
      { ...access, content: "x", video_url: null, chapters },
      { ...access, lesson, content: "x", video_url: null },
    ]) {
      expect(lessonAnswer.safeParse(body).success).toBe(false);
    }
    expect(quizAnswer.safeParse({ ...access, chapters }).success).toBe(false);
  });

  it("accepts the quiz answer with the lesson's id, title and slug only", () => {
    expect(
      quizAnswer.safeParse({
        ...access,
        lesson: { id: 3, title: "Bài 3", slug: "b3" },
        chapters,
      }).success,
    ).toBe(true);
  });
});

describe("learnOutcome", () => {
  const read = (status: LearnRead<unknown>["status"]) =>
    ({ status, data: {} }) as LearnRead<unknown>;

  it("sends a visitor to /login, a learner who is not enrolled to the course page, and maps a missing course to not found", () => {
    expect(learnOutcome(read("unauthenticated"), "js")).toEqual({
      redirect: "/login",
    });
    expect(learnOutcome(read("forbidden"), "js")).toEqual({
      redirect: "/course/js",
    });
    expect(learnOutcome(read("missing"), "js")).toEqual({ notFound: true });
  });

  it("maps an outage to unavailable, which is no redirect, and a read with data to null", () => {
    expect(learnOutcome(read("unavailable"), "js")).toEqual({
      unavailable: true,
    });
    expect(learnOutcome(read("ok"), "js")).toBeNull();
  });
});

describe("queryValue", () => {
  it("escapes what apiFetch refuses raw: dots, quotes, brackets and spaces", () => {
    expect(queryValue("a.b")).toBe("a%2Eb");
    expect(queryValue("it's (a) *b*!")).toBe("it%27s%20%28a%29%20%2Ab%2A%21");
    expect(queryValue("bài học")).toBe("b%C3%A0i%20h%E1%BB%8Dc");
  });
});
