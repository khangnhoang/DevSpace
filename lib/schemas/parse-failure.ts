import type { ZodError } from "zod";

export const INVALID_INPUT_MESSAGE = "Dữ liệu không hợp lệ.";
export const PASSWORD_TOO_SHORT_MESSAGE = "Mật khẩu phải có ít nhất 8 ký tự";
export const INVALID_ROLE_MESSAGE = "Vai trò không hợp lệ";
export const CONTENT_TOO_SHORT_MESSAGE = "Nội dung quá ngắn (cần > 50 ký tự).";

// The messages the admin pages already show; every other issue is generic so that
// a caller never sees Zod's wording, a path or the rejected input.
const KEPT_MESSAGES = new Set([
  PASSWORD_TOO_SHORT_MESSAGE,
  INVALID_ROLE_MESSAGE,
  CONTENT_TOO_SHORT_MESSAGE,
]);

export function parseFailure(error: ZodError): string {
  const message = error.issues[0]?.message;
  return message && KEPT_MESSAGES.has(message) ? message : INVALID_INPUT_MESSAGE;
}
