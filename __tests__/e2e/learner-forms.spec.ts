import type { Locator, Page } from "@playwright/test";
import { IDS, authFile } from "./accounts";
import { recordMutations } from "./confirm-dialog";
import { expect, test } from "./fixtures";
import {
  acquireStudentProfile,
  avatarObjectNames,
  commentContent,
  createCommentFixture,
  fixtureLabel,
  profileEmailOf,
  removeAvatarObject,
  reserveStudentComment,
  reserveStudentNote,
  reserveStudentReview,
  studentCommentsWith,
  studentNoteCount,
  studentNotesWith,
  studentProfile,
  studentReviews,
} from "./service-role";

// The learner forms of AF-U3 (profile edit, course review, lesson comments, lesson notes) on the student session. The
// student is enrolled in the paid course 2 and has no date of birth in the seed (AF-P4).
test.use({ storageState: authFile("student") });

const PROFILE_NAME = "E2E Học viên mới";
// A 16x16 PNG, so the avatar input has a real image file that the image optimizer can re-encode; only [F12] uploads it.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAABw0lEQVR4nAXBoRJFQAAAwPclsizL8kWzSRAkI140kiBIRrxoJEEQRZ/1dn+ZL/cVvtJX+YKPr/X1vuibfItv8yXf6bt9v8ybewtv6a28wcvbentv9E7exbt5k/f03t5f5sk9haf0VJ7g4Wk9vSd6Js/i2TzJc3puzy9z5a7CVboqV3Bxta7eFV2Ta3FtruQ6XbfrlzlyR+EoHZUjODhaR++IjsmxODZHcpyO2/HLpFwqpFKqpCCRWqmXojRJi7RJSTqlW/pl9txe2Et7ZQ929tbe26N9si/2zZ7sp/22/zJrbi2spbWyBitra+2t0TpZF+tmTdbTelt/mTk3F+bSXJmDmbk19+ZonsyLeTMn82m+zb/MmBsLY2msjMHI2Bp7YzROxsW4GZPxNN7GXybmYiGWYiUGkdiKvRjFSVzETUziKd7iLzPkhsJQGipDMDC0ht4QDZNhMWyGZDgNt+GX6XJdoSt1lS7o6Fpdr4u6SbfoNl3Snbpb98s0uabQlJpKEzQ0rabXRM2kWTSbJmlOza35ZepcXahLdaUOaupW3aujelIv6k2d1Kf6Vv8yIRcKoRQqIQiEVuiFKEzCImxCEk7hFv4EYU8QaRMVsgAAAABJRU5ErkJggg==",
  "base64",
);
const AVATAR_FILE = {
  name: "avatar e2e.png",
  mimeType: "image/png",
  buffer: PNG,
};
const AVATAR_REQUEST = "**/storage/v1/object/avatars/**";

async function openProfileDialog(page: Page) {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();
  await expect(
    page.getByRole("heading", { name: "Cập nhật hồ sơ" }),
  ).toBeVisible();
}

const profileWrites = (mutations: string[]) =>
  mutations.filter(
    (request) =>
      request.startsWith("PATCH ") && request.includes("/rest/v1/profiles"),
  );

