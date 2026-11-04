import type { Page } from "@playwright/test";
import { IDS, authFile } from "./accounts";
import { recordMutations } from "./confirm-dialog";
import { expect, test } from "./fixtures";
import { createUserFixture, profileOf } from "./service-role";

// The admin user forms of AF-U6 (create and edit on /admin/users) on the admin session. The client-only rules (field
// errors, the role placeholder, the duplicate-submit guard, the payloads) are component tests; the rows here are the
// integration boundaries. V4 (action-validation.spec.ts) stays the create success row without an avatar. A created
// email is reserved first, an edit row edits a createUserFixture user, and every avatar upload is faked with
// `page.route` (an abort for a failure, a Storage-like answer for a success), so no row writes a Storage object.
test.use({ storageState: authFile("admin") });

const AVATAR_FILE = {
  name: "avatar e2e.png",
  mimeType: "image/png",
  buffer: Buffer.from("avatar"),
};
const AVATAR_REQUEST = "**/storage/v1/object/avatars/**";
const SAVE_FAILED = "Lưu người dùng thất bại. Vui lòng thử lại.";
const PASSWORD = "e2e-local-pass-1";

// The Storage boundary is outside the form: the upload answers like Storage does. `uploaded()` is the object name and
// the origin the form built the public URL from.
async function fakeAvatarUpload(page: Page) {
  const seen = { fileName: "", origin: "" };
  await page.route(AVATAR_REQUEST, (route) => {
    const url = new URL(route.request().url());
    seen.origin = url.origin;
    seen.fileName = url.pathname.split("/storage/v1/object/avatars/")[1];
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
        Key: `avatars/${seen.fileName}`,
      }),
    });
  });
  return {
    publicUrl: () =>
      `${seen.origin}/storage/v1/object/public/avatars/${seen.fileName}`,
    fileName: () => seen.fileName,
  };
}

async function openCreateDialog(page: Page) {
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Thêm thành viên" }).click();
  await expect(
    page.getByRole("dialog", { name: "Thêm Thành Viên Mới" }),
  ).toBeVisible();
}

async function openEditDialog(
  page: Page,
  user: { email: string; label: string },
) {
  await page.goto("/admin/users");
  await page.getByPlaceholder("Tìm kiếm...").fill(user.email);
  await page
    .getByRole("button", { name: `Sửa người dùng ${user.label}` })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Cập Nhật Thông Tin" }),
  ).toBeVisible();
}

async function fillCreate(page: Page, email: string) {
  await page.getByPlaceholder("helo@gmail.com").fill(email);
  await page.getByPlaceholder("Tối thiểu 8 ký tự").fill(PASSWORD);
}

