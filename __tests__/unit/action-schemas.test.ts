import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { courseIdSchema } from "@/lib/schemas/enrollment";
import { notificationIdSchema } from "@/lib/schemas/notification";
import {
  CONTENT_TOO_SHORT_MESSAGE,
  INVALID_INPUT_MESSAGE,
  INVALID_ROLE_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
  parseFailure,
} from "@/lib/schemas/parse-failure";
import { quizRequestSchema } from "@/lib/schemas/quiz";
import {
  createUserFormSchema,
  createUserSchema,
  editUserFormSchema,
  userIdSchema,
} from "@/lib/schemas/user";

const content = "x".repeat(50);

// The rows the lessons page keeps in state and sends as previousQuestion.
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
  fullName: "Nguyễn Văn A",
  role: "user",
  avatarUrl: "https://example.com/a.png",
  password: "12345678",
};

function failureOf(schema: ZodType, value: unknown) {
  const result = schema.safeParse(value);
  if (result.success)
    throw new Error("expected the schema to refuse the value");
  return parseFailure(result.error);
}

describe("courseIdSchema and notificationIdSchema", () => {
  it.each([1, 42])("accepts the positive integer %s", (id) => {
    expect(courseIdSchema.parse(id)).toBe(id);
    expect(notificationIdSchema.parse(id)).toBe(id);
  });

  it.each([
    ["a string", "1"],
    ["zero", 0],
    ["a negative number", -1],
    ["a fraction", 1.5],
    ["NaN", NaN],
    ["null", null],
    ["undefined", undefined],
  ])("refuses %s with the generic message", (_label, id) => {
    expect(failureOf(courseIdSchema, id)).toBe(INVALID_INPUT_MESSAGE);
    expect(failureOf(notificationIdSchema, id)).toBe(INVALID_INPUT_MESSAGE);
  });
});

describe("userIdSchema", () => {
  it("accepts the id of a seed user", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(userIdSchema.parse(id)).toBe(id);
  });

  it.each([
    ["a non-uuid string", "not-a-uuid"],
    ["a number", 42],
    ["an empty string", ""],
    ["null", null],
  ])("refuses %s with the generic message", (_label, id) => {
    expect(failureOf(userIdSchema, id)).toBe(INVALID_INPUT_MESSAGE);
  });
});

describe("quizRequestSchema", () => {
  it.each([1, 3])(
    "accepts what the AI buttons send with quantity %s and DBExercise rows",
    (quantity) => {
      const parsed = quizRequestSchema.parse({
        content,
        quantity,
        previousQuestion: [exerciseRow, exerciseRow],
      });
      expect(parsed.quantity).toBe(quantity);
      // Unknown keys are stripped, not refused: a strict schema would reject every AI call.
      expect(parsed.previousQuestion).toEqual([
        { question: "HTML là gì?" },
        { question: "HTML là gì?" },
      ]);
    },
  );

  it("defaults the quantity to 1 and accepts no previous questions", () => {
    expect(quizRequestSchema.parse({ content, previousQuestion: [] })).toEqual({
      content,
      quantity: 1,
      previousQuestion: [],
    });
  });

  it("accepts content of exactly 50 characters and refuses 49 with the existing message", () => {
    expect(
      quizRequestSchema.safeParse({
        content,
        quantity: 1,
        previousQuestion: [],
      }).success,
    ).toBe(true);
    expect(
      failureOf(quizRequestSchema, {
        content: "x".repeat(49),
        quantity: 1,
        previousQuestion: [],
      }),
    ).toBe(CONTENT_TOO_SHORT_MESSAGE);
  });

  it.each([
    ["quantity 0", { content, quantity: 0, previousQuestion: [] }],
    ["quantity 4", { content, quantity: 4, previousQuestion: [] }],
    ["a fractional quantity", { content, quantity: 1.5, previousQuestion: [] }],
    ["a string quantity", { content, quantity: "1", previousQuestion: [] }],
    [
      "null previous questions",
      { content, quantity: 1, previousQuestion: null },
    ],
    ["missing previous questions", { content, quantity: 1 }],
    [
      "a previous question without text",
      { content, quantity: 1, previousQuestion: [{ question: 1 }] },
    ],
    ["numeric content", { content: 12345, quantity: 1, previousQuestion: [] }],
    ["a missing payload", undefined],
  ])("refuses %s with the generic message", (_label, payload) => {
    expect(failureOf(quizRequestSchema, payload)).toBe(INVALID_INPUT_MESSAGE);
  });
});

