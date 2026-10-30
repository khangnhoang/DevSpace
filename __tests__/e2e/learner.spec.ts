import { ACCOUNTS, authFile } from "./accounts";
import { expect, test } from "./fixtures";
import { learnerEnrollmentCount, prepareLearnerEnrollment } from "./service-role";

const PAID_LESSON = "/learn/javascript-can-ban/bien-va-kieu-du-lieu";
const FREE_COURSE_ID = 1;

// The learner is enrolled nowhere.
test.use({ storageState: authFile("learner") });

test("[L2] is sent to the course page from a lesson of a course they are not enrolled in", async ({ page }) => {
  await page.goto(PAID_LESSON);
  await expect(page).toHaveURL(/\/course\/javascript-can-ban$/);
  await expect(page.getByRole("heading", { name: "JavaScript căn bản" })).toBeVisible();
  await expect(page.getByText("Khai báo biến bằng let và const.")).toHaveCount(0);
});

test("[L3] is sent to the home page from /admin", async ({ page, baseURL }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(`${baseURL}/`);
});

test("[L4] sees their name and email on the profile page", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByText(ACCOUNTS.learner.fullName).first()).toBeVisible();
  await expect(page.getByText(ACCOUNTS.learner.email)).toBeVisible();
});

// The only write path of the suite. The cleanup runs even when the test fails (G5).
test.describe("enrolling in a free course", () => {
  test.beforeEach(async () => { await prepareLearnerEnrollment(FREE_COURSE_ID); });
  test("[L5] enrolls in the free course and opens its lesson", async ({ page }) => {
    expect(await learnerEnrollmentCount(FREE_COURSE_ID), "the learner must not be enrolled before the test").toBe(0);

    await page.goto("/course/lam-quen-voi-html");
    await page.getByRole("button", { name: "Đăng ký học ngay" }).click();
    await expect(page.getByText("Đăng ký thành công!")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tiếp tục học ngay" })).toBeVisible();
    expect(await learnerEnrollmentCount(FREE_COURSE_ID)).toBe(1);

    await page.goto("/learn/lam-quen-voi-html/cau-truc-mot-trang-html");
    await expect(page.getByText("Một trang HTML gồm thẻ html, head và body.")).toBeVisible();
  });
});