test.describe("profile form", () => {
  test("[F1] saves a profile without a date of birth, stores blank fields as null and writes once for a repeated Enter", async ({
    page,
  }) => {
    await acquireStudentProfile();
    await openProfileDialog(page);
    await expect(page.getByLabel("Ngày sinh")).toHaveValue("");

    const mutations = recordMutations(page);
    await page.getByLabel("Họ và tên").fill(PROFILE_NAME);
    await page.getByLabel("Giới tính").selectOption({ label: "Nam" });
    await page.getByLabel("Tỉnh / Thành phố").selectOption({ label: "Hà Nội" });
    // Both Enters leave in one task: a second press after the first save has closed the dialog would wait on a detached input.
    await Promise.all([
      page.getByLabel("Họ và tên").press("Enter"),
      page.getByLabel("Họ và tên").press("Enter"),
    ]);

    await expect(page.getByText("Cập nhật thành công")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cập nhật hồ sơ" }),
    ).toBeHidden();
    expect(await studentProfile()).toEqual({
      full_name: PROFILE_NAME,
      gender: "male",
      province: "Hà Nội",
      dob: null,
      avatar_url: null,
    });
    expect(
      profileWrites(mutations),
      "a repeated Enter makes one write",
    ).toHaveLength(1);

    // The page reloads the profile after the save; reopening before that would show the old values.
    await expect(
      page.getByText(PROFILE_NAME, { exact: true }).first(),
    ).toBeVisible();
    // The dialog opens with the stored values; a blank name, gender and province are stored as null, not "".
    await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();
    await expect(page.getByLabel("Họ và tên")).toHaveValue(PROFILE_NAME);
    await expect(page.getByLabel("Giới tính")).toHaveValue("male");
    await page.getByLabel("Họ và tên").fill("   ");
    await page.getByLabel("Giới tính").selectOption({ label: "-- Chọn --" });
    await page
      .getByLabel("Tỉnh / Thành phố")
      .selectOption({ label: "-- Chọn tỉnh thành --" });
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(
      page.getByRole("heading", { name: "Cập nhật hồ sơ" }),
    ).toBeHidden();
    await expect.poll(studentProfile).toEqual({
      full_name: null,
      gender: null,
      province: null,
      dob: null,
      avatar_url: null,
    });
    expect(await profileEmailOf(IDS.student)).toBe("student@devspace.test");
  });

  test("[F9] a failed avatar upload keeps the dialog open with what was typed and writes nothing", async ({
    page,
  }) => {
    await acquireStudentProfile();
    const before = await studentProfile();
    const objectsBefore = await avatarObjectNames();
    let aborted = 0;
    await page.route(AVATAR_REQUEST, (route) => {
      aborted += 1;
      return route.abort("failed");
    });
    await openProfileDialog(page);

    await page.getByLabel("Họ và tên").fill("E2E Tên không được lưu");
    await page.locator('input[type="file"]').setInputFiles(AVATAR_FILE);
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();

    await expect(
      page.getByText("Lỗi cập nhật: Lỗi upload avatar"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cập nhật hồ sơ" }),
    ).toBeVisible();
    await expect(page.getByLabel("Họ và tên")).toHaveValue(
      "E2E Tên không được lưu",
    );
    await expect(
      page.getByRole("button", { name: "Lưu thay đổi" }),
    ).toBeEnabled();
    expect(
      aborted,
      "the Storage request was attempted and aborted",
    ).toBeGreaterThan(0);
    expect(await studentProfile()).toEqual(before);
    expect(await avatarObjectNames()).toEqual(objectsBefore);
  });

  test("[F10] a chosen avatar is saved as the public URL of its uploaded file name", async ({
    page,
  }) => {
    await acquireStudentProfile();
    let fileName = "";
    let origin = "";
    // The Storage boundary is outside the form: the upload answers like Storage does, so no object is written.
    await page.route(AVATAR_REQUEST, (route) => {
      const url = new URL(route.request().url());
      origin = url.origin;
      fileName = url.pathname.split("/storage/v1/object/avatars/")[1];
      const cors = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "*",
      };
      if (route.request().method() === "OPTIONS")
        return route.fulfill({ status: 204, headers: cors });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: cors,
        body: JSON.stringify({
          Id: "00000000-0000-4000-8000-000000000000",
          Key: `avatars/${fileName}`,
        }),
      });
    });
    const objectsBefore = await avatarObjectNames();
    await openProfileDialog(page);

    await page.locator('input[type="file"]').setInputFiles(AVATAR_FILE);
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();

    await expect(page.getByText("Cập nhật thành công")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cập nhật hồ sơ" }),
    ).toBeHidden();
    expect(fileName).toMatch(
      /^33333333-3333-4333-8333-333333333333\/avatar_\d+_avatar_e2e\.png$/,
    );
    expect((await studentProfile()).avatar_url).toBe(
      `${origin}/storage/v1/object/public/avatars/${fileName}`,
    );
    expect(await avatarObjectNames()).toEqual(objectsBefore);
  });

  test("[F13] the profile card shows the gender, date of birth and province the learner saved, and nothing else", async ({
    page,
  }) => {
    await acquireStudentProfile();
    await openProfileDialog(page);
    await page.getByLabel("Giới tính").selectOption({ label: "Nữ" });
    await page.getByLabel("Ngày sinh").fill("2000-01-31");
    await page.getByLabel("Tỉnh / Thành phố").selectOption({ label: "Hà Nội" });
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(
      page.getByRole("heading", { name: "Cập nhật hồ sơ" }),
    ).toBeHidden();

    await expect(page.getByText("Giới tính:")).toBeVisible();
    await expect(page.getByText("Nữ", { exact: true })).toBeVisible();
    await expect(page.getByText("31/01/2000")).toBeVisible();
    await expect(page.getByText("Hà Nội", { exact: true })).toBeVisible();
    await expect(page.getByText("Trống")).toHaveCount(0);
    await expect(
      page.getByText("Thêm giới tính, ngày sinh và nơi ở"),
    ).toHaveCount(0);
  });

  // The one row that really uploads: the saved avatar is a local Storage URL, which next/image renders only when
  // next.config.ts lists the local Storage path (lib/image-hosts.ts) and the optimizer may fetch the local address.
  test("[F12] a really uploaded avatar renders on the profile card and the object is removed afterwards", async ({
    page,
  }) => {
    await acquireStudentProfile();
    // The name is recorded from the upload request as it leaves, before the save ends, so a failure after the upload still
    // removes exactly this object. The request itself is not touched.
    let uploaded: string | undefined;
    page.on("request", (request) => {
      const name = new URL(request.url()).pathname.split(
        "/storage/v1/object/avatars/",
      )[1];
      if (
        request.method() !== "OPTIONS" &&
        name &&
        /^33333333-3333-4333-8333-333333333333\/avatar_\d+_avatar_e2e\.png$/.test(
          name,
        )
      )
        uploaded = name;
    });
    try {
      await openProfileDialog(page);
      await page.locator('input[type="file"]').setInputFiles(AVATAR_FILE);
      await page.getByRole("button", { name: "Lưu thay đổi" }).click();
      await expect(page.getByText("Cập nhật thành công")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Cập nhật hồ sơ" }),
      ).toBeHidden();
      expect(uploaded, "the save uploaded one avatar").toBeDefined();
      expect(await avatarObjectNames()).toContain(uploaded);

      const avatars = () =>
        page.evaluate(() =>
          [...document.images]
            .filter((image) =>
              decodeURIComponent(image.src).includes("avatar_"),
            )
            .map((image) => image.complete && image.naturalWidth > 0),
        );
      await expect
        .poll(async () => {
          const loaded = await avatars();
          return loaded.length > 0 && loaded.every(Boolean);
        })
        .toBe(true);
    } finally {
      await removeAvatarObject(uploaded);
    }
  });
});

