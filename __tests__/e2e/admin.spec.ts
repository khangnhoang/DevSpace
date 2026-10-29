import { ACCOUNTS, authFile } from "./accounts";
import { backgroundOf, confirmDialogOf, expectDismissKeepsObject, expectFitsPhone, expectKeyboardFlow, expectOnTop, recordMutations } from "./confirm-dialog";
import { expect, test } from "./fixtures";
import {
  createChapterFixture,
  createCourseFixture,
  createExerciseFixture,
  createLessonFixture,
  createUserFixture,
  removeE2eFixtures,
  rowExists,
  userExists,
} from "./service-role";

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

    // BL-008: the seed sets no image_url, so the card shows the shared fallback and it loads.
    const image = page.getByRole("img", { name: "Làm quen với HTML" });
    await expect(image).toHaveAttribute("src", /no-course-image\.png/);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
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

  test("[A3] a delete that fails in transit shows an error and keeps the user listed", async ({ page }) => {
    await page.goto("/admin/users");
    const row = page.getByRole("row").filter({ hasText: ACCOUNTS.learner.email });
    await expect(row).toBeVisible();

    // The aborted request never reaches the server, so the row writes nothing.
    let aborted = 0;
    await page.route("**/admin/users", (route) => {
      if (route.request().method() !== "POST" || aborted > 0) return route.fallback();
      aborted++;
      return route.abort();
    });

    await row.getByRole("button", { name: /Xóa người dùng/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Xóa người dùng", exact: true }).click();

    await expect(page.getByText("Không nhận được kết quả từ máy chủ")).toBeVisible();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(aborted).toBe(1);
    await expect(row).toBeVisible();
  });

  test("[A2] reads a lesson without being enrolled", async ({ page }) => {
    await page.goto("/learn/javascript-can-ban/bien-va-kieu-du-lieu");
    await expect(page.getByText("Khai báo biến bằng let và const.")).toBeVisible();
  });
});

