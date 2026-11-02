// Test plan
// Goal: describe how the server actions of app-foundation AF-U2 refuse a malformed argument and still serve the
//   admin users form, and (AF-P1, V8 to V10) return fixed messages instead of database or Auth error text.
// Layer: e2e (the e2e server on the local stack). V rows post straight to the action endpoints with `callAction`
//   (the UI cannot send a malformed value); V4 drives the form of /admin/users.
// Subject: app/action/enroll.ts (enrollCourse), app/action/user.ts (createNewUser, deleteUserAccount),
//   app/action/gemini.ts (generateQuizFromContent) and their schemas in lib/schemas/. markAsRead has no caller and is
//   not an endpoint (plan section 2), so only its unit test covers it.
// Allowed paths: an admin creates a user (UI and action); a valid call still reaches the auth check.
// Denied paths: a malformed argument returns the action's own error and creates, enrolls, deletes and calls nothing;
//   a learner cannot create a user.
// Not automated: a valid generateQuizFromContent call would reach Google, which the server guard forbids; its
//   application path is covered by action-parse.test.ts with the SDK mocked.
// Invariants: Auth users are created only for reserved, scope-tagged emails and removed by the automatic scope; the
//   service role reads state back and never sends a request under test; no row records a mail or an outbound call.
import { IDS, authFile } from "./accounts";
import { expect, test } from "./fixtures";
import { learnerEnrollmentCount, learnerEnrollmentNotificationCount, prepareLearnerEnrollment, profileOf, userExists } from "./service-role";

test.use({ storageState: authFile("admin") });

test.afterEach(async ({ serverRecords }) => {
  expect(serverRecords.mailsSent(), "no row of this file sends a mail").toEqual([]);
});

const GENERIC = { error: "Dữ liệu không hợp lệ." };
const FREE_COURSE_ID = 1;
const content = "Nội dung bài học đủ dài để vượt qua giới hạn năm mươi ký tự của AI.";

const userPayload = (email: string, override: Record<string, unknown> = {}) => ({
  email,
  fullName: "",
  role: "user",
  avatarUrl: "",
  password: "e2e-local-pass-1",
  ...override,
});

test("[V1] enrolling with a malformed course id is refused and enrolls nobody", async ({ callAction }) => {
  await prepareLearnerEnrollment(FREE_COURSE_ID);

  for (const courseId of ["1", -1, 1.5]) {
    expect(await callAction("learner", "app/action/enroll.ts", "enrollCourse", [courseId]), `course id ${JSON.stringify(courseId)}`).toEqual(GENERIC);
  }

  expect(await learnerEnrollmentCount(FREE_COURSE_ID)).toBe(0);
  expect(await learnerEnrollmentNotificationCount(FREE_COURSE_ID)).toBe(0);
});

test("[V2] creating a user with an invalid field is refused and creates no account", async ({ callAction, owned }) => {
  const cases = [
    { name: "an unknown role", email: `v2role-${owned.tag}@devspace.test`, override: { role: "owner" }, expected: { error: "Vai trò không hợp lệ" } },
    { name: "a 7-character password", email: `v2pass-${owned.tag}@devspace.test`, override: { password: "1234567" }, expected: { error: "Mật khẩu phải có ít nhất 8 ký tự" } },
    { name: "a javascript: avatar", email: `v2avatar-${owned.tag}@devspace.test`, override: { avatarUrl: "javascript:alert(1)" }, expected: GENERIC },
    // Two @ signs: z.email() refuses the address, while reserveAuth accepts any scope-tagged @devspace.test string.
    { name: "a malformed email", email: `${owned.tag}@@devspace.test`, override: {}, expected: GENERIC },
  ];

  for (const { name, email, override, expected } of cases) {
    await owned.reserveAuth(email);
    expect(await callAction("admin", "app/action/user.ts", "createNewUser", [userPayload(email, override)]), name).toEqual(expected);
    expect(await owned.authIds(email), `${name}: no Auth user for ${email}`).toEqual([]);
  }
});

test("[V3] a learner cannot create a user with a valid payload", async ({ callAction, owned }) => {
  const email = `v3-${owned.tag}@devspace.test`;
  await owned.reserveAuth(email);

  expect(await callAction("learner", "app/action/user.ts", "createNewUser", [userPayload(email)])).toEqual({ error: "Không có quyền truy cập" });

  expect(await owned.authIds(email)).toEqual([]);
});

