// Layer audit (QE-U6, AC11, 2026-11-07): the layer each row needs under the e2e rule of test-quality-strategy.
// Boundaries: persistence, refusal (server, database or Auth), failed request, permission, redirect, upload, layout
// (real browser: layout, engine or sandbox). A row that needs two names both; "guard client-only" marks a part a
// component test could cover. "client-only -> <file>" is a QE-F8 move candidate under __tests__/unit/components/.
// The audit changes no row, assertion or timeout.
//   [T1] permission: an enrolled student reads the lesson (server gate)
//   [T2] permission: exercises are readable by an enrolled student (RLS)
//   [T3] client-only -> Quiz.test.tsx (wrong and right answer feedback)
//   [T4] persistence: the comment is soft-deleted (cancel paths client-only)
//   [T5] layout: keyboard flow, 375px, stacking and dark scheme of the dialog
//   [T6] layout: Radix select, dark scheme and phone alignment (the filter logic is client-only ->
//       ProfilePage.test.tsx)
//   [T7] persistence, redirect: the profile card from stored progress leads to the next lesson
//   [T8] persistence: newest enrollment first (expand and collapse client-only -> ProfilePage.test.tsx)
//   [T11] layout: row height and no sideways scroll at 375px
//   [T9] layout: no sideways scroll at 375px
//   [T10] layout: the name and the edit button do not wrap at 768px
//   [T12] persistence, redirect: the complete button sends the student to the quiz and saves nothing
//   [T13] persistence: a full quiz saves the progress
//   [T14] persistence, redirect: the last lesson is saved and the finish page opens
import type { Locator, Page } from "@playwright/test";
import { authFile } from "./accounts";
import {
  backgroundOf,
  confirmDialogOf,
  expectDismissKeepsObject,
  expectFitsPhone,
  expectKeyboardFlow,
  expectOnTop,
  recordMutations,
} from "./confirm-dialog";
import { expect, test } from "./fixtures";
import { observeSession } from "./session-diagnostics";
import {
  commentContent,
  commentDeletedAt,
  createCommentFixture,
  createCompletedStudentCourseFixture,
  createLearningCourseFixture,
  createStudentCourseFixtures,
  studentProgressOf,
} from "./service-role";

// The student is enrolled in the paid course with an approved payment.
test.use({ storageState: authFile("student") });

test("[T1] reads a lesson of the course they are enrolled in", async ({
  page,
}) => {
  await page.goto("/learn/javascript-can-ban/bien-va-kieu-du-lieu");
  await expect(page).toHaveURL(
    /\/learn\/javascript-can-ban\/bien-va-kieu-du-lieu$/,
  );
  await expect(
    page.getByText("Khai báo biến bằng let và const."),
  ).toBeVisible();
});

test("[T2] sees the first question of the lesson quiz", async ({ page }) => {
  await page.goto("/learn/javascript-can-ban/bien-va-kieu-du-lieu/quiz");
  await expect(page.getByText("Câu 1 / 2")).toBeVisible();
  await expect(
    page.getByText("Từ khóa nào khai báo biến có thể gán lại?"),
  ).toBeVisible();
});

