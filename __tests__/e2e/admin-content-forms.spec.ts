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
  fixtureCode,
  fixtureLabel,
  reserveChapter,
  reserveCourse,
} from "./service-role";

// The admin content forms of AF-U5 (course, chapter, lesson and exercise add and edit) on the admin session. Every row
// that creates through the UI reserves its exact name, title or question first; every edit row edits a fixture. No row
// uploads a course image or calls the AI action.
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

  test("[C2] a blank slug, a price that is not a whole number and a blank name show field errors and write nothing", async ({
    page,
  }) => {
    const name = fixtureLabel("E2E khóa học lỗi");
    await reserveCourse(name);
    await openAdd(page);
    const mutations = recordMutations(page);

    await page.getByLabel("Tên khóa học").fill(name);
    await page.getByLabel("Giá khóa học (VND)").fill("1.5");
    await page.getByRole("button", { name: "Thêm mới" }).click();
    await expect(page.getByText("Vui lòng nhập slug")).toBeVisible();
    await expect(
      page.getByText("Giá phải là số nguyên từ 0 trở lên"),
    ).toBeVisible();
    await expect(page.getByText("Vui lòng nhập tên khóa học")).toHaveCount(0);
    await expect(page.getByLabel("Slug (URL)")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    await page.getByLabel("Giá khóa học (VND)").fill("-5");
    await page.getByLabel("Tên khóa học").fill("   ");
    await page.getByRole("button", { name: "Thêm mới" }).click();
    await expect(page.getByText("Vui lòng nhập tên khóa học")).toBeVisible();
    await expect(
      page.getByText("Giá phải là số nguyên từ 0 trở lên"),
    ).toBeVisible();

    // A blank price is accepted and saved as 0, as the form always did: only the errors of the other fields remain.
    await page.getByLabel("Giá khóa học (VND)").fill("");
    await expect(
      page.getByText("Giá phải là số nguyên từ 0 trở lên"),
    ).toHaveCount(0);
    expect(await coursesNamed(name)).toEqual([]);
    expect(mutations, "nothing was sent").toEqual([]);
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