test.describe("admin user forms", () => {
  test("[U1] an admin edits a user's name, role and avatar and the profile holds them", async ({
    page,
  }) => {
    const fixture = await createUserFixture();
    const avatar = await fakeAvatarUpload(page);
    await openEditDialog(page, fixture);
    await expect(page.getByLabel("EMAIL")).toBeDisabled();
    await expect(page.getByLabel("MẬT KHẨU")).toHaveCount(0);
    // The dialog is modal for the keyboard: focus starts in it and Tab, forwards and backwards, never reaches the page or the sidebar behind it.
    await expect(page.getByLabel("HỌ VÀ TÊN")).toBeFocused();
    for (const key of ["Tab", "Shift+Tab"]) {
      for (let i = 0; i < 9; i++) {
        await page.keyboard.press(key);
        expect(
          await page.evaluate(
            () => !!document.activeElement?.closest('[role="dialog"]'),
          ),
          `${key} press ${i + 1} stays in the dialog`,
        ).toBe(true);
      }
    }
    await page.getByLabel("HỌ VÀ TÊN").focus();

    await page.getByLabel("HỌ VÀ TÊN").fill(`  ${fixture.label} sửa  `);
    await page.getByLabel("VAI TRÒ").selectOption("admin");
    await page
      .getByLabel("Ảnh đại diện", { exact: true })
      .setInputFiles(AVATAR_FILE);
    await page.getByRole("button", { name: "Lưu Thay Đổi" }).click();

    await expect(page.getByText("Sửa thành công")).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(avatar.fileName()).toMatch(/^avatar_\d+_avatar_e2e\.png$/);
    expect(await profileOf(fixture.id)).toEqual({
      role: "admin",
      full_name: `${fixture.label} sửa`,
      avatar_url: avatar.publicUrl(),
    });
  });

  test("[U2] the action's refusal of an email already in use is shown in the form and creates no user", async ({
    page,
    owned,
  }) => {
    await openCreateDialog(page);
    const mutations = recordMutations(page);
    await fillCreate(page, "learner@devspace.test");
    await page.getByLabel("HỌ VÀ TÊN").fill("Tên đã gõ");
    await page.getByRole("button", { name: "Thêm Tài Khoản" }).click();

    await expect(
      page.getByText("Lưu người dùng thất bại: Email này đã được sử dụng."),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Thêm Thành Viên Mới" }),
    ).toBeVisible();
    await expect(page.getByLabel("HỌ VÀ TÊN")).toHaveValue("Tên đã gõ");
    await expect(
      page.getByRole("button", { name: "Thêm Tài Khoản" }),
    ).toBeEnabled();
    expect(
      mutations.filter((request) => request.startsWith("POST ")),
      "the form sent one action request",
    ).toHaveLength(1);
    // The email still belongs to the seed learner alone.
    expect(await owned.authIds("learner@devspace.test")).toEqual([IDS.learner]);
  });

  test("[U3] a failed avatar upload toasts, keeps the dialog open and creates no user", async ({
    page,
    owned,
  }) => {
    const email = `u3-${owned.tag}@devspace.test`;
    await owned.reserveAuth(email);
    let aborted = 0;
    await page.route(AVATAR_REQUEST, (route) => {
      aborted += 1;
      return route.abort("failed");
    });
    await openCreateDialog(page);
    const mutations = recordMutations(page);

    await fillCreate(page, email);
    await page
      .getByLabel("Ảnh đại diện", { exact: true })
      .setInputFiles(AVATAR_FILE);
    await page.getByRole("button", { name: "Thêm Tài Khoản" }).click();

    await expect(page.getByText("Lỗi khi upload avatar user")).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Thêm Thành Viên Mới" }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("helo@gmail.com")).toHaveValue(email);
    await expect(
      page.getByRole("button", { name: "Thêm Tài Khoản" }),
    ).toBeEnabled();
    expect(
      aborted,
      "the Storage request was attempted and aborted",
    ).toBeGreaterThan(0);
    expect(
      mutations.filter((request) => request.includes("/admin/users")),
      "no action request after the failed upload",
    ).toEqual([]);
    expect(await owned.authIds(email)).toEqual([]);
  });

  test("[U4] a create request that fails in transit toasts, keeps the dialog open and creates no user", async ({
    page,
    owned,
  }) => {
    const email = `u4-${owned.tag}@devspace.test`;
    await owned.reserveAuth(email);
    await openCreateDialog(page);
    let aborted = 0;
    // A server action is a POST to the page's own URL.
    await page.route("**/admin/users", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      aborted += 1;
      return route.abort("failed");
    });

    await fillCreate(page, email);
    await page.getByRole("button", { name: "Thêm Tài Khoản" }).click();

    await expect(page.getByText(SAVE_FAILED)).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Thêm Thành Viên Mới" }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("helo@gmail.com")).toHaveValue(email);
    await expect(
      page.getByRole("button", { name: "Thêm Tài Khoản" }),
    ).toBeEnabled();
    expect(
      aborted,
      "the action request was attempted and aborted",
    ).toBeGreaterThan(0);
    expect(await owned.authIds(email)).toEqual([]);
  });

  test("[U5] an edit write that fails in transit toasts, keeps the dialog open and leaves the profile unchanged", async ({
    page,
  }) => {
    const fixture = await createUserFixture();
    const before = await profileOf(fixture.id);
    await openEditDialog(page, fixture);
    let aborted = 0;
    await page.route("**/rest/v1/profiles*", (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      aborted += 1;
      return route.abort("failed");
    });

    await page.getByLabel("HỌ VÀ TÊN").fill("E2E Tên không được lưu");
    await page.getByLabel("VAI TRÒ").selectOption("admin");
    await page.getByRole("button", { name: "Lưu Thay Đổi" }).click();

    await expect(page.getByText(SAVE_FAILED)).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Cập Nhật Thông Tin" }),
    ).toBeVisible();
    await expect(page.getByLabel("HỌ VÀ TÊN")).toHaveValue(
      "E2E Tên không được lưu",
    );
    await expect(
      page.getByRole("button", { name: "Lưu Thay Đổi" }),
    ).toBeEnabled();
    expect(aborted, "the PATCH was attempted and aborted").toBeGreaterThan(0);
    expect(await profileOf(fixture.id)).toEqual(before);
  });

  test("[U6] an admin creates an admin user with a name and an avatar and the profile holds them", async ({
    page,
    owned,
  }) => {
    const email = `u6-${owned.tag}@devspace.test`;
    await owned.reserveAuth(email);
    const avatar = await fakeAvatarUpload(page);
    await openCreateDialog(page);

    await fillCreate(page, email);
    await page.getByLabel("HỌ VÀ TÊN").fill("  E2E Quản trị mới  ");
    await page.getByLabel("VAI TRÒ").selectOption("admin");
    await page
      .getByLabel("Ảnh đại diện", { exact: true })
      .setInputFiles(AVATAR_FILE);
    await page.getByRole("button", { name: "Thêm Tài Khoản" }).click();

    await expect(page.getByText("Thêm thành công")).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
    const ids = await owned.authIds(email);
    expect(ids).toHaveLength(1);
    expect(await profileOf(ids[0])).toEqual({
      role: "admin",
      full_name: "E2E Quản trị mới",
      avatar_url: avatar.publicUrl(),
    });
  });
});
