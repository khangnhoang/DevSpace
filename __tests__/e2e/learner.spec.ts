// Layer audit (QE-U6, AC11, 2026-11-07): the layer each row needs under the e2e rule of test-quality-strategy.
// Boundaries: persistence, refusal (server, database or Auth), failed request, permission, redirect, upload, layout
// (real browser: layout, engine or sandbox). A row that needs two names both; "guard client-only" marks a part a
// component test could cover. "client-only -> <file>" is a QE-F8 move candidate under __tests__/unit/components/.
// The audit changes no row, assertion or timeout.
//   [L2] permission, redirect: a lesson of a course the learner is not enrolled in
//   [L3] permission, redirect: /admin is closed to a learner
//   [L4] persistence: the profile shows the stored name and email
//   [L7] client-only -> ProfilePage.test.tsx (empty details hidden, edit dialog opens)
//   [L5] persistence: the enrollment and the admin notification are stored
//   [L6] persistence: the profile lists the stored enrollment at 0%
import { ACCOUNTS, authFile } from "./accounts";
import { expect, test } from "./fixtures";
import {
  learnerEnrollmentCount,
  prepareLearnerEnrollment,
} from "./service-role";

const PAID_LESSON = "/learn/javascript-can-ban/bien-va-kieu-du-lieu";
const FREE_COURSE_ID = 1;

// The learner is enrolled nowhere.
test.use({ storageState: authFile("learner") });

test("[L2] is sent to the course page from a lesson of a course they are not enrolled in", async ({
  page,
}) => {
  await page.goto(PAID_LESSON);
  await expect(page).toHaveURL(/\/course\/javascript-can-ban$/);
  await expect(
    page.getByRole("heading", { name: "JavaScript căn bản" }),
  ).toBeVisible();
  await expect(page.getByText("Khai báo biến bằng let và const.")).toHaveCount(
    0,
  );
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

test("[L7] the profile card hides empty details, invites the learner to add them and opens the edit dialog", async ({
  page,
}) => {
  await page.goto("/profile");
  await expect(
    page.getByText(
      "Thêm giới tính, ngày sinh và nơi ở để hoàn thiện hồ sơ của bạn.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Trống")).toHaveCount(0);
  await expect(page.getByText("Giới tính:")).toHaveCount(0);
  await expect(page.getByText("Ngày sinh:")).toHaveCount(0);
  await expect(page.getByText("Nơi ở:")).toHaveCount(0);

  await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();
  await expect(
    page.getByRole("heading", { name: "Cập nhật hồ sơ" }),
  ).toBeVisible();
});

// The only write path of the suite. The cleanup runs even when the test fails (G5).
test.describe("enrolling in a free course", () => {
  test.beforeEach(async () => {
    await prepareLearnerEnrollment(FREE_COURSE_ID);
  });
  test("[L5] enrolls in the free course and opens its lesson", async ({
    page,
  }) => {
    expect(
      await learnerEnrollmentCount(FREE_COURSE_ID),
      "the learner must not be enrolled before the test",
    ).toBe(0);

    await page.goto("/course/lam-quen-voi-html");
    await page.getByRole("button", { name: "Đăng ký học ngay" }).click();
    await expect(page.getByText("Đăng ký thành công!")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tiếp tục học ngay" }),
    ).toBeVisible();
    expect(await learnerEnrollmentCount(FREE_COURSE_ID)).toBe(1);

    await page.goto("/learn/lam-quen-voi-html/cau-truc-mot-trang-html");
    await expect(
      page.getByText("Một trang HTML gồm thẻ html, head và body."),
    ).toBeVisible();
  });

  test("[L6] an enrolled course with no lesson done shows on the profile at 0% and starts at its first lesson", async ({
    page,
  }) => {
    expect(
      await learnerEnrollmentCount(FREE_COURSE_ID),
      "the learner must not be enrolled before the test",
    ).toBe(0);
    // Neither enrolled nor started: the course is not listed.
    await page.goto("/profile");
    await expect(
      page.getByText("Bạn chưa tham gia khóa học nào."),
    ).toBeVisible();

    await page.goto("/course/lam-quen-voi-html");
    await page.getByRole("button", { name: "Đăng ký học ngay" }).click();
    await expect(page.getByText("Đăng ký thành công!")).toBeVisible();

    await page.goto("/profile");
    const card = page
      .getByRole("article")
      .filter({ hasText: "Làm quen với HTML" });
    await expect(card).toContainText("0%");
    await expect(card).toContainText("0/2 bài học");
    const link = card.getByRole("link", { name: "Bắt đầu học" });
    await expect(link).toHaveAttribute(
      "href",
      "/learn/lam-quen-voi-html/cau-truc-mot-trang-html",
    );
    await expect(page.getByRole("article")).toHaveCount(1);
    await link.click();
    await expect(page).toHaveURL(
      /\/learn\/lam-quen-voi-html\/cau-truc-mot-trang-html$/,
    );
  });
});