test("[V4] an admin creates a user from the form with no avatar and no name", async ({ page, owned }) => {
  const email = `v4-${owned.tag}@devspace.test`;
  await owned.reserveAuth(email);

  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Thêm thành viên" }).click();
  await page.getByPlaceholder("helo@gmail.com").fill(email);
  await page.getByPlaceholder("Tối thiểu 8 ký tự").fill("e2e-local-pass-1");
  await page.getByRole("button", { name: "Thêm Tài Khoản" }).click();

  await expect(page.getByText("Thêm thành công")).toBeVisible();
  const ids = await owned.authIds(email);
  expect(ids).toHaveLength(1);
  expect(await profileOf(ids[0])).toEqual({ role: "user", full_name: null, avatar_url: null });

  await page.getByPlaceholder("Tìm kiếm...").fill(email);
  const row = page.getByRole("row").filter({ hasText: email });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Chưa điền họ tên");
});

test("[V5] an admin creates an admin user through the action", async ({ callAction, owned }) => {
  const email = `v5-${owned.tag}@devspace.test`;
  await owned.reserveAuth(email);

  const result = await callAction("admin", "app/action/user.ts", "createNewUser", [userPayload(email, { role: "admin" })]);

  const ids = await owned.authIds(email);
  expect(ids).toHaveLength(1);
  expect(result).toEqual({ success: true, userId: ids[0] });
  expect((await profileOf(ids[0])).role).toBe("admin");
});

test("[V6] deleting a malformed user id is refused and deletes nobody", async ({ callAction }) => {
  for (const userId of ["not-a-uuid", 42]) {
    expect(await callAction("admin", "app/action/user.ts", "deleteUserAccount", [userId]), `user id ${JSON.stringify(userId)}`).toEqual(GENERIC);
  }

  for (const id of Object.values(IDS)) expect(await userExists(id), `seed user ${id}`).toBe(true);
});

test("[V7] a malformed quiz request is refused before Gemini is called", async ({ callAction }) => {
  const cases: [string, unknown[], unknown][] = [
    ["quantity 0", [content, 0, []], GENERIC],
    ["quantity 4", [content, 4, []], GENERIC],
    ["null previous questions", [content, 1, null], GENERIC],
    ["content of 49 characters", ["x".repeat(49), 1, []], { error: "Nội dung quá ngắn (cần > 50 ký tự)." }],
  ];

  // The `serverRecords` fixture fails the test if the server tried to reach any non-local host during these calls.
  for (const [name, args, expected] of cases) {
    expect(await callAction("admin", "app/action/gemini.ts", "generateQuizFromContent", args), name).toEqual(expected);
  }
});

// AF-P1: a database or Auth failure returns a fixed Vietnamese message, never the provider's error text.
test("[V8] enrolling twice in a free course says so and keeps one enrollment", async ({ callAction }) => {
  await prepareLearnerEnrollment(FREE_COURSE_ID);

  expect(await callAction("learner", "app/action/enroll.ts", "enrollCourse", [FREE_COURSE_ID])).toEqual({ success: true, slug: "lam-quen-voi-html" });
  expect(await callAction("learner", "app/action/enroll.ts", "enrollCourse", [FREE_COURSE_ID])).toEqual({ error: "Bạn đã đăng ký khóa học này." });

  expect(await learnerEnrollmentCount(FREE_COURSE_ID)).toBe(1);
  expect(await learnerEnrollmentNotificationCount(FREE_COURSE_ID)).toBe(1);
});

test("[V9] creating a user with an email already in use names the conflict and creates nobody", async ({ callAction }) => {
  expect(await callAction("admin", "app/action/user.ts", "createNewUser", [userPayload("learner@devspace.test")])).toEqual({ error: "Email này đã được sử dụng." });

  expect(await userExists(IDS.learner)).toBe(true);
});

test("[V10] deleting a user that does not exist returns a fixed message and deletes nobody", async ({ callAction }) => {
  expect(await callAction("admin", "app/action/user.ts", "deleteUserAccount", ["99999999-9999-4999-8999-999999999999"])).toEqual({
    error: "Không thể xóa người dùng. Vui lòng thử lại.",
  });

  for (const id of Object.values(IDS)) expect(await userExists(id), `seed user ${id}`).toBe(true);
});
