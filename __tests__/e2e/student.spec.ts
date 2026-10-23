import { authFile } from "./accounts";
import { expect, test } from "./fixtures";

// The student is enrolled in the paid course with an approved payment.
test.use({ storageState: authFile("student") });

test("[T1] reads a lesson of the course they are enrolled in", async ({ page }) => {
  await page.goto("/learn/javascript-can-ban/bien-va-kieu-du-lieu");
  await expect(page).toHaveURL(/\/learn\/javascript-can-ban\/bien-va-kieu-du-lieu$/);
  await expect(page.getByText("Khai báo biến bằng let và const.")).toBeVisible();
});

test("[T2] sees the first question of the lesson quiz", async ({ page }) => {
  await page.goto("/learn/javascript-can-ban/bien-va-kieu-du-lieu/quiz");
  await expect(page.getByText("Câu 1 / 2")).toBeVisible();
  await expect(page.getByText("Từ khóa nào khai báo biến có thể gán lại?")).toBeVisible();
});
