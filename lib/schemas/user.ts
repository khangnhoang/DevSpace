import { z } from "zod";
import {
  INVALID_ROLE_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
} from "./parse-failure";

const blankToNull = z.literal("").transform(() => null);

// `password` and `role` come first so that, as before, their messages win when
// several fields are wrong: issues are reported in key order.
export const createUserSchema = z.object({
  password: z
    .string({ error: PASSWORD_TOO_SHORT_MESSAGE })
    .min(8, PASSWORD_TOO_SHORT_MESSAGE),
  role: z.enum(["user", "admin"], { error: INVALID_ROLE_MESSAGE }),
  email: z.string().trim().pipe(z.email()),
  fullName: z.string().trim().pipe(blankToNull.or(z.string())),
  avatarUrl: z
    .string()
    .trim()
    .pipe(blankToNull.or(z.url({ protocol: /^https?$/ }))),
});

export const userIdSchema = z.uuid();

export type CreateUserInput = z.input<typeof createUserSchema>;
export type UserId = z.input<typeof userIdSchema>;