// The confirm dialogs of the admin delete buttons (app/components/ConfirmDialog.tsx). Each delete row creates its
// own E2E fixture through the service role, so no seed row is deleted; the dialog-only rows open a seed row's
// dialog and never confirm it.
test.describe("confirm dialogs on the admin pages", () => {
  test.beforeEach(async () => {
    await removeE2eFixtures();
  });

  test.afterEach(async () => {
    await removeE2eFixtures();
  });

  test("[A4] deleting a course names it, is cancelled by Escape and cancel, and deletes it on confirm", async ({ page }) => {
    const course = await createCourseFixture();
    await page.goto("/admin/courses");
    const trigger = page.getByRole("button", { name: `Xoá khoá học ${course.label}` });
    await expect(trigger).toBeVisible();
    const mutations = recordMutations(page);
    const dialog = confirmDialogOf(page);

    await expectDismissKeepsObject(page, () => trigger.click(), "Hủy", () => expect(trigger).toBeVisible(), mutations);

    await trigger.click();
    await expect(dialog).toContainText(course.label);
    await expect(dialog).toContainText("xoá vĩnh viễn");
    await dialog.getByRole("button", { name: "Xoá khoá học", exact: true }).click();

    await expect(page.getByText("Xoá thành công")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveCount(0);
    expect(await rowExists("courses", course.id)).toBe(false);
  });

  test("[A5] deleting a chapter names it, is cancelled by Escape and cancel, and deletes it on confirm", async ({ page }) => {
    const chapter = await createChapterFixture();
    await page.goto("/admin/chapters");
    await page.getByRole("combobox").first().selectOption({ label: "Làm quen với HTML" });
    const trigger = page.getByRole("button", { name: `Xóa chương ${chapter.label}` });
    await expect(trigger).toBeVisible();
    const mutations = recordMutations(page);
    const dialog = confirmDialogOf(page);

    await expectDismissKeepsObject(page, () => trigger.click(), "Hủy", () => expect(trigger).toBeVisible(), mutations);

    await trigger.click();
    await expect(dialog).toContainText(chapter.label);
    await expect(dialog).toContainText("không còn thuộc chương nào");
    await dialog.getByRole("button", { name: "Xóa chương", exact: true }).click();

    await expect(page.getByText("Xóa chương thành công!")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveCount(0);
    expect(await rowExists("chapters", chapter.id)).toBe(false);
  });

  test("[A6] deleting a lesson names it, is cancelled by Escape and cancel, and deletes it on confirm", async ({ page }) => {
    const lesson = await createLessonFixture();
    await page.goto("/admin/lessons");
    const trigger = page.getByRole("button", { name: `Xóa bài học ${lesson.label}` });
    await expect(trigger).toBeVisible();
    const mutations = recordMutations(page);
    const dialog = confirmDialogOf(page);

    await expectDismissKeepsObject(page, () => trigger.click(), "Hủy", () => expect(trigger).toBeVisible(), mutations);

    await trigger.click();
    await expect(dialog).toContainText(lesson.label);
    await expect(dialog).toContainText("xóa vĩnh viễn");
    await dialog.getByRole("button", { name: "Xóa bài học", exact: true }).click();

    await expect(page.getByText("Xoá bài học thành công!")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveCount(0);
    expect(await rowExists("lessons", lesson.id)).toBe(false);
  });

  test("[A7] deleting an exercise names its question, is cancelled by Escape and cancel, and deletes it on confirm", async ({ page }) => {
    const lesson = await createLessonFixture();
    const exercise = await createExerciseFixture(lesson.id);
    await page.goto("/admin/lessons");
    await page.getByRole("row").filter({ hasText: lesson.label }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Trắc nghiệm" }).click();
    const trigger = page.getByRole("button", { name: `Xóa câu hỏi ${exercise.label}` });
    await expect(trigger).toBeVisible();
    const mutations = recordMutations(page);
    const dialog = confirmDialogOf(page);

    await expectDismissKeepsObject(page, () => trigger.click(), "Hủy", () => expect(trigger).toBeVisible(), mutations);

    await trigger.click();
    await expect(dialog).toContainText(exercise.label);
    await expect(dialog).toContainText("không thể hoàn tác");
    await dialog.getByRole("button", { name: "Xóa câu hỏi", exact: true }).click();

    await expect(page.getByText("Xóa câu hỏi thành công!")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveCount(0);
    expect(await rowExists("exercises", exercise.id)).toBe(false);
  });

  test("[A8] deleting a user names them, is cancelled by Escape and cancel, and deletes the account on confirm", async ({ page }) => {
    const user = await createUserFixture();
    await page.goto("/admin/users");
    const trigger = page.getByRole("button", { name: `Xóa người dùng ${user.label}` });
    await expect(trigger).toBeVisible();
    const mutations = recordMutations(page);
    const dialog = confirmDialogOf(page);

    await expectDismissKeepsObject(page, () => trigger.click(), "Hủy", () => expect(trigger).toBeVisible(), mutations);

    await trigger.click();
    await expect(dialog).toContainText(user.label);
    await expect(dialog).toContainText("xóa vĩnh viễn");
    await dialog.getByRole("button", { name: "Xóa người dùng", exact: true }).click();

    await expect(page.getByText("Đã xóa vĩnh viễn người dùng khỏi hệ thống!")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveCount(0);
    expect(await userExists(user.id)).toBe(false);
  });

  // The confirm path calls Gemini, so it is the Owner's check on a deployment (manual-ui-validation.md). Nothing here
  // reaches it: cancel sends nothing, and the unsaved lesson never opens the dialog.
  test("[A9] the AI bulk create asks first, sends nothing when cancelled and refuses an unsaved lesson", async ({ page }) => {
    const lesson = await createLessonFixture();
    await page.goto("/admin/lessons");
    await page.getByRole("row").filter({ hasText: lesson.label }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Trắc nghiệm" }).click();
    const aiMagic = page.getByRole("button", { name: /AI Magic/ });
    const bulk = page.getByRole("button", { name: /Tự động thêm 3 câu/ });
    await expect(aiMagic).toBeVisible();
    const mutations = recordMutations(page);
    const dialog = confirmDialogOf(page);
    const openBulk = async () => {
      if (!(await bulk.isVisible())) await aiMagic.click();
      await bulk.click();
    };

    await expectDismissKeepsObject(page, openBulk, "Hủy", () => expect(aiMagic).toBeVisible(), mutations);
    await openBulk();
    await expect(dialog).toContainText("AI sẽ tự động lưu 3 câu hỏi vào bài này");
    await page.keyboard.press("Escape");

    // An unsaved lesson shows the guard's toast and no dialog.
    await page.goto("/admin/lessons");
    // The page source spells this label with combining accents, so it is found by position, not by name.
    await page.getByRole("main").getByRole("button").first().click();
    await page.getByRole("button", { name: "Trắc nghiệm" }).click();
    const unsavedMutations = recordMutations(page);
    await aiMagic.click();
    await bulk.click();
    await expect(page.getByText("Chưa lưu bài học")).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(unsavedMutations).toEqual([]);
  });

  // A seed user's dialog, opened and dismissed only.
  test("[A10] the delete dialog is keyboard-usable, fits 375px and keeps the admin colours in a dark OS scheme", async ({ page }) => {
    await page.goto("/admin/users");
    const trigger = page.getByRole("button", { name: `Xóa người dùng ${ACCOUNTS.learner.fullName}` });
    await expect(trigger).toBeVisible();

    await expectKeyboardFlow(page, trigger);

    await page.emulateMedia({ colorScheme: "dark" });
    await trigger.click();
    expect(await backgroundOf(page)).toBe("rgb(25, 28, 36)");
    await page.keyboard.press("Escape");
    await page.emulateMedia({ colorScheme: "light" });
    await trigger.click();
    expect(await backgroundOf(page)).toBe("rgb(25, 28, 36)");
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/courses");
    await page.getByRole("button", { name: "Xoá khoá học Làm quen với HTML" }).click();
    await expectFitsPhone(page);
    await expectOnTop(page);
    await page.keyboard.press("Escape");
  });
});