// Stops before the last question, so no progress is saved.
test("[T3] is told a wrong quiz answer is wrong and the right one is right", async ({
  page,
}) => {
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
    await page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-message-square-text") })
      .click();
    const row = page.locator("div.group").filter({ hasText: label });
    await expect(row).toBeVisible();
    await row.getByRole("button").first().click();
    return row.getByRole("button", { name: "Xóa", exact: true });
  }

  test("[T4] deleting a comment shows it, is cancelled by Escape and cancel, and deletes it on confirm", async ({
    page,
  }) => {
    const comment = await createCommentFixture();
    const trigger = await openMenuOf(page, comment.label);
    const mutations = recordMutations(page);
    const dialog = confirmDialogOf(page);

    await expectDismissKeepsObject(
      page,
      () => trigger.click(),
      "Hủy",
      () => expect(trigger).toBeVisible(),
      mutations,
    );
    expect(await commentDeletedAt(comment.id)).toBeNull();

    await trigger.click();
    await expect(dialog).toContainText(comment.label);
    await expect(dialog).toContainText("không thể hoàn tác");
    await dialog
      .getByRole("button", { name: "Xóa bình luận", exact: true })
      .click();

    await expect(dialog).toBeHidden();
    // Soft-deleted comments are hidden from the API (SE-P4), so the row disappears and stays gone after a reload,
    // while the stored row keeps its content.
    await expect(page.getByText(comment.label)).toHaveCount(0);
    expect(await commentDeletedAt(comment.id)).not.toBeNull();
    expect(await commentContent(comment.id)).toBe(comment.label);
    await page.reload();
    await page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-message-square-text") })
      .click();
    // The seed comment on this lesson is still listed, so the panel has loaded before the absence check.
    await expect(page.locator("div.group").first()).toBeVisible();
    await expect(page.getByText(comment.label)).toHaveCount(0);
  });

  test("[T5] the comment dialog is keyboard-usable, fits 375px, sits on top and stays white in a dark OS scheme", async ({
    page,
  }) => {
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

test("[T6] the transaction history filter is labelled, filters by status from mouse and keyboard and aligns left on a phone", async ({
  page,
}) => {
  await page.goto("/profile");
  const heading = page.getByRole("heading", { name: "Lịch sử giao dịch" });
  const filter = page.getByRole("combobox", { name: "Lọc theo trạng thái" });
  const history = page.getByRole("table");
  // The seed gives the student one approved payment and no other order.
  await expect(history).toContainText("Thành công");
  await expect(history).toContainText("199.000đ");

  await filter.click();
  await page.getByRole("option", { name: "Chờ duyệt" }).click();
  await expect(filter).toHaveText("Chờ duyệt");
  await expect(history).toContainText("Không tìm thấy giao dịch nào.");
  await expect(history).not.toContainText("Thành công");

  // Keyboard: open from the focused trigger, move to the next option and pick it; focus returns to the trigger.
  await filter.focus();
  await page.keyboard.press("Enter");
  // Radix moves focus to the selected option after the list opens; a key sent before that is lost.
  await expect(page.getByRole("option", { name: "Chờ duyệt" })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("option", { name: "Thành công" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(filter).toHaveText("Thành công");
  await expect(filter).toBeFocused();
  await expect(history).toContainText("Thành công");

  // The list keeps the page's white surface in a dark OS scheme (the shadcn tokens would turn it dark).
  await page.emulateMedia({ colorScheme: "dark" });
  await filter.click();
  expect(
    await page
      .getByRole("listbox")
      .evaluate(
        (el) =>
          getComputedStyle(el.closest("[data-slot=select-content]")!)
            .backgroundColor,
      ),
  ).toBe("rgb(255, 255, 255)");
  await page.keyboard.press("Escape");
  await page.emulateMedia({ colorScheme: "light" });

  // AF-P5: below md the heading and the filter start at the left edge of the history, which is a list of blocks there
  // (the table is hidden), instead of centring. The filter still narrows the blocks.
  await page.setViewportSize({ width: 375, height: 812 });
  const blocks = page.getByRole("list", { name: "Danh sách giao dịch" });
  await expect(blocks).toContainText("Thành công");
  const [headingBox, filterBox, blocksBox] = await Promise.all([
    heading.boundingBox(),
    filter.boundingBox(),
    blocks.boundingBox(),
  ]);
  expect(
    headingBox && blocksBox && Math.abs(headingBox.x - blocksBox.x) < 2,
    "the heading aligns with the blocks",
  ).toBe(true);
  expect(
    filterBox && blocksBox && filterBox.x - blocksBox.x < 40,
    "the filter starts near the blocks' left edge",
  ).toBe(true);

  await filter.click();
  await page.getByRole("option", { name: "Chờ duyệt" }).click();
  await expect(filter).toHaveText("Chờ duyệt");
  await expect(
    page.getByText("Không tìm thấy giao dịch nào.").filter({ visible: true }),
  ).toBeVisible();
  await expect(blocks).toHaveCount(0);
  await filter.click();
  await page.getByRole("option", { name: "Thành công" }).click();
  await expect(blocks).toContainText("Thành công");
});

// The student is enrolled in course 2 with lesson 3 done and lesson 4 open.
test("[T7] the course the student is on is a featured card that leads back to the next unfinished lesson", async ({
  page,
}) => {
  await page.goto("/profile");
  const card = page
    .getByRole("article")
    .filter({ hasText: "JavaScript căn bản" });
  await expect(
    card.getByRole("heading", { level: 3, name: "JavaScript căn bản" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  await expect(card).toContainText("1/2 bài học");
  await expect(
    card.getByRole("progressbar", { name: "Tiến độ khóa JavaScript căn bản" }),
  ).toHaveAttribute("aria-valuenow", "50");
  // The seed course has no image: the fallback renders, with an empty alt because the title is beside it.
  await expect(card.locator("img")).toHaveAttribute("src", /no-course-image/);
  await expect(card.locator("img")).toHaveAttribute("alt", "");

  const link = card.getByRole("link", { name: "Tiếp tục học" });
  await expect(link).toHaveAttribute(
    "href",
    "/learn/javascript-can-ban/ham-va-vong-lap",
  );
  // Four courses or fewer: no expand button.
  await expect(page.getByRole("button", { name: /^Xem tất cả/ })).toHaveCount(
    0,
  );

  await link.click();
  await expect(page).toHaveURL(/\/learn\/javascript-can-ban\/ham-va-vong-lap$/);
  await expect(
    page.getByText("Viết hàm với function và lặp bằng for."),
  ).toBeVisible();
});

test("[T8] with more than four courses the featured card and three rows show first, newest enrollment first, and the rest expand and collapse in place", async ({
  page,
  serverRecords,
}) => {
  // QE-P7: this row once found the student signed out. The facts below say whether Auth recognises the saved session
  // and whether anything refreshed it, so a lost session is named instead of surfacing as a missing course card.
  const session = await observeSession(
    page.context(),
    "student",
    serverRecords,
  );
  session.requireRecognised();
  await session.log("start");
  const extra = await createStudentCourseFixtures(4);
  await page.goto("/profile");
  const cards = page.getByRole("article");
  const expand = page.getByRole("button", { name: "Xem tất cả (5)" });
  const shownExtras = async () =>
    (
      await Promise.all(
        extra.map((fixture) =>
          cards.filter({ hasText: fixture.label }).count(),
        ),
      )
    ).reduce((sum, count) => sum + count, 0);

  await session.explainSignedOut(page, () => expect(cards).toHaveCount(4));
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  // The only unfinished course with lessons is featured on top; the rows follow, the latest enrollment first.
  await expect(cards.first()).toContainText("JavaScript căn bản");
  await expect(
    cards.first().getByRole("link", { name: "Tiếp tục học" }),
  ).toBeVisible();
  await expect(cards.nth(1)).toContainText(extra[3].label);
  expect(await shownExtras(), "three of the four other courses show").toBe(3);

  const url = page.url();
  await expand.click();
  await expect(cards).toHaveCount(5);
  expect(await shownExtras(), "every course shows once expanded").toBe(4);
  const collapse = page.getByRole("button", { name: "Thu gọn" });
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  expect(page.url(), "the list expands in place").toBe(url);

  await collapse.click();
  await expect(cards).toHaveCount(4);
  await expect(expand).toBeVisible();
  await session.log("end");
});

test('[T11] a course without lessons reads "Chưa có bài học", a finished one "Hoàn thành" with its review link, and a row is at most 72px tall at 375px', async ({
  page,
}) => {
  const [empty] = await createStudentCourseFixtures(1);
  const done = await createCompletedStudentCourseFixture();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/profile");

  const emptyRow = page.getByRole("article").filter({ hasText: empty.label });
  await expect(
    emptyRow.getByRole("heading", { level: 3, name: empty.label }),
  ).toBeVisible();
  await expect(emptyRow).toContainText("Chưa có bài học");
  await expect(emptyRow).not.toContainText("0/0");
  await expect(emptyRow.getByRole("progressbar")).toHaveCount(0);
  await expect(
    emptyRow.getByRole("link", { name: "Xem khóa học" }),
  ).toHaveAttribute("href", `/course/${empty.slug}`);
  await expect(emptyRow.locator("img")).toHaveAttribute(
    "src",
    /no-course-image/,
  );

  const doneRow = page.getByRole("article").filter({ hasText: done.label });
  await expect(doneRow).toContainText("Hoàn thành");
  await expect(doneRow.locator("svg.lucide-circle-check-big")).toHaveCount(1);
  await expect(doneRow.getByRole("link", { name: "Ôn lại" })).toHaveAttribute(
    "href",
    `/learn/${done.slug}/${done.lessonSlug}`,
  );

  for (const row of [
    emptyRow,
    doneRow,
    page.getByRole("article").filter({ hasText: "JavaScript căn bản" }),
  ]) {
    await expect(row).toBeVisible();
  }
  for (const row of [emptyRow, doneRow]) {
    const box = await row.boundingBox();
    expect(box && box.height <= 72, `a row is ${box?.height}px tall`).toBe(
      true,
    );
  }
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    "the page scrolls sideways",
  ).toBe(true);
});

const overflows = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => el.scrollWidth > el.clientWidth);

test("[T9] at 375px the page and the history do not scroll sideways, the payment reads 199.000đ with a date without seconds and the courses start on the first screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/profile");
  const blocks = page.getByRole("list", { name: "Danh sách giao dịch" });
  await expect(blocks).toContainText("199.000đ");
  await expect(blocks).toContainText("Thành công");
  expect(await blocks.innerText()).toMatch(
    /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}(?!:\d)/,
  );

  expect(await overflows(page, "html"), "the page scrolls sideways").toBe(
    false,
  );
  // The frame clips what overflows it, so check that every part of every block sits inside the list.
  expect(
    await blocks.evaluate((list) =>
      Array.from(list.querySelectorAll("*")).some(
        (el) =>
          el.getBoundingClientRect().right >
          list.getBoundingClientRect().right + 1,
      ),
    ),
    "a block part sticks out of the history",
  ).toBe(false);

  const heading = page.getByRole("heading", { name: "Khóa học của tôi" });
  const box = await heading.boundingBox();
  expect(
    box && box.y < 812,
    "the courses heading starts within the first 812px",
  ).toBe(true);
});

test("[T10] at 768px the name and the edit button do not wrap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/profile");
  const button = page.getByRole("button", { name: "Chỉnh sửa hồ sơ" });
  const name = page.getByRole("heading", {
    level: 2,
    name: "Lê Minh Học Viên",
  });
  await expect(button).toBeVisible();
  // One line of text each: the label is not split across lines (text nodes only, the icon sits at its own height).
  const lines = (locator: Locator) =>
    locator.evaluate((el) => {
      const tops = new Set<number>();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of Array.from(range.getClientRects()))
          tops.add(Math.round(rect.top));
      }
      return tops.size;
    });
  expect(await lines(button), "the button label wraps").toBeLessThanOrEqual(1);
  expect(await lines(name), "the name wraps").toBe(1);
  expect(await overflows(page, "html"), "the page scrolls sideways").toBe(
    false,
  );
});