// Two submit events in the same task, before React renders: only an in-flight flag set before the first await
// (a ref, not state) lets exactly one through. This is what a repeated Enter in a form with a submit button does.
const submitTwice = (control: Locator) =>
  control.evaluate((element) => {
    const form = (element as HTMLInputElement).form;
    if (!form) throw new Error("the control is not in a form");
    form.requestSubmit();
    form.requestSubmit();
  });

test.describe("course review form", () => {
  const COURSE_URL = "/course/javascript-can-ban";
  const textbox = (page: Page) => page.getByPlaceholder("Chia sẻ cảm nhận...");

  async function openReviewForm(page: Page) {
    await page.goto(COURSE_URL);
    await expect(
      page.getByRole("heading", { name: "Viết đánh giá của bạn" }),
    ).toBeVisible();
  }

  test("[F2] submits a rating with trimmed text, writes one review row and lists it", async ({
    page,
  }) => {
    await reserveStudentReview();
    const text = fixtureLabel("E2E đánh giá");
    await openReviewForm(page);

    await page.getByRole("button", { name: "4 sao" }).click();
    await textbox(page).fill(`  ${text}  `);
    await page.getByRole("button", { name: "Gửi đánh giá" }).click();

    await expect(page.getByText("Đánh giá thành công!")).toBeVisible();
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    expect(await studentReviews()).toEqual([{ rating: 4, content: text }]);
  });

  test("[F3] blank review text shows the field error and writes nothing", async ({
    page,
  }) => {
    await reserveStudentReview();
    await openReviewForm(page);
    const mutations = recordMutations(page);

    await textbox(page).fill("   ");
    await page.getByRole("button", { name: "Gửi đánh giá" }).click();

    await expect(
      page.getByText("Vui lòng nhập nội dung đánh giá"),
    ).toBeVisible();
    await expect(textbox(page)).toHaveAttribute("aria-invalid", "true");
    expect(await studentReviews()).toEqual([]);
    expect(mutations, "nothing was sent").toEqual([]);
  });

  test("[F11] the review form keeps its dark surface in a light and a dark OS scheme", async ({
    page,
  }) => {
    await openReviewForm(page);
    // The reference is the page's own bg-gray-900, so the check follows the palette and not a pinned colour value.
    const surfaces = () =>
      textbox(page).evaluate((el) => {
        const probe = document.createElement("div");
        probe.className = "bg-gray-900";
        document.body.append(probe);
        const reference = getComputedStyle(probe).backgroundColor;
        probe.remove();
        const style = getComputedStyle(el);
        return {
          reference,
          background: style.backgroundColor,
          color: style.color,
          border: style.borderTopColor,
        };
      });

    await page.emulateMedia({ colorScheme: "light" });
    const light = await surfaces();
    await page.emulateMedia({ colorScheme: "dark" });
    const dark = await surfaces();

    expect(light.background).toBe(light.reference);
    expect(dark).toEqual(light);
    expect(light.reference).not.toBe("rgba(0, 0, 0, 0)");
  });
});

