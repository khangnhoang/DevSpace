import type { Page } from "@playwright/test";
import { tryItHref } from "../../lib/try-it";
import { expect, test } from "./fixtures";
import { createCourseWithReviewsFixture } from "./service-role";

// Anonymous visitor: the signed-out paths and the redirects that protect the others.
test.describe("anonymous visitor", () => {
  test("[S1] sees both seed courses on the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Làm quen với HTML").first()).toBeVisible();
    await expect(page.getByText("JavaScript căn bản").first()).toBeVisible();
  });

  test("[S2] sees the course name and both lessons of a free course", async ({
    page,
  }) => {
    await page.goto("/course/lam-quen-voi-html");
    await expect(
      page.getByRole("heading", { name: "Làm quen với HTML" }),
    ).toBeVisible();
    await expect(page.getByText("Cấu trúc một trang HTML")).toBeVisible();
    await expect(page.getByText("Tiêu đề và đoạn văn")).toBeVisible();
  });

  test("[S3] is sent to the login page from /admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("[S4] is sent to the login page from a lesson", async ({ page }) => {
    await page.goto("/learn/javascript-can-ban/bien-va-kieu-du-lieu");
    await expect(page).toHaveURL(/\/login$/);
  });

  // M1: the Header search queries `courses` with `ilike` from the browser, so it needs the real database.
  test("[S9] searching part of a course name lists that course with a link to its page, and a query that matches nothing lists none", async ({
    page,
  }) => {
    await page.goto("/");
    const header = page.locator("header");
    const search = header.getByPlaceholder("Tìm khóa học...");
    const javascript = header.getByRole("link", {
      name: /JavaScript căn bản/i,
    });

    await search.fill("script căn");
    await expect(javascript).toBeVisible();
    await expect(javascript).toHaveAttribute(
      "href",
      "/course/javascript-can-ban",
    );
    // The search has answered, so the other course is absent because it does not match.
    await expect(
      header.getByRole("link", { name: /Làm quen với HTML/ }),
    ).toHaveCount(0);

    // The old result leaves only when the search for the new text has answered.
    await search.fill("zzz không khóa nào");
    await expect(javascript).toHaveCount(0);
    await expect(header.getByRole("link", { name: /Giá:/ })).toHaveCount(0);

    await search.fill("script căn");
    await javascript.click();
    await expect(page).toHaveURL(/\/course\/javascript-can-ban$/);
    await expect(
      page.getByRole("heading", { name: "JavaScript căn bản" }),
    ).toBeVisible();
  });

  // M3 paging: the course page reads reviews through `.range()` ordered by created_at, newest first, five a page.
  test("[S10] a course with more reviews than a page lists the five newest, loads the older one on request and then hides the button", async ({
    page,
  }) => {
    const course = await createCourseWithReviewsFixture(6);
    const contents = course.reviews.map((review) => review.content);
    await page.goto(`/course/${course.slug}`);
    const listed = page.getByText(/E2E đánh giá số/);
    const more = page.getByRole("button", { name: "Xem thêm đánh giá cũ hơn" });

    await expect(listed).toHaveText(contents.slice(0, 5));
    await expect(more).toBeVisible();

    await more.click();
    await expect(listed).toHaveText(contents);
    await expect(more).toHaveCount(0);
  });

  test.describe("try-it page", () => {
    // Every request the editor makes, with the origin it went to and the status it got (undefined: no response).
    function recordMonaco(page: Page) {
      const requests: { url: string; origin: string }[] = [];
      const statuses = new Map<string, number>();
      page.context().on("request", (request) => {
        const url = new URL(request.url());
        if (!["data:", "blob:", "about:"].includes(url.protocol))
          requests.push({ url: request.url(), origin: url.origin });
      });
      page
        .context()
        .on("response", (response) =>
          statuses.set(response.url(), response.status()),
        );
      return { requests, statuses };
    }

    test("[S5] loads the editor and its files from the app's own origin", async ({
      page,
    }) => {
      const { requests, statuses } = recordMonaco(page);
      const response = await page.goto("/try_it");
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("button", { name: "Chạy Code" }),
      ).toBeVisible();
      await expect(page.locator(".monaco-editor")).toBeVisible();

      const origin = new URL(page.url()).origin;
      expect(
        requests.filter((request) => request.origin !== origin),
        "requests that left the app's origin",
      ).toEqual([]);
      const monaco = () =>
        requests.filter((request) =>
          request.url.startsWith(`${origin}/monaco/vs/`),
        );
      expect(
        monaco().some((request) =>
          request.url.endsWith("/monaco/vs/loader.js"),
        ),
      ).toBe(true);
      // A response can arrive after the editor is visible: wait for every request to be answered.
      await expect
        .poll(() =>
          monaco()
            .filter((request) => statuses.get(request.url) !== 200)
            .map((request) => request.url),
        )
        .toEqual([]);
      expect(
        await page.evaluate(() => window.monaco.editor.getModels().length),
      ).toBeGreaterThan(0);
    });

    test("[S5b] runs the language worker, which marks invalid JavaScript", async ({
      page,
    }) => {
      const { requests, statuses } = recordMonaco(page);
      await page.goto("/try_it");
      await page.getByRole("button", { name: "JavaScript" }).click();
      await expect(page.locator(".monaco-editor")).toBeVisible();
      // Set through the model: typing triggers the suggestion widget, which swallows keys.
      await expect
        .poll(() =>
          page.evaluate(() => window.monaco.editor.getModels().length),
        )
        .toBe(1);
      await page.evaluate(() =>
        window.monaco.editor.getModels()[0].setValue("const = ;"),
      );

      await expect
        .poll(() =>
          page.evaluate(() => window.monaco.editor.getModelMarkers({}).length),
        )
        .toBeGreaterThan(0);
      const origin = new URL(page.url()).origin;
      const workers = () =>
        requests.filter(
          (request) =>
            request.url.startsWith(`${origin}/monaco/vs/`) &&
            /worker/i.test(request.url),
        );
      expect(workers().length, "no worker file was requested").toBeGreaterThan(
        0,
      );
      await expect
        .poll(() =>
          workers()
            .filter((request) => statuses.get(request.url) !== 200)
            .map((request) => request.url),
        )
        .toEqual([]);
    });
  });

  // AC6: a link anyone can craft puts its text in the editor and runs nothing until the learner clicks "Chạy Code".
  test.describe("crafted try-it link", () => {
    const output = (page: Page) => page.locator('iframe[title="output"]');
    const messagesFromFrame = (page: Page) =>
      page.evaluate(
        () => (window as unknown as { __messages: string[] }).__messages,
      );

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        const messages: string[] = [];
        (window as unknown as { __messages: string[] }).__messages = messages;
        // Monaco posts objects to itself; the frame under test posts strings.
        window.addEventListener("message", (event) => {
          if (typeof event.data === "string") messages.push(event.data);
        });
      });
    });

    test("[S7] an HTML link loads its exact text, runs nothing before Chạy Code and keeps the sandbox", async ({
      page,
    }) => {
      const code = '<h1>ok</h1><script>parent.postMessage("ran", "*")</script>';
      await page.goto(tryItHref(code, "html"));
      await expect(page.locator(".monaco-editor")).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(() =>
            window.monaco.editor.getModels().map((model) => model.getValue()),
          ),
        )
        .toEqual([code]);

      await expect(output(page)).toHaveAttribute(
        "sandbox",
        "allow-scripts allow-modals",
      );
      await expect(output(page)).toHaveAttribute("srcdoc", "");
      expect(await messagesFromFrame(page)).toEqual([]);

      await page.getByRole("button", { name: "Chạy Code" }).click();
      await expect(
        page
          .frameLocator('iframe[title="output"]')
          .getByRole("heading", { name: "ok" }),
      ).toBeVisible();
      await expect.poll(() => messagesFromFrame(page)).toEqual(["ran"]);
    });

    test("[S8] a JavaScript link opens the JavaScript tab and shows its console line after Chạy Code", async ({
      page,
    }) => {
      const code = 'console.log("hello %d");';
      await page.goto(tryItHref(code, "javascript"));
      await expect(
        page.getByRole("button", { name: "JavaScript", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".monaco-editor")).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(() =>
            window.monaco.editor.getModels().map((model) => model.getValue()),
          ),
        )
        .toEqual([code]);

      await page.getByRole("button", { name: "Chạy Code" }).click();
      await expect(
        page.frameLocator('iframe[title="output"]').getByText("> hello %d"),
      ).toBeVisible();
    });
  });

  test("[S6] sees the sign-in form on the login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("Email...")).toBeVisible();
    await expect(page.getByPlaceholder("Mật khẩu...")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Đăng nhập", exact: true }),
    ).toBeVisible();
  });
});
