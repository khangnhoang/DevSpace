import { describe, expect, it } from "vitest";
import {
  EMAIL_INVALID_MESSAGE,
  EMAIL_REQUIRED_MESSAGE,
  FORGOT_EMAIL_REQUIRED_MESSAGE,
  FULL_NAME_REQUIRED_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_REQUIRED_MESSAGE,
  PHONE_INVALID_MESSAGE,
  PHONE_REQUIRED_MESSAGE,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpAccountSchema,
  signUpProfileSchema,
} from "@/lib/schemas/auth-forms";
import { PASSWORD_TOO_SHORT_MESSAGE } from "@/lib/schemas/parse-failure";

// The message of each issue by field, for the first issue of a field.
function issues(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries((result.error?.issues ?? []).map((issue) => [String(issue.path[0]), issue.message]).reverse());
}

describe("sign-in schema", () => {
  it("accepts a seed login and sends the values as typed", () => {
    const result = signInSchema.safeParse({ email: "learner@devspace.test", password: " pass word " });
    expect(result.success && result.data).toEqual({ email: "learner@devspace.test", password: " pass word " });
  });

  it("accepts a 6-character password and an address without a dot that the browser accepted", () => {
    expect(signInSchema.safeParse({ email: "legacy@localhost", password: "abc123" }).success).toBe(true);
  });

  it("refuses blank fields with a message per field", () => {
    expect(issues(signInSchema.safeParse({ email: "", password: "" }))).toEqual({
      email: EMAIL_REQUIRED_MESSAGE,
      password: PASSWORD_REQUIRED_MESSAGE,
    });
  });

  it.each(["not-an-email", "a@", "@b.c", "a b@c.d"])("refuses the malformed email %j", (email) => {
    expect(issues(signInSchema.safeParse({ email, password: "x" }))).toEqual({ email: EMAIL_INVALID_MESSAGE });
  });
});

describe("sign-up account schema (step 1)", () => {
  const valid = { email: "new@example.com", password: "12345678", confirmPassword: "12345678" };

  it("accepts a valid account and keeps the password as typed", () => {
    const password = " 1234 5678 ";
    const result = signUpAccountSchema.safeParse({ ...valid, password, confirmPassword: password });
    expect(result.success && result.data.password).toBe(password);
  });

  it("refuses blank and malformed emails", () => {
    expect(issues(signUpAccountSchema.safeParse({ ...valid, email: "" })).email).toBe(EMAIL_REQUIRED_MESSAGE);
    expect(issues(signUpAccountSchema.safeParse({ ...valid, email: "legacy@localhost" })).email).toBe(EMAIL_INVALID_MESSAGE);
  });

  it.each(["sadasdasd@gmasdsdsd.e,a", "a@b.c", "a@b.c1", "a b@c.de", "a@@c.de", "a..b@c.de"])(
    "refuses the email %j that the loose pattern accepted",
    (email) => {
      expect(issues(signUpAccountSchema.safeParse({ ...valid, email })).email).toBe(EMAIL_INVALID_MESSAGE);
    },
  );

  it.each(["new@example.com", "first.last+tag@sub.example.co", "learner@devspace.test"])("accepts the email %j", (email) => {
    expect(signUpAccountSchema.safeParse({ ...valid, email }).success).toBe(true);
  });

  it("refuses a password under 8 characters", () => {
    expect(issues(signUpAccountSchema.safeParse({ ...valid, password: "1234567", confirmPassword: "1234567" })).password).toBe(
      PASSWORD_TOO_SHORT_MESSAGE,
    );
  });

  it("refuses a confirmation that differs, under the confirmation field", () => {
    expect(issues(signUpAccountSchema.safeParse({ ...valid, confirmPassword: "87654321" }))).toEqual({
      confirmPassword: PASSWORD_MISMATCH_MESSAGE,
    });
  });
});

describe("sign-up profile schema (step 2)", () => {
  const valid = { full_name: "  Nguyễn Văn A  ", phone: "0912345678", gender: "male" };

  it("accepts a valid profile and trims the full name", () => {
    const result = signUpProfileSchema.safeParse(valid);
    expect(result.success && result.data).toEqual({ full_name: "Nguyễn Văn A", phone: "0912345678", gender: "male" });
  });

  it.each(["0312345678", "0512345678", "0712345678", "0812345678", "0912345678"])("accepts the phone %s", (phone) => {
    expect(signUpProfileSchema.safeParse({ ...valid, phone }).success).toBe(true);
  });

  it.each(["8412345678", "091234567", "09123456789", "0212345678", "0112345678", "09123 5678", "abcdefghij"])(
    "refuses the phone %j",
    (phone) => {
      expect(issues(signUpProfileSchema.safeParse({ ...valid, phone }))).toEqual({ phone: PHONE_INVALID_MESSAGE });
    },
  );

  it("refuses a blank name and a blank phone", () => {
    expect(issues(signUpProfileSchema.safeParse({ ...valid, full_name: "   ", phone: "" }))).toEqual({
      full_name: FULL_NAME_REQUIRED_MESSAGE,
      phone: PHONE_REQUIRED_MESSAGE,
    });
  });

  it.each(["male", "female", "other"])("accepts the gender %s", (gender) => {
    expect(signUpProfileSchema.safeParse({ ...valid, gender }).success).toBe(true);
  });

  it("refuses a gender outside the list", () => {
    expect(signUpProfileSchema.safeParse({ ...valid, gender: "unknown" }).success).toBe(false);
  });
});

describe("forgot-password schema", () => {
  it("accepts an email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
  });

  it("refuses a blank email with the recovery message and a malformed one with the format message", () => {
    expect(issues(forgotPasswordSchema.safeParse({ email: "" }))).toEqual({ email: FORGOT_EMAIL_REQUIRED_MESSAGE });
    expect(issues(forgotPasswordSchema.safeParse({ email: "nope" }))).toEqual({ email: EMAIL_INVALID_MESSAGE });
  });

  it.each(["sadasdasd@gmasdsdsd.e,a", "a@b.c"])("refuses the email %j", (email) => {
    expect(issues(forgotPasswordSchema.safeParse({ email }))).toEqual({ email: EMAIL_INVALID_MESSAGE });
  });

  it("accepts a normal address and one with a plus tag", () => {
    expect(forgotPasswordSchema.safeParse({ email: "first.last+tag@example.com" }).success).toBe(true);
  });
});

describe("reset-password schema", () => {
  it("accepts a matching password of 8 characters and keeps edge spaces", () => {
    const result = resetPasswordSchema.safeParse({ password: "  abcdef  ", confirmPassword: "  abcdef  " });
    expect(result.success && result.data.password).toBe("  abcdef  ");
  });

  it("refuses a short password and a confirmation that differs, each under its own field", () => {
    expect(issues(resetPasswordSchema.safeParse({ password: "short", confirmPassword: "short" })).password).toBe(
      PASSWORD_TOO_SHORT_MESSAGE,
    );
    expect(issues(resetPasswordSchema.safeParse({ password: "longenough", confirmPassword: "different" }))).toEqual({
      confirmPassword: PASSWORD_MISMATCH_MESSAGE,
    });
  });
});
