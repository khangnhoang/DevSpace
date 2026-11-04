import type { Locator, Page } from "@playwright/test";
import { authFile } from "./accounts";
import { recordMutations } from "./confirm-dialog";
import { expect, test } from "./fixtures";
import {
  chapterById,
  chaptersTitled,
  courseById,
  coursesNamed,
  createChapterFixture,
  createCourseFixture,
  createExerciseFixture,
  createLessonFixture,
  exerciseById,
  exercisesAsking,
  fixtureCode,
  fixtureLabel,
  lessonById,
  lessonsTitled,
  reserveChapter,
  reserveCourse,
  reserveExercise,
  reserveLesson,
} from "./service-role";

// The admin content forms of AF-U5 (course, chapter, lesson and exercise add and edit) on the admin session. Every row
// that creates through the UI reserves its exact name, title or question first; every edit row edits a fixture. No row
// uploads a course image or calls the AI action (the AI handlers are covered by the unit tests of ai-exercises).
test.use({ storageState: authFile("admin") });

// Two submit events in the same task, before React renders: only an in-flight flag set before the first await
// (a ref, not state) lets exactly one through. This is what a repeated Enter in a form with a submit button does.
const submitTwice = (control: Locator) =>
  control.evaluate((element) => {
    const form = (element as HTMLInputElement).form;
    if (!form) throw new Error("the control is not in a form");
    form.requestSubmit();
    form.requestSubmit();
  });

const HTML_COURSE = "Làm quen với HTML";

