// Test plan
// Goal: the /learn pages read the access verdict, the lesson and the outline through the API and keep every redirect,
//   not-found screen and value of the Supabase reads they replace (TM-U5 AC1 to AC3, AC6, AC10, AC11).
// Layer: e2e (Next on 3100, the e2e API on 3101, both under the server guard). The API's request record says which
//   calls reached it; the e2e API's `e2e-learn-fault` cookie (backend/e2e/main.ts) fails one learn route.
// Data: the seed users (student enrolled in course 2, learner enrolled nowhere, admin) and the seed course 2 (lesson 3
//   with exercises, lesson 4 without). No row writes data.
// Invariants: an outage is never a redirect and renders no lesson content; a refusal renders no lesson content.
//   [LA1] persistence: an enrolled student's lesson, its navigation, sidebar order and quiz link
//   [LA2] permission: an admin who is not enrolled opens a lesson the learning-order check would turn a student away from
//   [LA3] permission, redirect: a visitor and a learner not enrolled are sent away from the lesson, quiz and finish pages
//   [LA4] permission: an unknown course or a lesson outside the course shows the not-found lesson screen
//   [LA5] request record: a render of a lesson and of a quiz reads through /api/learn and makes no non-GET call
//   [LA6] failure: an API 5xx or a malformed 200 shows the message and no redirect, and a failed outline leaves the page
//   [LA7] permission: the finish page is gated and shows the completion screen to an enrolled learner and an admin
import type { Page } from "@playwright/test";
import { E2E_ORIGIN } from "../helpers/e2e-env";
import { authFile } from "./accounts";
import { expect, test } from "./fixtures";

const COURSE = "javascript-can-ban";
const LESSON = "bien-va-kieu-du-lieu";
const SECOND = "ham-va-vong-lap";
const LESSON_URL = `/learn/${COURSE}/${LESSON}`;
const UNAVAILABLE = "Không thể tải bài học";
const NOT_FOUND = "Không tìm thấy bài học";

const fault = (page: Page, value: string) =>
  page
    .context()
    .addCookies([{ name: "e2e-learn-fault", value, url: E2E_ORIGIN }]);

const anonymous = { cookies: [], origins: [] };