test.describe("lesson comment forms", () => {
  const LESSON_URL = "/learn/javascript-can-ban/bien-va-kieu-du-lieu";
  const input = (page: Page) => page.getByPlaceholder("Viết bình luận...");

  async function openComments(page: Page) {
    await page.goto(LESSON_URL);
    // The button has no text below the sm breakpoint, so it is found by its icon (as in T4).
    await page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-message-square-text") })
      .click();
    await expect(input(page)).toBeEnabled();
  }

  test("[F4] sends a comment, one row for a repeated Enter or a repeated submit", async ({
    page,
  }) => {
    const byEnter = fixtureLabel("E2E bình luận Enter");
    const bySubmit = fixtureLabel("E2E bình luận submit");
    await reserveStudentComment(byEnter);
    await reserveStudentComment(bySubmit);
    await openComments(page);

    await input(page).fill(`  ${byEnter}  `);
    await Promise.all([input(page).press("Enter"), input(page).press("Enter")]);
    await expect(page.getByText(byEnter, { exact: true })).toBeVisible();
    await expect.poll(() => studentCommentsWith(byEnter)).toBe(1);

    await input(page).fill(bySubmit);
    await submitTwice(input(page));
    await expect(page.getByText(bySubmit, { exact: true })).toBeVisible();
    expect(
      await studentCommentsWith(bySubmit),
      "a repeated submit writes one row",
    ).toBe(1);
    expect(await studentCommentsWith(byEnter)).toBe(1);
  });

  test("[F5] a comment under 3 or from 1000 characters shows the field error and writes nothing", async ({
    page,
  }) => {
    await openComments(page);
    const mutations = recordMutations(page);
    const long = "x".repeat(1000);

    await input(page).fill("ab");
    await input(page).press("Enter");
    await expect(page.getByText("Bình luận cần ít nhất 3 ký tự")).toBeVisible();
    await expect(input(page)).toHaveAttribute("aria-invalid", "true");

    await input(page).fill(long);
    await input(page).press("Enter");
    await expect(
      page.getByText("Bình luận chỉ được dưới 1000 ký tự"),
    ).toBeVisible();

    await input(page).fill("x".repeat(999));
    await expect(
      page.getByText("Bình luận chỉ được dưới 1000 ký tự"),
    ).toBeHidden();
    expect(await studentCommentsWith("ab")).toBe(0);
    expect(await studentCommentsWith(long)).toBe(0);
    expect(mutations, "nothing was sent").toEqual([]);
  });

  test("[F6] edits a comment with the same limits and saves the trimmed text", async ({
    page,
  }) => {
    const comment = await createCommentFixture();
    const edited = fixtureLabel("E2E bình luận đã sửa");
    await reserveStudentComment(edited);
    await openComments(page);

    const row = page.locator("div.group").filter({ hasText: comment.label });
    await row.getByRole("button").first().click();
    await row.getByRole("button", { name: "Sửa", exact: true }).click();
    const box = page.getByLabel("Sửa bình luận");
    await expect(box).toHaveValue(comment.label);

    await box.fill("  ab ");
    await page.getByTitle("Lưu").click();
    await expect(page.getByText("Bình luận cần ít nhất 3 ký tự")).toBeVisible();
    await box.fill("x".repeat(1000));
    await page.getByTitle("Lưu").click();
    await expect(
      page.getByText("Bình luận chỉ được dưới 1000 ký tự"),
    ).toBeVisible();
    expect(
      await commentContent(comment.id),
      "a refused edit changes nothing",
    ).toBe(comment.label);

    await box.fill(`  ${edited}  `);
    await page.getByTitle("Lưu").click();
    await expect(box).toBeHidden();
    await expect(page.getByText(edited, { exact: true })).toBeVisible();
    expect(await commentContent(comment.id)).toBe(edited);
  });
});

