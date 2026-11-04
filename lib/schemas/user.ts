import { z } from "zod";
import {
  INVALID_ROLE_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
} from "./parse-failure";

const INVALID_EMAIL_MESSAGE = "Email không hợp lệ";

const blankToNull = z.literal("").transform(() => null);

// `password` and `role` come first so that, as before, their messages win when
// several fields are wrong: issues are reported in key order.
export const createUserSchema = z.object({
  password: z
    .string({ error: PASSWORD_TOO_SHORT_MESSAGE })
    .min(8, PASSWORD_TOO_SHORT_MESSAGE),
  role: z.enum(["user", "admin"], { error: INVALID_ROLE_MESSAGE }),
  // The message is for the form only: it is not in `parseFailure`'s kept list, so the action still returns the
  // generic one for a bad email.
  email: z
    .string()
    .trim()
    .pipe(z.email({ error: INVALID_EMAIL_MESSAGE })),
  fullName: z.string().trim().pipe(blankToNull.or(z.string())),
  avatarUrl: z
    .string()
    .trim()
    .pipe(blankToNull.or(z.url({ protocol: /^https?$/ }))),
});

export const userIdSchema = z.uuid();

// The forms of /admin/users derive their rules from the action's schema, so client and server cannot drift. The
// create form has no avatar field (the file is uploaded first and its URL is sent beside the form values), and
// the edit form changes only the name and the role.
export const createUserFormSchema = createUserSchema.omit({ avatarUrl: true });
export const editUserFormSchema = createUserSchema.pick({
  fullName: true,
  role: true,
});

export type CreateUserInput = z.input<typeof createUserSchema>;
export type CreateUserFormInput = z.input<typeof createUserFormSchema>;
export type CreateUserFormValues = z.output<typeof createUserFormSchema>;
export type EditUserFormInput = z.input<typeof editUserFormSchema>;
export type EditUserFormValues = z.output<typeof editUserFormSchema>;
export type UserId = z.input<typeof userIdSchema>;