test.describe("enrolled student", () => {
  test.use({ storageState: authFile("student") });

  test("[LA1] sees the lesson, its next link, the outline in order and the exercise link of the lesson that has exercises", async ({
    page,
  }) => {
    await page.goto(LESSON_URL);
    await expect(
      page.getByRole("heading", { name: "Biến và kiểu dữ liệu" }),
    ).toBeVisible();
    await expect(
      page.getByText("Khai báo biến bằng let và const."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Bài sau" })).toHaveAttribute(
      "href",
      `/learn/${COURSE}/${SECOND}`,
    );
    await expect(page.getByRole("link", { name: "Bài trước" })).toHaveCount(0);

    // The desktop sidebar holds the outline: both lessons in order, and a quiz link under the first only.
    const sidebar = page.locator("div.lg\\:block").first();
    await expect(
      sidebar.getByText("Chương 1: Nền tảng JavaScript"),
    ).toBeVisible();
    const lessonLinks = sidebar.locator(
      `a[href^="/learn/${COURSE}/"]:not([href$="/quiz"])`,
    );
    await expect(lessonLinks).toHaveText([
      "Biến và kiểu dữ liệu",
      "Hàm và vòng lặp",
    ]);
    await expect(sidebar.locator(`a[href="${LESSON_URL}/quiz"]`)).toHaveCount(
      1,
    );
    await expect(
      sidebar.locator(`a[href="/learn/${COURSE}/${SECOND}/quiz"]`),
    ).toHaveCount(0);
  });

  test("[LA4] a lesson slug that is not in the course, also one that exists in another course, shows the not-found lesson screen, on the lesson and the quiz page", async ({
    page,
  }) => {
    for (const path of [
      `/learn/${COURSE}/no-such-lesson`,
      `/learn/${COURSE}/cau-truc-mot-trang-html`,
      `/learn/${COURSE}/no-such-lesson/quiz`,
      `/learn/${COURSE}/cau-truc-mot-trang-html/quiz`,
      `/learn/no-such-course/${LESSON}`,
      `/learn/no-such-course/${LESSON}/quiz`,
      "/learn/no-such-course/finish",
    ]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByText(NOT_FOUND), path).toBeVisible();
    }
  });

  test("[LA5] a render of a lesson page and of a quiz page reads the API with GET only, and the lesson page asks for the lesson and the outline once each", async ({
    page,
    serverRecords,
  }) => {
    await page.goto(LESSON_URL);
    await expect(
      page.getByText("Khai báo biến bằng let và const."),
    ).toBeVisible();
    const lessonCalls = serverRecords
      .apiCalls()
      .filter((call) => call.path.startsWith("/api/learn/"));
    expect(
      lessonCalls
        .map((call) => `${call.method} ${call.path} ${call.status}`)
        .sort(),
    ).toEqual(["GET /api/learn/lesson 200", "GET /api/learn/outline 200"]);

    const before = serverRecords.apiCalls().length;
    await page.goto(`${LESSON_URL}/quiz`);
    await expect(page.getByText("Bài tập thực hành").first()).toBeVisible();
    const quizCalls = serverRecords
      .apiCalls()
      .slice(before)
      .filter((call) => call.path.startsWith("/api/learn/"));
    expect(
      quizCalls
        .map((call) => `${call.method} ${call.path} ${call.status}`)
        .sort(),
    ).toEqual(["GET /api/learn/outline 200", "GET /api/learn/quiz 200"]);
    expect(
      serverRecords.apiCalls().filter((call) => call.method !== "GET"),
      "a render writes nothing through the API",
    ).toEqual([]);
  });

  test("[LA6] an API 500 on the lesson read shows the message, no lesson content and no redirect", async ({
    page,
  }) => {
    await fault(page, "lesson.500");
    await page.goto(LESSON_URL);
    await expect(page.getByText(UNAVAILABLE)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${LESSON_URL}$`));
    await expect(
      page.getByText("Khai báo biến bằng let và const."),
    ).toHaveCount(0);
  });

  test("[LA6] a 200 whose body is not the lesson answer shows the message, no lesson content and no redirect", async ({
    page,
  }) => {
    await fault(page, "lesson.malformed");
    await page.goto(LESSON_URL);
    await expect(page.getByText(UNAVAILABLE)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${LESSON_URL}$`));
  });

  test("[LA6] an API 500 on the quiz read shows the message and no redirect", async ({
    page,
  }) => {
    await fault(page, "quiz.500");
    await page.goto(`${LESSON_URL}/quiz`);
    await expect(page.getByText(UNAVAILABLE)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${LESSON_URL}/quiz$`));
    await expect(page.getByText("Bài tập thực hành")).toHaveCount(0);
  });

  test("[LA6] when only the layout's outline read fails the lesson still renders and the sidebar is absent", async ({
    page,
  }) => {
    await fault(page, "outline.500");
    await page.goto(LESSON_URL);
    await expect(
      page.getByText("Khai báo biến bằng let và const."),
    ).toBeVisible();
    await expect(page.getByText(UNAVAILABLE)).toHaveCount(0);
    await expect(page.getByText("Chương 1: Nền tảng JavaScript")).toHaveCount(
      0,
    );
    await expect(page.locator(`a[href="${LESSON_URL}/quiz"]`)).toHaveCount(0);
  });

  test("[LA6] a malformed 200 for the outline leaves the sidebar out too", async ({
    page,
  }) => {
    await fault(page, "outline.malformed");
    await page.goto(LESSON_URL);
    await expect(
      page.getByText("Khai báo biến bằng let và const."),
    ).toBeVisible();
    await expect(page.getByText("Chương 1: Nền tảng JavaScript")).toHaveCount(
      0,
    );
  });

  test("[LA7] sees the completion screen of the finish page with the student's name and the sidebar, from one outline call that the layout and the page share", async ({
    page,
    serverRecords,
  }) => {
    await page.goto(`/learn/${COURSE}/finish`);
    await expect(page).toHaveURL(new RegExp(`/learn/${COURSE}/finish$`));
    await expect(
      page.getByText("Chúc mừng bạn đã hoàn thành khóa học!"),
    ).toBeVisible();
    await expect(page.getByText("Lê Minh Học Viên")).toBeVisible();
    await expect(
      page
        .locator("div.lg\\:block")
        .first()
        .getByText("Chương 1: Nền tảng JavaScript"),
    ).toBeVisible();
    expect(
      serverRecords
        .apiCalls()
        .filter((call) => call.path.startsWith("/api/learn/"))
        .map((call) => `${call.method} ${call.path} ${call.status}`),
    ).toEqual(["GET /api/learn/outline 200"]);
  });
});

test.describe("admin who is not enrolled", () => {
  test.use({ storageState: authFile("admin") });

  test("[LA2] opens the second lesson of a course directly, which the learning-order check turns a student away from, and sees its previous link", async ({
    page,
  }) => {
    await page.goto(`/learn/${COURSE}/${SECOND}`);
    await expect(
      page.getByRole("heading", { name: "Hàm và vòng lặp" }),
    ).toBeVisible();
    await expect(
      page.getByText("Viết hàm với function và lặp bằng for."),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/learn/${COURSE}/${SECOND}$`));
    await expect(page.getByRole("link", { name: "Bài trước" })).toHaveAttribute(
      "href",
      `/learn/${COURSE}/${LESSON}`,
    );
  });

  test("[LA2] opens the quiz page of a lesson with exercises and the finish page", async ({
    page,
  }) => {
    await page.goto(`${LESSON_URL}/quiz`);
    await expect(page.getByText("Bài tập thực hành").first()).toBeVisible();
    await page.goto(`/learn/${COURSE}/finish`);
    await expect(
      page.getByText("Chúc mừng bạn đã hoàn thành khóa học!"),
    ).toBeVisible();
  });
});

test.describe("learner enrolled nowhere", () => {
  test.use({ storageState: authFile("learner") });

  test("[LA3] is sent to the course page from the quiz and the finish page of a course they are not enrolled in", async ({
    page,
  }) => {
    for (const path of [`${LESSON_URL}/quiz`, `/learn/${COURSE}/finish`]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(new RegExp(`/course/${COURSE}$`));
    }
  });

  test("[LA4] an unknown course shows the not-found lesson screen", async ({
    page,
  }) => {
    await page.goto("/learn/no-such-course/finish");
    await expect(page.getByText(NOT_FOUND)).toBeVisible();
  });
});

test.describe("visitor with no session", () => {
  test.use({ storageState: anonymous });

  test("[LA3] is sent to the login page from the quiz and the finish page, and from a lesson of an unknown course", async ({
    page,
  }) => {
    for (const path of [
      `${LESSON_URL}/quiz`,
      `/learn/${COURSE}/finish`,
      `/learn/no-such-course/${LESSON}`,
      "/learn/no-such-course/finish",
    ]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login$/);
    }
  });
});
