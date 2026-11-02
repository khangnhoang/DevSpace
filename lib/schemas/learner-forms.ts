import { z } from "zod";

// Client-side Zod is a UX layer (app-foundation master plan, decision 1): the writes still go through the
// browser Supabase client and RLS stays the enforcement. These schemas therefore refuse only what the database
// already refuses or what is blank, and never a value the forms send today (AF-U3 plan, AC7).
const blankToNull = z.literal("").transform(() => null);

const optionalText = z.string().trim().pipe(blankToNull.or(z.string()));

export const PROFILE_DOB_MESSAGE = "Ngày sinh không hợp lệ";
export const REVIEW_RATING_MESSAGE = "Vui lòng chọn số sao từ 1 đến 5";
export const REVIEW_CONTENT_MESSAGE = "Vui lòng nhập nội dung đánh giá";
export const COMMENT_TOO_SHORT_MESSAGE = "Bình luận cần ít nhất 3 ký tự";
export const COMMENT_TOO_LONG_MESSAGE = "Bình luận chỉ được dưới 1000 ký tự";
export const NOTE_CONTENT_MESSAGE = "Vui lòng nhập nội dung ghi chú";

// Gender and province stay trimmed strings, not enums: a stored value outside today's lists must still save.
export const profileSchema = z.object({
  full_name: optionalText,
  gender: optionalText,
  province: optionalText,
  dob: z
    .string()
    .trim()
    .pipe(blankToNull.or(z.iso.date({ error: PROFILE_DOB_MESSAGE }))),
});

export const reviewSchema = z.object({
  rating: z
    .number({ error: REVIEW_RATING_MESSAGE })
    .int(REVIEW_RATING_MESSAGE)
    .min(1, REVIEW_RATING_MESSAGE)
    .max(5, REVIEW_RATING_MESSAGE),
  content: z.string().trim().min(1, REVIEW_CONTENT_MESSAGE),
});

// `comments_content_check`: char_length(trim(content)) > 2 and char_length(content) < 1000. `char_length` counts
// code points and `addComment` and `editComment` store the trimmed text, so the trimmed text is counted by code
// point, not by UTF-16 unit.
export const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .refine((value) => [...value].length >= 3, COMMENT_TOO_SHORT_MESSAGE)
    .refine((value) => [...value].length <= 999, COMMENT_TOO_LONG_MESSAGE),
});

export const noteSchema = z.object({
  content: z.string().trim().min(1, NOTE_CONTENT_MESSAGE),
});

export type ProfileFormInput = z.input<typeof profileSchema>;
export type ProfileFormValues = z.output<typeof profileSchema>;
export type ReviewFormInput = z.input<typeof reviewSchema>;
export type ReviewFormValues = z.output<typeof reviewSchema>;
export type CommentFormInput = z.input<typeof commentSchema>;
export type CommentFormValues = z.output<typeof commentSchema>;
export type NoteFormInput = z.input<typeof noteSchema>;
export type NoteFormValues = z.output<typeof noteSchema>;