test.describe("lesson note form", () => {
  const LESSON_URL = "/learn/javascript-can-ban/bien-va-kieu-du-lieu";
  const input = (page: Page) => page.getByPlaceholder("Nhập ghi chú mới...");

  async function openNotes(page: Page) {
    await page.goto(LESSON_URL);
    await page.getByTitle("Mở ghi chú").click();
    await expect(input(page)).toBeEnabled();
  }

  test("[F7] adds a note, one row for a repeated Enter or a repeated submit", async ({
    page,
  }) => {
    const byEnter = fixtureLabel("E2E ghi chú Enter");
    const bySubmit = fixtureLabel("E2E ghi chú submit");
    await reserveStudentNote(byEnter);
    await reserveStudentNote(bySubmit);
    await openNotes(page);

    await input(page).fill(`  ${byEnter}  `);
    await Promise.all([input(page).press("Enter"), input(page).press("Enter")]);
    await expect(page.getByText(byEnter, { exact: true })).toHaveCount(1);
    await expect.poll(() => studentNotesWith(byEnter)).toBe(1);

    await input(page).fill(bySubmit);
    await submitTwice(input(page));
    await expect(page.getByText(bySubmit, { exact: true })).toHaveCount(1);
    expect(
      await studentNotesWith(bySubmit),
      "a repeated submit writes one row",
    ).toBe(1);
    expect(await studentNotesWith(byEnter)).toBe(1);
  });

  test("[F8] a blank note shows the field error and writes nothing", async ({
    page,
  }) => {
    await openNotes(page);
    const before = await studentNoteCount();
    const mutations = recordMutations(page);

    await input(page).press("Enter");
    await expect(
      page.getByText("Vui lòng nhập nội dung ghi chú"),
    ).toBeVisible();
    await input(page).fill("   ");
    await input(page).press("Enter");
    await expect(
      page.getByText("Vui lòng nhập nội dung ghi chú"),
    ).toBeVisible();
    await expect(input(page)).toHaveAttribute("aria-invalid", "true");

    expect(await studentNoteCount()).toBe(before);
    expect(mutations, "nothing was sent").toEqual([]);
  });
});