// M5 / M5b: the lesson complete button and the quiz save progress through the browser client. Each row uses its own
// course fixture with one lesson, so the progress it causes (or does not) is the only progress of that lesson.
test.describe("lesson completion", () => {
  const COMPLETE = /Đến bài sau/;

  test("[T12] completing a lesson that has exercises sends the student to its quiz and saves no progress", async ({
    page,
  }) => {
    const fixture = await createLearningCourseFixture(2);
    await page.goto(`/learn/${fixture.slug}/${fixture.lessonSlug}`);

    await page.getByRole("button", { name: COMPLETE }).click();

    await expect(
      page.getByText("Bạn cần hoàn thành bài tập trước!"),
    ).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/learn/${fixture.slug}/${fixture.lessonSlug}/quiz$`),
    );
    await expect(page.getByText("Câu 1 / 2")).toBeVisible();
    expect(await studentProgressOf(fixture.lessonId)).toBe(0);
  });

  test("[T13] answering every question of a lesson quiz shows the completion screen without the answer buttons and saves the progress", async ({
    page,
  }) => {
    const fixture = await createLearningCourseFixture(2);
    await page.goto(`/learn/${fixture.slug}/${fixture.lessonSlug}/quiz`);

    for (const [index, question] of fixture.questions.entries()) {
      const last = index === fixture.questions.length - 1;
      await expect(
        page.getByText(`Câu ${index + 1} / ${fixture.questions.length}`),
      ).toBeVisible();
      await expect(page.getByText(question.question)).toBeVisible();
      await page
        .getByText(question.options[question.correct], { exact: true })
        .click();
      await page.getByRole("button", { name: "Kiểm tra" }).click();
      // The next-step button only exists after a correct answer.
      await page
        .getByRole("button", {
          name: last ? "Hoàn thành bài học" : "Câu tiếp theo",
        })
        .click();
    }

    await expect(page.getByText("Xuất sắc!")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kiểm tra" })).toHaveCount(0);
    await expect(
      page.getByText(fixture.questions.at(-1)!.options[0], { exact: true }),
    ).toHaveCount(0);
    await expect.poll(() => studentProgressOf(fixture.lessonId)).toBe(1);
  });

  test("[T14] completing the last lesson of a course without exercises saves the progress and reaches the finish page", async ({
    page,
  }) => {
    const fixture = await createLearningCourseFixture(0);
    await page.goto(`/learn/${fixture.slug}/${fixture.lessonSlug}`);

    await page.getByRole("button", { name: COMPLETE }).click();

    await expect(page.getByText("Đã hoàn thành bài học!")).toBeVisible();
    // The app pushes to the finish page after a timer; the URL wait covers it without a fixed sleep.
    await page.waitForURL(`**/learn/${fixture.slug}/finish`);
    await expect(
      page.getByRole("heading", {
        name: "Chúc mừng bạn đã hoàn thành khóa học!",
      }),
    ).toBeVisible();
    expect(await studentProgressOf(fixture.lessonId)).toBe(1);
  });
});
