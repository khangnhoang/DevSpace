import type { Page } from "@playwright/test";
import { authFile } from "./accounts";
import { backgroundOf, confirmDialogOf, expectDismissKeepsObject, expectFitsPhone, expectKeyboardFlow, expectOnTop, recordMutations } from "./confirm-dialog";
import { expect, test } from "./fixtures";
import { commentDeletedAt, createCommentFixture } from "./service-role";

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

// Stops before the last question, so no progress is saved.
test("[T3] is told a wrong quiz answer is wrong and the right one is right", async ({ page }) => {
  await page.goto("/learn/javascript-can-ban/bien-va-kieu-du-lieu/quiz");

  await page.getByText("fixed", { exact: true }).click();
  await page.getByRole("button", { name: "Kiểm tra" }).click();
  await expect(page.getByText("Sai rồi, thử lại nhé")).toBeVisible();

  await page.getByRole("button", { name: "Làm lại" }).click();
  await page.getByText("let", { exact: true }).click();
  await page.getByRole("button", { name: "Kiểm tra" }).click();
  await expect(page.getByText("Chính xác!")).toBeVisible();
});

// The confirm dialog of the comment delete (app/components/ConfirmDialog.tsx, learner tone). The row deletes its own
// E2E comment, never the seed one.
test.describe("confirm dialog on the lesson comments", () => {
  const LESSON_URL = "/learn/javascript-can-ban/bien-va-kieu-du-lieu";

  // The button has no text below the sm breakpoint, so it is found by its icon.
  async function openMenuOf(page: Page, label: string) {
    await page.goto(LESSON_URL);
    await page.locator("button").filter({ has: page.locator("svg.lucide-message-square-text") }).click();
    const row = page.locator("div.group").filter({ hasText: label });
    await expect(row).toBeVisible();
    await row.getByRole("button").first().click();
    return row.getByRole("button", { name: "Xóa", exact: true });
  }

  test("[T4] deleting a comment shows it, is cancelled by Escape and cancel, and deletes it on confirm", async ({ page }) => {
    const comment = await createCommentFixture();
    const trigger = await openMenuOf(page, comment.label);
    const mutations = recordMutations(page);
    const dialog = confirmDialogOf(page);

    await expectDismissKeepsObject(page, () => trigger.click(), "Hủy", () => expect(trigger).toBeVisible(), mutations);
    expect(await commentDeletedAt(comment.id)).toBeNull();

    await trigger.click();
    await expect(dialog).toContainText(comment.label);
    await expect(dialog).toContainText("không thể hoàn tác");
    await dialog.getByRole("button", { name: "Xóa bình luận", exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("Bình luận đã bị xóa").first()).toBeVisible();
    expect(await commentDeletedAt(comment.id)).not.toBeNull();
  });

  test("[T5] the comment dialog is keyboard-usable, fits 375px, sits on top and stays white in a dark OS scheme", async ({ page }) => {
    const comment = await createCommentFixture();
    const trigger = await openMenuOf(page, comment.label);

    await expectKeyboardFlow(page, trigger);
    await trigger.click();
    await expectOnTop(page);
    await page.keyboard.press("Escape");

    await page.emulateMedia({ colorScheme: "dark" });
    await trigger.click();
    expect(await backgroundOf(page)).toBe("rgb(255, 255, 255)");
    await page.keyboard.press("Escape");
    await page.emulateMedia({ colorScheme: "light" });

    await page.setViewportSize({ width: 375, height: 812 });
    const phoneTrigger = await openMenuOf(page, comment.label);
    await phoneTrigger.click();
    await expectFitsPhone(page);
    await expectOnTop(page);
    await page.keyboard.press("Escape");
    expect(await commentDeletedAt(comment.id)).toBeNull();
  });
});

test("[T6] the transaction history filter is labelled, filters by status and aligns left on a phone", async ({ page }) => {
  await page.goto("/profile");
  const heading = page.getByRole("heading", { name: "Lịch sử giao dịch" });
  const filter = page.getByLabel("Lọc theo trạng thái");
  const history = page.getByRole("table");
  // The seed gives the student one approved payment and no other order.
  await expect(history).toContainText("Thành công");

  await filter.selectOption("pending");
  await expect(history).toContainText("Không tìm thấy giao dịch nào.");
  await expect(history).not.toContainText("Thành công");
  await filter.selectOption("success");
  await expect(history).toContainText("Thành công");

  // AF-P5: below md the heading and the filter start at the table's left edge instead of centring.
  await page.setViewportSize({ width: 375, height: 812 });
  const [headingBox, filterBox, historyBox] = await Promise.all([heading.boundingBox(), filter.boundingBox(), history.boundingBox()]);
  expect(headingBox && historyBox && Math.abs(headingBox.x - historyBox.x) < 2, "the heading aligns with the table").toBe(true);
  expect(filterBox && historyBox && filterBox.x - historyBox.x < 40, "the filter starts near the table's left edge").toBe(true);
});
