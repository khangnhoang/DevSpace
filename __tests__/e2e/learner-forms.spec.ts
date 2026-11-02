import type { Page } from "@playwright/test";
import { authFile } from "./accounts";
import { recordMutations } from "./confirm-dialog";
import { expect, test } from "./fixtures";
import { acquireStudentProfile, avatarObjectNames, studentProfile } from "./service-role";

// The learner forms of AF-U3 (profile edit, course review, lesson comments, lesson notes) on the student session. The
// student is enrolled in the paid course 2 and has no date of birth in the seed (AF-P4).
test.use({ storageState: authFile("student") });

const PROFILE_NAME = "E2E Học viên mới";
// A 1x1 PNG, so the avatar input has a real image file; no row uploads it (the Storage request is aborted or fulfilled).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const AVATAR_FILE = { name: "avatar e2e.png", mimeType: "image/png", buffer: PNG };
const AVATAR_REQUEST = "**/storage/v1/object/avatars/**";

async function openProfileDialog(page: Page) {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();
  await expect(page.getByRole("heading", { name: "Cập nhật hồ sơ" })).toBeVisible();
}

const profileWrites = (mutations: string[]) => mutations.filter((request) => request.startsWith("PATCH ") && request.includes("/rest/v1/profiles"));

test.describe("profile form", () => {
  test("[F1] saves a profile without a date of birth, stores blank fields as null and writes once for a repeated Enter", async ({ page }) => {
    await acquireStudentProfile();
    await openProfileDialog(page);
    await expect(page.getByLabel("Ngày sinh")).toHaveValue("");

    const mutations = recordMutations(page);
    await page.getByLabel("Họ và tên").fill(PROFILE_NAME);
    await page.getByLabel("Giới tính").selectOption({ label: "Nam" });
    await page.getByLabel("Tỉnh / Thành phố").selectOption({ label: "Hà Nội" });
    await page.getByLabel("Họ và tên").press("Enter");
    await page.getByLabel("Họ và tên").press("Enter");

    await expect(page.getByText("Cập nhật thành công")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cập nhật hồ sơ" })).toBeHidden();
    expect(await studentProfile()).toEqual({ full_name: PROFILE_NAME, gender: "male", province: "Hà Nội", dob: null, avatar_url: null });
    expect(profileWrites(mutations), "a repeated Enter makes one write").toHaveLength(1);

    // The dialog opens with the stored values; a blank name, gender and province are stored as null, not "".
    await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click();
    await expect(page.getByLabel("Họ và tên")).toHaveValue(PROFILE_NAME);
    await expect(page.getByLabel("Giới tính")).toHaveValue("male");
    await page.getByLabel("Họ và tên").fill("   ");
    await page.getByLabel("Giới tính").selectOption({ label: "-- Chọn --" });
    await page.getByLabel("Tỉnh / Thành phố").selectOption({ label: "-- Chọn tỉnh thành --" });
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(page.getByRole("heading", { name: "Cập nhật hồ sơ" })).toBeHidden();
    await expect.poll(studentProfile).toEqual({ full_name: null, gender: null, province: null, dob: null, avatar_url: null });
  });

  test("[F9] a failed avatar upload keeps the dialog open with what was typed and writes nothing", async ({ page }) => {
    await acquireStudentProfile();
    const before = await studentProfile();
    const objectsBefore = await avatarObjectNames();
    let aborted = 0;
    await page.route(AVATAR_REQUEST, (route) => { aborted += 1; return route.abort("failed"); });
    await openProfileDialog(page);

    await page.getByLabel("Họ và tên").fill("E2E Tên không được lưu");
    await page.locator('input[type="file"]').setInputFiles(AVATAR_FILE);
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();

    await expect(page.getByText("Lỗi cập nhật: Lỗi upload avatar")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cập nhật hồ sơ" })).toBeVisible();
    await expect(page.getByLabel("Họ và tên")).toHaveValue("E2E Tên không được lưu");
    await expect(page.getByRole("button", { name: "Lưu thay đổi" })).toBeEnabled();
    expect(aborted, "the Storage request was attempted and aborted").toBeGreaterThan(0);
    expect(await studentProfile()).toEqual(before);
    expect(await avatarObjectNames()).toEqual(objectsBefore);
  });

  test("[F10] a chosen avatar is saved as the public URL of its uploaded file name", async ({ page }) => {
    await acquireStudentProfile();
    let fileName = "";
    let origin = "";
    // The Storage boundary is outside the form: the upload answers like Storage does, so no object is written.
    await page.route(AVATAR_REQUEST, (route) => {
      const url = new URL(route.request().url());
      origin = url.origin;
      fileName = url.pathname.split("/storage/v1/object/avatars/")[1];
      const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ Id: "00000000-0000-4000-8000-000000000000", Key: `avatars/${fileName}` }) });
    });
    const objectsBefore = await avatarObjectNames();
    await openProfileDialog(page);

    await page.locator('input[type="file"]').setInputFiles(AVATAR_FILE);
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();

    await expect(page.getByText("Cập nhật thành công")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cập nhật hồ sơ" })).toBeHidden();
    expect(fileName).toMatch(/^avatar_\d+_avatar_e2e\.png$/);
    expect((await studentProfile()).avatar_url).toBe(`${origin}/storage/v1/object/public/avatars/${fileName}`);
    expect(await avatarObjectNames()).toEqual(objectsBefore);
  });
});
