import type { Page } from "@playwright/test";
import type * as Monaco from "monaco-editor";
import { expect, test } from "./fixtures";

declare global {
  interface Window {
    monaco: typeof Monaco;
  }
}

// Anonymous visitor: the signed-out paths and the redirects that protect the others.
test.describe("anonymous visitor", () => {
  test("[S1] sees both seed courses on the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Làm quen với HTML").first()).toBeVisible();
    await expect(page.getByText("JavaScript căn bản").first()).toBeVisible();
  });

  test("[S2] sees the course name and both lessons of a free course", async ({ page }) => {
    await page.goto("/course/lam-quen-voi-html");
    await expect(page.getByRole("heading", { name: "Làm quen với HTML" })).toBeVisible();
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

  test.describe("try-it page", () => {
    // Every request the editor makes, with the origin it went to and the status it got (undefined: no response).
    function recordMonaco(page: Page) {
      const requests: { url: string; origin: string }[] = [];
      const statuses = new Map<string, number>();
      page.context().on("request", (request) => {
        const url = new URL(request.url());
        if (!["data:", "blob:", "about:"].includes(url.protocol)) requests.push({ url: request.url(), origin: url.origin });
      });
      page.context().on("response", (response) => statuses.set(response.url(), response.status()));
      return { requests, statuses };
    }

    test("[S5] loads the editor and its files from the app's own origin", async ({ page }) => {
      const { requests, statuses } = recordMonaco(page);
      const response = await page.goto("/try_it");
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("button", { name: "Chạy Code" })).toBeVisible();
      await expect(page.locator(".monaco-editor")).toBeVisible();

      const origin = new URL(page.url()).origin;
      expect(requests.filter((request) => request.origin !== origin), "requests that left the app's origin").toEqual([]);
      const monaco = () => requests.filter((request) => request.url.startsWith(`${origin}/monaco/vs/`));
      expect(monaco().some((request) => request.url.endsWith("/monaco/vs/loader.js"))).toBe(true);
      // A response can arrive after the editor is visible: wait for every request to be answered.
      await expect.poll(() => monaco().filter((request) => statuses.get(request.url) !== 200).map((request) => request.url)).toEqual([]);
      expect(await page.evaluate(() => window.monaco.editor.getModels().length)).toBeGreaterThan(0);
    });

    test("[S5b] runs the language worker, which marks invalid JavaScript", async ({ page }) => {
      const { requests, statuses } = recordMonaco(page);
      await page.goto("/try_it");
      await page.getByRole("button", { name: "JavaScript" }).click();
      await expect(page.locator(".monaco-editor")).toBeVisible();
      // Set through the model: typing triggers the suggestion widget, which swallows keys.
      await expect.poll(() => page.evaluate(() => window.monaco.editor.getModels().length)).toBe(1);
      await page.evaluate(() => window.monaco.editor.getModels()[0].setValue("const = ;"));

      await expect.poll(() => page.evaluate(() => window.monaco.editor.getModelMarkers({}).length)).toBeGreaterThan(0);
      const origin = new URL(page.url()).origin;
      const workers = () => requests.filter((request) => request.url.startsWith(`${origin}/monaco/vs/`) && /worker/i.test(request.url));
      expect(workers().length, "no worker file was requested").toBeGreaterThan(0);
      await expect.poll(() => workers().filter((request) => statuses.get(request.url) !== 200).map((request) => request.url)).toEqual([]);
    });
  });

  test("[S6] sees the sign-in form on the login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("Email...")).toBeVisible();
    await expect(page.getByPlaceholder("Mật khẩu...")).toBeVisible();
    await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  });
});
