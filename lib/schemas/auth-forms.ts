import { z } from "zod";
import { PASSWORD_TOO_SHORT_MESSAGE } from "./parse-failure";

// The auth forms call Supabase Auth, which stays the enforcement (app-foundation master plan, decision 3); these
// schemas are UX. Passwords are never trimmed: Auth receives what was typed.
export const EMAIL_REQUIRED_MESSAGE = "Vui lòng nhập email";
export const EMAIL_INVALID_MESSAGE = "Email không đúng định dạng";
export const FORGOT_EMAIL_REQUIRED_MESSAGE = "Vui lòng nhập email để khôi phục";
export const PASSWORD_REQUIRED_MESSAGE = "Vui lòng nhập mật khẩu";
export const CONFIRM_PASSWORD_REQUIRED_MESSAGE = "Vui lòng xác nhận mật khẩu";
export const PASSWORD_MISMATCH_MESSAGE = "Mật khẩu xác nhận không khớp";
export const FULL_NAME_REQUIRED_MESSAGE = "Vui lòng nhập họ và tên";
export const PHONE_REQUIRED_MESSAGE = "Vui lòng nhập số điện thoại";
export const PHONE_INVALID_MESSAGE = "Số điện thoại không hợp lệ (10 số)";

// The rule the browser applied to the sign-in `type="email"` input before the form got `noValidate`. It accepts
// `legacy@localhost`, which the sign-up regex refuses, so an existing account with such an address can still sign in.
const htmlEmail = z.regexes.html5Email;
// The sign-up and forgot-password rule (Owner decision 2026-11-03): Zod's default email regex, which refuses a
// one-letter top-level domain and a comma, unlike the loose `x@y.z` pattern these forms used before. Sign in keeps the
// HTML rule above so an existing account with an unusual address can still sign in.
const signUpEmail = z.regexes.email;
// Mobile numbers: 03, 05, 07, 08 or 09, then 8 digits (Owner decision 2026-11-03).
const vietnamPhone = /^0[35789]\d{8}$/;

export const GENDERS = ["male", "female", "other"] as const;

const passwordsMatch = (values: { password: string; confirmPassword: string }) => values.password === values.confirmPassword;
const mismatchIssue = { message: PASSWORD_MISMATCH_MESSAGE, path: ["confirmPassword"] };

// No length or format rule on the password: an account made before H1 can have 6 characters (`minimum_password_length`).
export const signInSchema = z.object({
  email: z.string().min(1, EMAIL_REQUIRED_MESSAGE).regex(htmlEmail, EMAIL_INVALID_MESSAGE),
  password: z.string().min(1, PASSWORD_REQUIRED_MESSAGE),
});

export const signUpAccountSchema = z
  .object({
    email: z.string().min(1, EMAIL_REQUIRED_MESSAGE).regex(signUpEmail, EMAIL_INVALID_MESSAGE),
    password: z.string().min(8, PASSWORD_TOO_SHORT_MESSAGE),
    confirmPassword: z.string().min(1, CONFIRM_PASSWORD_REQUIRED_MESSAGE),
  })
  .refine(passwordsMatch, mismatchIssue);

export const signUpProfileSchema = z.object({
  full_name: z.string().trim().min(1, FULL_NAME_REQUIRED_MESSAGE),
  phone: z.string().min(1, PHONE_REQUIRED_MESSAGE).regex(vietnamPhone, PHONE_INVALID_MESSAGE),
  gender: z.enum(GENDERS),
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, FORGOT_EMAIL_REQUIRED_MESSAGE).regex(signUpEmail, EMAIL_INVALID_MESSAGE),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, PASSWORD_TOO_SHORT_MESSAGE),
    confirmPassword: z.string().min(1, CONFIRM_PASSWORD_REQUIRED_MESSAGE),
  })
  .refine(passwordsMatch, mismatchIssue);

export type SignInValues = z.output<typeof signInSchema>;
export type SignUpAccountValues = z.output<typeof signUpAccountSchema>;
export type SignUpProfileInput = z.input<typeof signUpProfileSchema>;
export type SignUpProfileValues = z.output<typeof signUpProfileSchema>;
export type ForgotPasswordValues = z.output<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.output<typeof resetPasswordSchema>;
