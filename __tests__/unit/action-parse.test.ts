import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks sit on the boundaries outside the subject: the Gemini SDK, the auth helpers, the caller's
// session client and the service-role client that enroll.ts and user.ts build at import. The parse
// is the subject, so the assertions are what is (not) called around it.
const mocks = vi.hoisted(() => {
  const serviceRole = {
    from: vi.fn(),
    auth: { admin: { createUser: vi.fn(), deleteUser: vi.fn() } },
  };
  return {
    serviceRole,
    requireUser: vi.fn(),
    requireAdmin: vi.fn(),
    generateContent: vi.fn(),
    createSupabaseServerClient: vi.fn(),
    session: { eq: vi.fn(), update: vi.fn(), from: vi.fn() },
  };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: () => mocks.serviceRole }));
vi.mock("@/lib/auth.server", () => ({
  requireUser: mocks.requireUser,
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/lib/supabase.server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.generateContent };
  },
}));

import { enrollCourse } from "@/app/action/enroll";
import { generateQuizFromContent } from "@/app/action/gemini";
import { markAsRead } from "@/app/action/get-notifications";
import { createNewUser, deleteUserAccount } from "@/app/action/user";

const GENERIC = "Dữ liệu không hợp lệ.";
const content = "Nội dung bài học đủ dài để vượt qua giới hạn năm mươi ký tự của AI.";

const exerciseRow = {
  id: 7,
  lesson_id: 3,
  question: "HTML là gì?",
  option_a: "a",
  option_b: "b",
  option_c: "c",
  option_d: "d",
  correct_answer: "a",
  explanation: "vì sao",
};

const validUser = {
  email: "new.user@devspace.test",
  fullName: "",
  role: "user",
  avatarUrl: "",
  password: "12345678",
};

function expectNothingTouched() {
  expect(mocks.requireUser).not.toHaveBeenCalled();
  expect(mocks.requireAdmin).not.toHaveBeenCalled();
  expect(mocks.generateContent).not.toHaveBeenCalled();
  expect(mocks.serviceRole.from).not.toHaveBeenCalled();
  expect(mocks.serviceRole.auth.admin.createUser).not.toHaveBeenCalled();
  expect(mocks.serviceRole.auth.admin.deleteUser).not.toHaveBeenCalled();
  expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GEMINI_API_KEY", "placeholder-key");
  mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-id" } });
  mocks.requireUser.mockResolvedValue({ user: { id: "learner-id" } });
  mocks.session.eq.mockResolvedValue({ error: null });
  mocks.session.update.mockReturnValue({ eq: mocks.session.eq });
  mocks.session.from.mockReturnValue({ update: mocks.session.update });
  mocks.createSupabaseServerClient.mockResolvedValue({ from: mocks.session.from });
});

describe("enrollCourse", () => {
  it.each([
    ["a string id", "1"],
    ["a negative id", -1],
    ["a fractional id", 1.5],
    ["null", null],
  ])("refuses %s before any auth check or query", async (_label, courseId) => {
    const result = await enrollCourse(courseId as unknown as number);
    expect(result).toEqual({ error: GENERIC });
    expectNothingTouched();
  });

  it("still runs the auth check for a valid id and returns its error", async () => {
    mocks.requireUser.mockResolvedValue({ error: "Bạn chưa đăng nhập" });
    expect(await enrollCourse(1)).toEqual({ error: "Bạn chưa đăng nhập" });
    expect(mocks.requireUser).toHaveBeenCalledTimes(1);
    expect(mocks.serviceRole.from).not.toHaveBeenCalled();
  });
});

