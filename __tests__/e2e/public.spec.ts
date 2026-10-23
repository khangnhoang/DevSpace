import { expect, test } from "./fixtures";

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

  test("[S5] opens the try-it page without a page error", async ({ page }) => {
    const response = await page.goto("/try_it");
    expect(response?.status()).toBe(200);
    // The editor itself loads from a CDN, which the network guard aborts: only the page shell is asserted.
    await expect(page.getByRole("button", { name: "Chạy Code" })).toBeVisible();
  });

  test("[S6] sees the sign-in form on the login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("Email...")).toBeVisible();
    await expect(page.getByPlaceholder("Mật khẩu...")).toBeVisible();
    await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  });
});