test.describe("course form", () => {
  const dialogTitle = (page: Page, edit = false) =>
    page.getByRole("heading", {
      name: edit ? "Chỉnh sửa khóa học" : "Thêm khóa học mới",
    });

  async function openAdd(page: Page) {
    await page.goto("/admin/courses");
    // The page source spells this label with combining accents, so it is found by position, not by name (as in A9).
    await page.getByRole("main").getByRole("button").first().click();
    await expect(dialogTitle(page)).toBeVisible();
  }

  // The edit control is an icon with no button role, so it is found inside the card that shows the course image.
  async function openEdit(page: Page, name: string) {
    const card = page
      .locator("div")
      .filter({ has: page.getByRole("img", { name }) })
      .filter({ has: page.locator("svg.lucide-square-pen") })
      .last();
    await card.locator("svg.lucide-square-pen").click();
    await expect(dialogTitle(page, true)).toBeVisible();
  }

  test("[C1] adds a course with a name, a slug and a price and no description or instructor", async ({
    page,
  }) => {
    const name = fixtureLabel("E2E khóa học thêm");
    const slug = fixtureCode("e2e-add");
    await reserveCourse(name);
    await openAdd(page);

    await page.getByLabel("Tên khóa học").fill(`  ${name}  `);
    await page.getByLabel("Slug (URL)").fill(` ${slug} `);
    await page.getByLabel("Giá khóa học (VND)").fill("199000");
    await page.getByRole("button", { name: "Thêm mới" }).click();

    await expect(page.getByText("Thêm khóa học thành công")).toBeVisible();
    await expect(dialogTitle(page)).toBeHidden();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    expect(await coursesNamed(name)).toMatchObject([
      { name, slug, description: null, price: 199000, instructor_id: null },
    ]);
  });

  test("[C3] edits a course whose price is 0, shows the 0 and saves it back unchanged", async ({
    page,
  }) => {
    const course = await createCourseFixture();
    const edited = fixtureLabel("E2E khóa học sửa");
    await reserveCourse(edited);
    await page.goto("/admin/courses");
    await openEdit(page, course.label);
    await expect(page.getByLabel("Tên khóa học")).toHaveValue(course.label);
    await expect(page.getByLabel("Giá khóa học (VND)")).toHaveValue("0");
    await expect(page.getByLabel("Mô tả ngắn")).toHaveValue("E2E fixture");

    await page.getByLabel("Tên khóa học").fill(`  ${edited}  `);
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(page.getByText("Cập nhật thành công")).toBeVisible();
    await expect(dialogTitle(page, true)).toBeHidden();
    expect(await courseById(course.id)).toMatchObject({
      name: edited,
      price: 0,
      description: "E2E fixture",
      instructor_id: null,
    });
    // The slug of the fixture is kept as it was, whatever it is.
    expect((await courseById(course.id)).slug).toMatch(/^e2e-course-/);

    await expect(page.getByText(edited, { exact: true })).toBeVisible();
    await openEdit(page, edited);
    await page.getByLabel("Giá khóa học (VND)").fill("250000");
    await page.getByLabel("Mô tả ngắn").fill("   ");
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(dialogTitle(page, true)).toBeHidden();
    await expect
      .poll(async () => (await courseById(course.id)).price)
      .toBe(250000);
    expect(
      (await courseById(course.id)).description,
      "a blank description is stored as null",
    ).toBeNull();
  });

  test("[C4] a failed save keeps the dialog open with what was typed, toasts the failure and lets the retry save one row", async ({
    page,
  }) => {
    const name = fixtureLabel("E2E khóa học lỗi mạng");
    await reserveCourse(name);
    await openAdd(page);
    // The aborted request never reaches the server, so the failed save writes nothing.
    let blocking = true;
    let aborted = 0;
    await page.route("**/rest/v1/courses*", (route) => {
      if (!blocking || route.request().method() !== "POST")
        return route.fallback();
      aborted += 1;
      return route.abort("failed");
    });

    await page.getByLabel("Tên khóa học").fill(name);
    await page.getByLabel("Slug (URL)").fill(fixtureCode("e2e-fail"));
    await page.getByRole("button", { name: "Thêm mới" }).click();

    await expect(page.getByText("Lỗi cập nhật:")).toBeVisible();
    await expect(dialogTitle(page)).toBeVisible();
    await expect(page.getByLabel("Tên khóa học")).toHaveValue(name);
    await expect(page.getByRole("button", { name: "Thêm mới" })).toBeEnabled();
    expect(aborted).toBe(1);
    expect(await coursesNamed(name)).toEqual([]);

    blocking = false;
    await page.getByRole("button", { name: "Thêm mới" }).click();
    await expect(page.getByText("Thêm khóa học thành công")).toBeVisible();
    await expect(dialogTitle(page)).toBeHidden();
    expect(await coursesNamed(name)).toHaveLength(1);
  });

  test("[C5] the close button is a named 40px control that closes the dialog, and at 375px the title bar sticks flush to the top while the form scrolls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openAdd(page);
    const close = page.getByRole("button", { name: "Đóng", exact: true });
    const box = await close.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(40);
    expect(box?.height).toBeGreaterThanOrEqual(40);

    const form = page.locator("form").filter({ has: dialogTitle(page) });
    await form.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const formTop = (await form.boundingBox())!.y;
    const titleTop = (await dialogTitle(page).boundingBox())!.y;
    // The form's own border is 1px; nothing of the fields may show above the title bar.
    expect(titleTop - formTop).toBeLessThan(40);
    const above = await form.evaluate((element) => {
      const header = element.firstElementChild as HTMLElement;
      return (
        header.getBoundingClientRect().top - element.getBoundingClientRect().top
      );
    });
    expect(above).toBeLessThanOrEqual(1);

    await close.click();
    await expect(dialogTitle(page)).toBeHidden();
  });

  test("[D1] a repeated Enter or a repeated submit event adds one course", async ({
    page,
  }) => {
    const byEnter = fixtureLabel("E2E khóa học Enter");
    const bySubmit = fixtureLabel("E2E khóa học submit");
    await reserveCourse(byEnter);
    await reserveCourse(bySubmit);
    const mutations = recordMutations(page);
    const writes = () =>
      mutations.filter(
        (request) =>
          request.startsWith("POST ") && request.includes("/rest/v1/courses"),
      );

    await openAdd(page);
    await page.getByLabel("Slug (URL)").fill(fixtureCode("e2e-enter"));
    await page.getByLabel("Tên khóa học").fill(byEnter);
    await Promise.all([
      page.getByLabel("Tên khóa học").press("Enter"),
      page.getByLabel("Tên khóa học").press("Enter"),
    ]);
    await expect(page.getByText("Thêm khóa học thành công")).toBeVisible();
    await expect(dialogTitle(page)).toBeHidden();
    expect(
      await coursesNamed(byEnter),
      "a repeated Enter writes one row",
    ).toHaveLength(1);
    expect(writes()).toHaveLength(1);

    await page.getByRole("main").getByRole("button").first().click();
    await page.getByLabel("Slug (URL)").fill(fixtureCode("e2e-submit"));
    await page.getByLabel("Tên khóa học").fill(bySubmit);
    await submitTwice(page.getByLabel("Tên khóa học"));
    await expect(dialogTitle(page)).toBeHidden();
    expect(
      await coursesNamed(bySubmit),
      "a repeated submit event writes one row",
    ).toHaveLength(1);
    expect(writes()).toHaveLength(2);
  });
});

