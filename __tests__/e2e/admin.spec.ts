import { ACCOUNTS, authFile } from "./accounts";
import { expect, test } from "./fixtures";

test.use({ storageState: authFile("admin") });

test.describe("admin pages", () => {
  test("[A1] the dashboard shows the seed courses", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("Tổng quan hệ thống")).toBeVisible();
    await expect(page.getByText("JavaScript căn bản").first()).toBeVisible();
  });

  test("[A1] the course list shows the seed courses", async ({ page }) => {
    await page.goto("/admin/courses");
    await expect(page.getByText("Làm quen với HTML")).toBeVisible();
    await expect(page.getByText("JavaScript căn bản")).toBeVisible();
  });

  test("[A1] the chapter list shows the chapter of the selected course", async ({ page }) => {
    await page.goto("/admin/chapters");
    // The table stays empty until a course is chosen.
    await page.getByRole("combobox").first().selectOption({ label: "Làm quen với HTML" });
    await expect(page.getByText("Chương 1: Trang web đầu tiên")).toBeVisible();
  });

  test("[A1] the lesson list shows the seed lessons", async ({ page }) => {
    await page.goto("/admin/lessons");
    await expect(page.getByText("Cấu trúc một trang HTML")).toBeVisible();
    await expect(page.getByText("Biến và kiểu dữ liệu")).toBeVisible();
  });

  test("[A1] the transaction list shows the student's approved payment", async ({ page }) => {
    await page.goto("/admin/transactions");
    const payment = page.getByRole("row").filter({ hasText: "JavaScript căn bản" });
    await expect(payment).toBeVisible();
    await expect(payment.getByText("199.000")).toBeVisible();
  });

  test("[A1] the user list shows the three seed users", async ({ page }) => {
    await page.goto("/admin/users");
    for (const actor of ["learner", "student", "admin"] as const) {
      await expect(page.getByText(ACCOUNTS[actor].email)).toBeVisible();
    }
  });

  test("[A2] reads a lesson without being enrolled", async ({ page }) => {
    await page.goto("/learn/javascript-can-ban/bien-va-kieu-du-lieu");
    await expect(page.getByText("Khai báo biến bằng let và const.")).toBeVisible();
  });
});