describe("createUserSchema", () => {
  it("accepts what the users page sends and keeps the values", () => {
    expect(createUserSchema.parse(validUser)).toEqual(validUser);
  });

  it("stores a blank name and a blank avatar as null (the page sends empty strings)", () => {
    const parsed = createUserSchema.parse({
      ...validUser,
      fullName: "",
      avatarUrl: "",
    });
    expect(parsed.fullName).toBeNull();
    expect(parsed.avatarUrl).toBeNull();
  });

  it("trims text and treats a whitespace-only name as blank", () => {
    const parsed = createUserSchema.parse({
      ...validUser,
      email: "  new.user@devspace.test ",
      fullName: "   ",
      avatarUrl: " https://example.com/a.png ",
    });
    expect(parsed).toMatchObject({
      email: "new.user@devspace.test",
      fullName: null,
      avatarUrl: "https://example.com/a.png",
    });
  });

  it("accepts the local Storage URL that an uploaded avatar has on the dev stack", () => {
    const avatarUrl =
      "http://127.0.0.1:54321/storage/v1/object/public/avatars/a.png";
    expect(createUserSchema.parse({ ...validUser, avatarUrl }).avatarUrl).toBe(
      avatarUrl,
    );
  });

  it("accepts the admin role and strips unknown keys", () => {
    const parsed = createUserSchema.parse({
      ...validUser,
      role: "admin",
      isAdmin: true,
    });
    expect(parsed.role).toBe("admin");
    expect(parsed).not.toHaveProperty("isAdmin");
  });

  it.each([
    ["7 characters", "1234567"],
    ["empty", ""],
    ["missing", undefined],
    ["a number", 12345678],
  ])(
    "refuses a password that is %s with the existing message",
    (_label, password) => {
      expect(failureOf(createUserSchema, { ...validUser, password })).toBe(
        PASSWORD_TOO_SHORT_MESSAGE,
      );
    },
  );

  it.each([
    ["owner", "owner"],
    ["uppercase", "ADMIN"],
    ["empty", ""],
    ["missing", undefined],
  ])("refuses the role %s with the existing message", (_label, role) => {
    expect(failureOf(createUserSchema, { ...validUser, role })).toBe(
      INVALID_ROLE_MESSAGE,
    );
  });

  it("reports the password message first when the password and the role are both wrong", () => {
    expect(
      failureOf(createUserSchema, {
        ...validUser,
        password: "1",
        role: "owner",
      }),
    ).toBe(PASSWORD_TOO_SHORT_MESSAGE);
  });

  it.each([
    ["a malformed email", { email: "a@@devspace.test" }],
    ["a blank email", { email: "  " }],
    ["a javascript: avatar", { avatarUrl: "javascript:alert(1)" }],
    ["an ftp avatar", { avatarUrl: "ftp://example.com/a.png" }],
    ["a data: avatar", { avatarUrl: "data:text/html,<script>1</script>" }],
    ["an avatar that is not a URL", { avatarUrl: "not a url" }],
    ["a non-string name", { fullName: 5 }],
  ])("refuses %s with the generic message", (_label, override) => {
    expect(failureOf(createUserSchema, { ...validUser, ...override })).toBe(
      INVALID_INPUT_MESSAGE,
    );
  });

  it("refuses a missing payload with the generic message", () => {
    expect(failureOf(createUserSchema, null)).toBe(INVALID_INPUT_MESSAGE);
  });
});

describe("createUserFormSchema and editUserFormSchema", () => {
  const formValues = {
    email: "new.user@devspace.test",
    password: "12345678",
    fullName: "Nguyễn Văn A",
    role: "user",
  };

  function issueMessages(schema: ZodType, value: unknown) {
    const result = schema.safeParse(value);
    if (result.success)
      throw new Error("expected the schema to refuse the value");
    return result.error.issues.map((issue) => issue.message);
  }

  it("parses what the create form holds and trims the email and the name", () => {
    expect(
      createUserFormSchema.parse({
        ...formValues,
        email: " new.user@devspace.test ",
        fullName: "  Nguyễn Văn A ",
      }),
    ).toEqual(formValues);
  });

  it("turns a blank name into null, which the form sends to the action as an empty string", () => {
    expect(
      createUserFormSchema.parse({ ...formValues, fullName: "  " }).fullName,
    ).toBeNull();
  });

  it("carries no avatar, because the form uploads the file and sends the URL beside its values", () => {
    expect(
      createUserFormSchema.parse({
        ...formValues,
        avatarUrl: "https://example.com/a.png",
      }),
    ).not.toHaveProperty("avatarUrl");
  });

  it.each([
    ["a blank email", { email: "" }, "Email không hợp lệ"],
    ["a malformed email", { email: "a@@devspace.test" }, "Email không hợp lệ"],
    [
      "a password of 7 characters",
      { password: "1234567" },
      PASSWORD_TOO_SHORT_MESSAGE,
    ],
    ["no role", { role: "" }, INVALID_ROLE_MESSAGE],
    ["another role", { role: "owner" }, INVALID_ROLE_MESSAGE],
  ])(
    "refuses %s with a Vietnamese message the form can show",
    (_label, override, message) => {
      expect(
        issueMessages(createUserFormSchema, { ...formValues, ...override }),
      ).toEqual([message]);
    },
  );

  it("reports the password message before the role message, like the action", () => {
    expect(
      issueMessages(createUserFormSchema, {
        ...formValues,
        password: "1",
        role: "",
      }),
    ).toEqual([PASSWORD_TOO_SHORT_MESSAGE, INVALID_ROLE_MESSAGE]);
  });

  it("parses the edit form's name and role and ignores the email and the password", () => {
    expect(
      editUserFormSchema.parse({ ...formValues, fullName: "", password: "" }),
    ).toEqual({
      fullName: null,
      role: "user",
    });
    expect(
      editUserFormSchema.parse({ ...formValues, role: "admin" }).role,
    ).toBe("admin");
  });

  it.each([
    ["the placeholder", ""],
    ["a stored role outside the two", "Chọn vai trò"],
  ])("refuses %s as the edit form's role", (_label, role) => {
    expect(issueMessages(editUserFormSchema, { ...formValues, role })).toEqual([
      INVALID_ROLE_MESSAGE,
    ]);
  });

  it("keeps the generic action message for a bad email even though the form has its own", () => {
    expect(
      failureOf(createUserSchema, { ...validUser, email: "a@@devspace.test" }),
    ).toBe(INVALID_INPUT_MESSAGE);
  });
});

describe("parseFailure", () => {
  it("never carries Zod's wording, the path or the rejected input", () => {
    const message = failureOf(createUserSchema, {
      ...validUser,
      email: "secret@@x",
    });
    expect(message).toBe(INVALID_INPUT_MESSAGE);
    expect(message).not.toMatch(/secret|email|expected|invalid_/i);
  });
});