describe("generateQuizFromContent", () => {
  it.each([1, 3])(
    "as an admin with quantity %s builds the prompt from the parsed values and returns the array",
    async (quantity) => {
      const questions = [{ question: "Q?", correct_answer: "a" }];
      mocks.generateContent.mockResolvedValue({ text: JSON.stringify(questions) });

      const result = await generateQuizFromContent(content, quantity, [
        exerciseRow,
        { ...exerciseRow, question: "CSS là gì?" },
      ]);

      expect(result).toEqual({ data: questions });
      expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
      const prompt = mocks.generateContent.mock.calls[0][0].contents as string;
      expect(prompt).toContain(`Tạo ${quantity} câu hỏi`);
      expect(prompt).toContain("HTML là gì?; CSS là gì?");
      expect(prompt).toContain(content);
    },
  );

  it("reads a JSON array out of a fenced answer as before", async () => {
    mocks.generateContent.mockResolvedValue({ text: '```json\n[{"question":"Q?"}]\n```' });
    expect(await generateQuizFromContent(content, 1, [])).toEqual({ data: [{ question: "Q?" }] });
  });

  it.each([
    ["quantity 0", [content, 0, []], GENERIC],
    ["quantity 4", [content, 4, []], GENERIC],
    ["null previous questions", [content, 1, null], GENERIC],
    ["content of 49 characters", ["x".repeat(49), 1, []], "Nội dung quá ngắn (cần > 50 ký tự)."],
  ])("refuses %s without an auth check or a provider call", async (_label, args, message) => {
    const result = await generateQuizFromContent(...(args as [string, number, { question: string }[]]));
    expect(result).toEqual({ error: message });
    expectNothingTouched();
  });

  it("returns the auth error to a non-admin without calling the provider", async () => {
    mocks.requireAdmin.mockResolvedValue({ error: "Không có quyền truy cập" });
    expect(await generateQuizFromContent(content, 1, [])).toEqual({ error: "Không có quyền truy cập" });
    expect(mocks.generateContent).not.toHaveBeenCalled();
  });
});

describe("createNewUser", () => {
  it.each([
    ["a short password", { password: "1234567" }, "Mật khẩu phải có ít nhất 8 ký tự"],
    ["an unknown role", { role: "owner" }, "Vai trò không hợp lệ"],
    ["a javascript: avatar", { avatarUrl: "javascript:alert(1)" }, GENERIC],
    ["a malformed email", { email: "a@@devspace.test" }, GENERIC],
  ])("refuses %s before any auth check or Auth call", async (_label, override, message) => {
    const result = await createNewUser({ ...validUser, ...override });
    expect(result).toEqual({ error: message });
    expectNothingTouched();
  });

  it("refuses a missing payload with the generic message", async () => {
    expect(await createNewUser(undefined as unknown as typeof validUser)).toEqual({ error: GENERIC });
    expectNothingTouched();
  });

  it("returns the auth error for a valid payload from a non-admin and creates nobody", async () => {
    mocks.requireAdmin.mockResolvedValue({ error: "Không có quyền truy cập" });
    expect(await createNewUser(validUser)).toEqual({ error: "Không có quyền truy cập" });
    expect(mocks.serviceRole.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("passes blank optional text to Auth as null", async () => {
    mocks.serviceRole.auth.admin.createUser.mockResolvedValue({ data: { user: { id: "new-id" } }, error: null });
    expect(await createNewUser(validUser)).toEqual({ success: true, userId: "new-id" });
    expect(mocks.serviceRole.auth.admin.createUser).toHaveBeenCalledWith({
      email: "new.user@devspace.test",
      password: "12345678",
      email_confirm: true,
      user_metadata: { full_name: null, avatar_url: null },
    });
  });
});

describe("deleteUserAccount", () => {
  it.each([
    ["a non-uuid string", "not-a-uuid"],
    ["a number", 42],
  ])("refuses %s before any auth check or delete", async (_label, userId) => {
    expect(await deleteUserAccount(userId as unknown as string)).toEqual({ error: GENERIC });
    expectNothingTouched();
  });

  it("deletes a valid id after the admin check", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    mocks.serviceRole.auth.admin.deleteUser.mockResolvedValue({ error: null });
    // The result is not asserted: revalidatePath needs a Next request, which this unit has not.
    await deleteUserAccount(id);
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.serviceRole.auth.admin.deleteUser).toHaveBeenCalledWith(id);
  });
});

describe("markAsRead", () => {
  it.each([
    ["a string id", "5"],
    ["zero", 0],
    ["null", null],
  ])("returns nothing for %s without creating the session client", async (_label, id) => {
    expect(await markAsRead(id as unknown as number)).toBeUndefined();
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("updates the notification through the caller's session for a valid id", async () => {
    expect(await markAsRead(5)).toBeUndefined();
    expect(mocks.session.from).toHaveBeenCalledWith("notifications");
    expect(mocks.session.update).toHaveBeenCalledWith({ is_read: true });
    expect(mocks.session.eq).toHaveBeenCalledWith("id", 5);
  });
});