test.describe("chapter form", () => {
  async function openChapters(page: Page) {
    await page.goto("/admin/chapters");
    await page
      .getByRole("combobox")
      .first()
      .selectOption({ label: HTML_COURSE });
  }

  const dialogTitle = (page: Page, edit = false) =>
    page.getByRole("heading", {
      name: edit ? "Chỉnh Sửa Chương" : "Thêm Chương Mới",
    });

  async function openAdd(page: Page) {
    await openChapters(page);
    await page.getByRole("button", { name: "Thêm chương mới" }).click();
    await expect(dialogTitle(page)).toBeVisible();
    await expect(page.getByLabel("Thuộc khóa học")).toHaveValue("1");
  }

  test("[H1] adds a chapter with a title, an order and the chosen course", async ({
    page,
  }) => {
    const title = fixtureLabel("E2E chương thêm");
    await reserveChapter(title);
    await openAdd(page);

    await page.getByLabel("Tên chương").fill(`  ${title}  `);
    await page.getByLabel("Thứ tự hiển thị").fill("7");
    await page.getByRole("button", { name: "Thêm Mới" }).click();

    await expect(page.getByText("Thêm chương thành công!")).toBeVisible();
    await expect(dialogTitle(page)).toBeHidden();
    await expect(
      page.getByRole("row").filter({ hasText: title }),
    ).toBeVisible();
    expect(await chaptersTitled(title)).toMatchObject([
      { course_id: 1, order_index: 7 },
    ]);
  });

  test("[H2] a blank order and no course show field errors and write nothing", async ({
    page,
  }) => {
    const title = fixtureLabel("E2E chương lỗi");
    await reserveChapter(title);
    await openAdd(page);
    const mutations = recordMutations(page);

    await page.getByLabel("Tên chương").fill(title);
    await page
      .getByLabel("Thuộc khóa học")
      .selectOption({ label: "-- Chọn khóa học --" });
    await page.getByRole("button", { name: "Thêm Mới" }).click();

    await expect(
      page.getByText("Vui lòng nhập thứ tự là một số nguyên"),
    ).toBeVisible();
    await expect(page.getByText("Vui lòng chọn khóa học")).toBeVisible();
    await expect(page.getByText("Vui lòng nhập tên chương")).toHaveCount(0);
    await expect(page.getByLabel("Thứ tự hiển thị")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    await page.getByLabel("Thứ tự hiển thị").fill("1.5");
    await expect(
      page.getByText("Vui lòng nhập thứ tự là một số nguyên"),
    ).toBeVisible();
    await page.getByLabel("Tên chương").fill("   ");
    await page.getByRole("button", { name: "Thêm Mới" }).click();
    await expect(page.getByText("Vui lòng nhập tên chương")).toBeVisible();
    expect(await chaptersTitled(title)).toEqual([]);
    expect(mutations, "nothing was sent").toEqual([]);
  });

  test("[H3] edits a chapter, saves an order of 0 and shows the 0 when it is edited again", async ({
    page,
  }) => {
    const chapter = await createChapterFixture();
    const edited = fixtureLabel("E2E chương sửa");
    await reserveChapter(edited);
    await openChapters(page);
    const row = (label: string) =>
      page.getByRole("row").filter({ hasText: label });

    await row(chapter.label).getByRole("button").first().click();
    await expect(dialogTitle(page, true)).toBeVisible();
    await expect(page.getByLabel("Tên chương")).toHaveValue(chapter.label);
    await expect(page.getByLabel("Thứ tự hiển thị")).toHaveValue("99");
    await page.getByLabel("Tên chương").fill(`  ${edited}  `);
    await page.getByLabel("Thứ tự hiển thị").fill("0");
    await page.getByRole("button", { name: "Lưu Thay Đổi" }).click();
    await expect(page.getByText("Cập nhật chương thành công!")).toBeVisible();
    await expect(dialogTitle(page, true)).toBeHidden();
    expect(await chapterById(chapter.id)).toMatchObject({
      title: edited,
      order_index: 0,
      course_id: 1,
    });

    // The order 0 used to show as a blank input; it now shows and is saved back unchanged.
    await row(edited).getByRole("button").first().click();
    await expect(page.getByLabel("Thứ tự hiển thị")).toHaveValue("0");
    await page.getByRole("button", { name: "Lưu Thay Đổi" }).click();
    await expect(dialogTitle(page, true)).toBeHidden();
    expect(await chapterById(chapter.id)).toMatchObject({
      title: edited,
      order_index: 0,
    });
  });

  test("[H4] a failed save keeps the dialog open with what was typed, toasts the failure and lets the retry save one row", async ({
    page,
  }) => {
    const title = fixtureLabel("E2E chương lỗi mạng");
    await reserveChapter(title);
    await openAdd(page);
    // The aborted request never reaches the server, so the failed save writes nothing.
    let blocking = true;
    let aborted = 0;
    await page.route("**/rest/v1/chapters*", (route) => {
      if (!blocking || route.request().method() !== "POST")
        return route.fallback();
      aborted += 1;
      return route.abort("failed");
    });

    await page.getByLabel("Tên chương").fill(title);
    await page.getByLabel("Thứ tự hiển thị").fill("5");
    await page.getByRole("button", { name: "Thêm Mới" }).click();

    await expect(page.getByText("Đã có lỗi xảy ra:")).toBeVisible();
    await expect(dialogTitle(page)).toBeVisible();
    await expect(page.getByLabel("Tên chương")).toHaveValue(title);
    await expect(page.getByLabel("Thứ tự hiển thị")).toHaveValue("5");
    await expect(page.getByRole("button", { name: "Thêm Mới" })).toBeEnabled();
    expect(aborted).toBe(1);
    expect(await chaptersTitled(title)).toEqual([]);

    blocking = false;
    await page.getByRole("button", { name: "Thêm Mới" }).click();
    await expect(page.getByText("Thêm chương thành công!")).toBeVisible();
    await expect(dialogTitle(page)).toBeHidden();
    expect(await chaptersTitled(title)).toHaveLength(1);
  });

  test("[H5] the close button is a named 40px control that closes the dialog", async ({
    page,
  }) => {
    await openAdd(page);
    const close = page.getByRole("button", { name: "Đóng", exact: true });
    const box = await close.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(40);
    expect(box?.height).toBeGreaterThanOrEqual(40);
    await close.click();
    await expect(dialogTitle(page)).toBeHidden();
  });

  test("[D1] a repeated Enter or a repeated submit event adds one chapter", async ({
    page,
  }) => {
    const byEnter = fixtureLabel("E2E chương Enter");
    const bySubmit = fixtureLabel("E2E chương submit");
    await reserveChapter(byEnter);
    await reserveChapter(bySubmit);
    const mutations = recordMutations(page);
    const writes = () =>
      mutations.filter(
        (request) =>
          request.startsWith("POST ") && request.includes("/rest/v1/chapters"),
      );

    await openAdd(page);
    await page.getByLabel("Thứ tự hiển thị").fill("11");
    await page.getByLabel("Tên chương").fill(byEnter);
    await Promise.all([
      page.getByLabel("Tên chương").press("Enter"),
      page.getByLabel("Tên chương").press("Enter"),
    ]);
    await expect(page.getByText("Thêm chương thành công!")).toBeVisible();
    await expect(dialogTitle(page)).toBeHidden();
    expect(
      await chaptersTitled(byEnter),
      "a repeated Enter writes one row",
    ).toHaveLength(1);
    expect(writes()).toHaveLength(1);

    await page.getByRole("button", { name: "Thêm chương mới" }).click();
    await page.getByLabel("Thứ tự hiển thị").fill("12");
    await page.getByLabel("Tên chương").fill(bySubmit);
    await submitTwice(page.getByLabel("Tên chương"));
    await expect(dialogTitle(page)).toBeHidden();
    expect(
      await chaptersTitled(bySubmit),
      "a repeated submit event writes one row",
    ).toHaveLength(1);
    expect(writes()).toHaveLength(2);
  });
});

test.describe("lesson form", () => {
  const saveButton = (page: Page) => page.locator('button[form="lesson-form"]');
  const form = (page: Page) => page.locator("#lesson-form");

  async function openAdd(page: Page) {
    await page.goto("/admin/lessons");
    // The page source spells this label with combining accents, so it is found by position, not by name (as in A9).
    await page.getByRole("main").getByRole("button").first().click();
    await expect(form(page)).toBeVisible();
  }

  async function openEdit(page: Page, title: string) {
    await page.goto("/admin/lessons");
    await page
      .getByRole("row")
      .filter({ hasText: title })
      .getByRole("button")
      .first()
      .click();
    await expect(form(page)).toBeVisible();
  }

  // Picks the course, waits for its chapters, picks the first one and returns its id.
  async function chooseCourseAndChapter(page: Page) {
    await page
      .getByLabel("Khóa học", { exact: true })
      .selectOption({ label: HTML_COURSE });
    const chapter = page.getByLabel("Chương", { exact: true });
    await expect(chapter.locator("option")).not.toHaveCount(1);
    await chapter.selectOption({ index: 1 });
    return Number(await chapter.inputValue());
  }

  test("[L1] adds a lesson with a video and an order left blank, saved as null", async ({
    page,
  }) => {
    const title = fixtureLabel("E2E bài học thêm");
    const slug = fixtureCode("e2e-lesson-add");
    await reserveLesson(title);
    await openAdd(page);

    await page.getByLabel("Tên bài", { exact: true }).fill(`  ${title}  `);
    await page.getByLabel("Đường dẫn", { exact: true }).fill(` ${slug} `);
    const chapterId = await chooseCourseAndChapter(page);
    await saveButton(page).click();

    await expect(page.getByText("Lưu bài học thành công!")).toBeVisible();
    await expect(form(page)).toBeHidden();
    await expect(
      page.getByRole("row").filter({ hasText: title }),
    ).toBeVisible();
    expect(await lessonsTitled(title)).toMatchObject([
      {
        slug,
        course_id: 1,
        chapter_id: chapterId,
        video_url: null,
        order_index: null,
      },
    ]);
  });

  test("[L2] no course, no chapter, a blank slug and an order that is not a whole number show field errors and write nothing", async ({
    page,
  }) => {
    const title = fixtureLabel("E2E bài học lỗi");
    await reserveLesson(title);
    await openAdd(page);
    const mutations = recordMutations(page);

    await page.getByLabel("Tên bài", { exact: true }).fill(title);
    await page.getByLabel("Số thứ tự", { exact: true }).fill("1.5");
    await saveButton(page).click();
    await expect(page.getByText("Vui lòng nhập đường dẫn")).toBeVisible();
    await expect(page.getByText("Vui lòng chọn khóa học")).toBeVisible();
    await expect(page.getByText("Vui lòng chọn chương")).toBeVisible();
    await expect(
      page.getByText("Số thứ tự phải là một số nguyên"),
    ).toBeVisible();
    await expect(page.getByText("Vui lòng nhập tên bài")).toHaveCount(0);
    await expect(page.getByLabel("Đường dẫn", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    // A course without a chapter is still refused.
    await page
      .getByLabel("Khóa học", { exact: true })
      .selectOption({ label: HTML_COURSE });
    await page.getByLabel("Số thứ tự", { exact: true }).fill("");
    await page
      .getByLabel("Đường dẫn", { exact: true })
      .fill(fixtureCode("e2e-lesson-err"));
    await saveButton(page).click();
    await expect(page.getByText("Vui lòng chọn chương")).toBeVisible();
    await expect(page.getByText("Vui lòng chọn khóa học")).toHaveCount(0);
    expect(await lessonsTitled(title)).toEqual([]);
    expect(mutations, "nothing was sent").toEqual([]);
  });

  test("[L3] edits a lesson whose order is null, shows the fields blank and saves them back as null", async ({
    page,
  }) => {
    const lesson = await createLessonFixture({ orderIndex: null });
    const edited = fixtureLabel("E2E bài học sửa");
    await reserveLesson(edited);
    await openEdit(page, lesson.label);
    await expect(page.getByLabel("Tên bài", { exact: true })).toHaveValue(
      lesson.label,
    );
    await expect(page.getByLabel("Số thứ tự", { exact: true })).toHaveValue("");
    await expect(
      page.getByLabel("Đường dẫn video", { exact: true }),
    ).toHaveValue("");
    // The chapters load after the form opens: the stored chapter is selected once its options exist.
    await expect(page.getByLabel("Chương", { exact: true })).toHaveValue("1");

    await page.getByLabel("Tên bài", { exact: true }).fill(`  ${edited}  `);
    await saveButton(page).click();
    await expect(page.getByText("Cập nhật thành công")).toBeVisible();
    await expect(form(page)).toBeHidden();
    expect(await lessonById(lesson.id)).toMatchObject({
      title: edited,
      slug: lesson.slug,
      course_id: 1,
      chapter_id: 1,
      video_url: null,
      order_index: null,
    });
    expect((await lessonById(lesson.id)).content?.trim()).toBe("E2E fixture");

    // An order of 0 is a number the form shows and saves.
    await openEdit(page, edited);
    await page.getByLabel("Số thứ tự", { exact: true }).fill("0");
    await saveButton(page).click();
    await expect(form(page)).toBeHidden();
    await expect
      .poll(async () => (await lessonById(lesson.id)).order_index)
      .toBe(0);
    await openEdit(page, edited);
    await expect(page.getByLabel("Số thứ tự", { exact: true })).toHaveValue(
      "0",
    );
  });

  test("[L4] a failed save keeps the form open with what was typed, toasts the failure and lets the retry save one row", async ({
    page,
  }) => {
    const title = fixtureLabel("E2E bài học lỗi mạng");
    await reserveLesson(title);
    await openAdd(page);
    // The aborted request never reaches the server, so the failed save writes nothing.
    let blocking = true;
    let aborted = 0;
    await page.route("**/rest/v1/lessons*", (route) => {
      if (!blocking || route.request().method() !== "POST")
        return route.fallback();
      aborted += 1;
      return route.abort("failed");
    });

    await page.getByLabel("Tên bài", { exact: true }).fill(title);
    await page
      .getByLabel("Đường dẫn", { exact: true })
      .fill(fixtureCode("e2e-lesson-fail"));
    await chooseCourseAndChapter(page);
    await saveButton(page).click();

    await expect(page.getByText("Lưu bài học thất bại:")).toBeVisible();
    await expect(form(page)).toBeVisible();
    await expect(page.getByLabel("Tên bài", { exact: true })).toHaveValue(
      title,
    );
    await expect(saveButton(page)).toBeEnabled();
    expect(aborted).toBe(1);
    expect(await lessonsTitled(title)).toEqual([]);

    blocking = false;
    await saveButton(page).click();
    await expect(page.getByText("Lưu bài học thành công!")).toBeVisible();
    await expect(form(page)).toBeHidden();
    expect(await lessonsTitled(title)).toHaveLength(1);
  });

  test("[D1] a repeated submit event adds one lesson", async ({ page }) => {
    const title = fixtureLabel("E2E bài học submit");
    await reserveLesson(title);
    const mutations = recordMutations(page);
    await openAdd(page);
    await page.getByLabel("Tên bài", { exact: true }).fill(title);
    await page
      .getByLabel("Đường dẫn", { exact: true })
      .fill(fixtureCode("e2e-lesson-twice"));
    await chooseCourseAndChapter(page);
    await submitTwice(page.getByLabel("Tên bài", { exact: true }));
    await expect(form(page)).toBeHidden();
    expect(await lessonsTitled(title)).toHaveLength(1);
    expect(
      mutations.filter(
        (request) =>
          request.startsWith("POST ") && request.includes("/rest/v1/lessons"),
      ),
    ).toHaveLength(1);
  });
});

test.describe("exercise form", () => {
  const add = (page: Page) =>
    page.getByRole("button", { name: "Thêm câu hỏi", exact: true });
  const update = (page: Page) =>
    page.getByRole("button", { name: "Cập nhật câu hỏi", exact: true });

  async function openExercises(page: Page, lessonTitle: string) {
    await page.goto("/admin/lessons");
    await page
      .getByRole("row")
      .filter({ hasText: lessonTitle })
      .getByRole("button")
      .first()
      .click();
    await page.getByRole("button", { name: "Trắc nghiệm" }).click();
    await expect(add(page)).toBeVisible();
  }

  async function fillQuestion(page: Page, question: string, answer = "b") {
    await page.getByLabel("Nội dung câu hỏi", { exact: true }).fill(question);
    for (const letter of ["A", "B", "C", "D"]) {
      await page
        .getByLabel(`Đáp án ${letter}`, { exact: true })
        .fill(`Lựa chọn ${letter}`);
    }
    await page.getByLabel("Đáp án đúng", { exact: true }).selectOption(answer);
  }

  test("[E1] adds a question with no explanation, saved as null, and lists it", async ({
    page,
  }) => {
    const lesson = await createLessonFixture();
    const question = fixtureLabel("E2E câu hỏi thêm");
    await reserveExercise(question);
    await openExercises(page, lesson.label);

    await fillQuestion(page, `  ${question}  `);
    await add(page).click();

    await expect(
      page.getByText("Thêm thành công", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(`: ${question}`)).toBeVisible();
    expect(await exercisesAsking(question)).toMatchObject([
      {
        lesson_id: lesson.id,
        option_a: "Lựa chọn A",
        option_d: "Lựa chọn D",
        correct_answer: "b",
        explanation: null,
      },
    ]);
  });

  test("[E2] a blank question, a blank option and no correct answer show field errors and write nothing", async ({
    page,
  }) => {
    const lesson = await createLessonFixture();
    const question = fixtureLabel("E2E câu hỏi lỗi");
    await reserveExercise(question);
    await openExercises(page, lesson.label);
    const mutations = recordMutations(page);

    await page.getByLabel("Đáp án A", { exact: true }).fill("Lựa chọn A");
    await add(page).click();
    await expect(
      page.getByText("Vui lòng nhập nội dung câu hỏi"),
    ).toBeVisible();
    await expect(page.getByText("Vui lòng nhập đáp án B")).toBeVisible();
    await expect(page.getByText("Vui lòng nhập đáp án C")).toBeVisible();
    await expect(page.getByText("Vui lòng nhập đáp án D")).toBeVisible();
    await expect(page.getByText("Vui lòng chọn đáp án đúng")).toBeVisible();
    await expect(page.getByText("Vui lòng nhập đáp án A")).toHaveCount(0);

    await fillQuestion(page, question, "");
    await add(page).click();
    await expect(page.getByText("Vui lòng chọn đáp án đúng")).toBeVisible();
    await expect(page.getByText("Vui lòng nhập nội dung câu hỏi")).toHaveCount(
      0,
    );
    expect(await exercisesAsking(question)).toEqual([]);
    expect(mutations, "nothing was sent").toEqual([]);
  });

  test("[E3] edits a question, clears its explanation and saves it back as null", async ({
    page,
  }) => {
    const lesson = await createLessonFixture();
    const exercise = await createExerciseFixture(lesson.id);
    const edited = fixtureLabel("E2E câu hỏi sửa");
    await reserveExercise(edited);
    await openExercises(page, lesson.label);

    await page
      .locator("h1")
      .filter({ hasText: exercise.label })
      .getByRole("button")
      .first()
      .click();
    await expect(
      page.getByLabel("Nội dung câu hỏi", { exact: true }),
    ).toHaveValue(exercise.label);
    await expect(page.getByLabel("Giải thích", { exact: true })).toHaveValue(
      "E2E fixture",
    );
    await expect(page.getByLabel("Đáp án đúng", { exact: true })).toHaveValue(
      "a",
    );

    await page
      .getByLabel("Nội dung câu hỏi", { exact: true })
      .fill(`  ${edited}  `);
    await page.getByLabel("Giải thích", { exact: true }).fill("   ");
    await update(page).click();

    await expect(page.getByText("Cập nhật thành công")).toBeVisible();
    await expect(page.getByText(`: ${edited}`)).toBeVisible();
    expect(await exerciseById(exercise.id)).toMatchObject({
      lesson_id: lesson.id,
      question: edited,
      correct_answer: "a",
      explanation: null,
    });
  });

  test("[E4] a failed save keeps what was typed, toasts the failure and lets the retry save one row", async ({
    page,
  }) => {
    const lesson = await createLessonFixture();
    const question = fixtureLabel("E2E câu hỏi lỗi mạng");
    await reserveExercise(question);
    await openExercises(page, lesson.label);
    // The aborted request never reaches the server, so the failed save writes nothing.
    let blocking = true;
    let aborted = 0;
    await page.route("**/rest/v1/exercises*", (route) => {
      if (!blocking || route.request().method() !== "POST")
        return route.fallback();
      aborted += 1;
      return route.abort("failed");
    });

    await fillQuestion(page, question);
    await add(page).click();

    await expect(page.getByText("Đã có lỗi xảy ra:")).toBeVisible();
    await expect(
      page.getByLabel("Nội dung câu hỏi", { exact: true }),
    ).toHaveValue(question);
    await expect(add(page)).toBeEnabled();
    expect(aborted).toBe(1);
    expect(await exercisesAsking(question)).toEqual([]);

    blocking = false;
    await add(page).click();
    await expect(
      page.getByText("Thêm thành công", { exact: true }),
    ).toBeVisible();
    expect(await exercisesAsking(question)).toHaveLength(1);
  });

  test("[E5] a question being edited does not outlive the lesson panel: reopening starts the Thông tin tab and a blank add form", async ({
    page,
  }) => {
    const lesson = await createLessonFixture();
    const exercise = await createExerciseFixture(lesson.id);
    await openExercises(page, lesson.label);
    const mutations = recordMutations(page);
    const close = page.getByRole("button", { name: "Đóng", exact: true });
    const question = page.getByLabel("Nội dung câu hỏi", { exact: true });

    await page
      .locator("h1")
      .filter({ hasText: exercise.label })
      .getByRole("button")
      .first()
      .click();
    await expect(question).toHaveValue(exercise.label);
    await expect(update(page)).toBeVisible();

    // The lesson panel's close is a named 40px button, not a bare icon.
    const box = await close.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(40);
    expect(box?.height).toBeGreaterThanOrEqual(40);
    await close.click();
    await expect(page.locator("#lesson-form")).toBeHidden();

    // The same lesson again, then the add form: both open on the first tab with the exercise form blank in add mode.
    const reopenFrom = [
      () =>
        page
          .getByRole("row")
          .filter({ hasText: lesson.label })
          .getByRole("button")
          .first()
          .click(),
      // The page source spells this label with combining accents, so it is found by position (as in A9).
      () => page.getByRole("main").getByRole("button").first().click(),
    ];
    for (const open of reopenFrom) {
      await open();
      await expect(page.locator("#lesson-form")).toBeVisible();
      await page.getByRole("button", { name: "Trắc nghiệm" }).click();
      await expect(question).toHaveValue("");
      await expect(add(page)).toBeVisible();
      await expect(update(page)).toHaveCount(0);
      await close.click();
      await expect(page.locator("#lesson-form")).toBeHidden();
    }
    expect(mutations, "nothing was sent").toEqual([]);
  });

  // The action's answer is faked in the browser, because the e2e server has a placeholder key and its guard refuses the
  // call to Gemini; the row proves the page wiring around the answer, which the unit tests of ai-exercises cannot reach.
  test("[E6] filling the form with an AI question while a question is being edited switches the form to add mode and writes nothing", async ({
    page,
  }) => {
    const lesson = await createLessonFixture();
    const exercise = await createExerciseFixture(lesson.id);
    await openExercises(page, lesson.label);
    const aiQuestion = fixtureLabel("E2E câu hỏi AI");
    let asked = 0;
    await page.route("**/admin/lessons", async (route) => {
      const request = route.request();
      if (request.method() !== "POST" || !request.headers()["next-action"])
        return route.fallback();
      asked += 1;
      const data = [
        {
          question: aiQuestion,
          option_a: "AI A",
          option_b: "AI B",
          option_c: "AI C",
          option_d: "AI D",
          correct_answer: "C",
          explanation: "AI giải thích",
        },
      ];
      return route.fulfill({
        status: 200,
        contentType: "text/x-component",
        body: `0:{"a":"$@1","f":"","q":"","i":false}\n1:${JSON.stringify({ data })}\n`,
      });
    });
    const mutations = recordMutations(page);

    await page
      .locator("h1")
      .filter({ hasText: exercise.label })
      .getByRole("button")
      .first()
      .click();
    await expect(update(page)).toBeVisible();

    await page.getByRole("button", { name: /AI Magic/ }).click();
    await page.getByRole("button", { name: /Điền vào form/ }).click();

    await expect(
      page.getByLabel("Nội dung câu hỏi", { exact: true }),
    ).toHaveValue(aiQuestion);
    await expect(page.getByLabel("Đáp án đúng", { exact: true })).toHaveValue(
      "c",
    );
    await expect(add(page)).toBeVisible();
    await expect(update(page)).toHaveCount(0);
    expect(asked).toBe(1);
    expect(
      mutations.filter((request) => !request.endsWith("/admin/lessons")),
      "nothing was written",
    ).toEqual([]);
  });

  test("[D1] a repeated submit event adds one question", async ({ page }) => {
    const lesson = await createLessonFixture();
    const question = fixtureLabel("E2E câu hỏi submit");
    await reserveExercise(question);
    await openExercises(page, lesson.label);
    const mutations = recordMutations(page);

    await fillQuestion(page, question);
    await submitTwice(page.getByLabel("Nội dung câu hỏi", { exact: true }));
    await expect(page.getByText(`: ${question}`)).toBeVisible();
    expect(await exercisesAsking(question)).toHaveLength(1);
    expect(
      mutations.filter(
        (request) =>
          request.startsWith("POST ") && request.includes("/rest/v1/exercises"),
      ),
    ).toHaveLength(1);
  });
});
