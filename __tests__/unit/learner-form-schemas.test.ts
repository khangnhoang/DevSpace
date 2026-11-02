import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMMENT_TOO_LONG_MESSAGE,
  COMMENT_TOO_SHORT_MESSAGE,
  NOTE_CONTENT_MESSAGE,
  PROFILE_DOB_MESSAGE,
  REVIEW_CONTENT_MESSAGE,
  REVIEW_RATING_MESSAGE,
  commentSchema,
  noteSchema,
  profileSchema,
  reviewSchema,
} from "@/lib/schemas/learner-forms";
import { GENDER_OPTIONS, PROVINCES } from "@/lib/constants";

function messagesOf(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  if (result.success) throw new Error("expected the schema to refuse the value");
  return result.error!.issues.map((issue) => issue.message);
}

describe("profileSchema", () => {
  it("accepts a filled profile and keeps the values", () => {
    const value = { full_name: "Nguyễn Văn A", gender: "male", province: "Hà Nội", dob: "2000-02-29" };
    expect(profileSchema.parse(value)).toEqual(value);
  });

  it("stores blank name, gender, province and date of birth as null (AF-P4)", () => {
    expect(profileSchema.parse({ full_name: "", gender: "", province: "", dob: "" })).toEqual({
      full_name: null,
      gender: null,
      province: null,
      dob: null,
    });
  });

  it("trims the text and treats whitespace only as blank", () => {
    expect(profileSchema.parse({ full_name: "  Lê Minh  ", gender: "   ", province: "\t", dob: " " })).toEqual({
      full_name: "Lê Minh",
      gender: null,
      province: null,
      dob: null,
    });
  });

  it.each(GENDER_OPTIONS.map((option) => option.value))("accepts the listed gender %s", (gender) => {
    expect(profileSchema.parse({ full_name: "A", gender, province: "", dob: "" }).gender).toBe(gender);
  });

  it("accepts every listed province", () => {
    for (const province of PROVINCES) {
      expect(profileSchema.parse({ full_name: "A", gender: "", province, dob: "" }).province).toBe(province);
    }
  });

  it("accepts a legacy gender and province that are not in the lists, and a very long name", () => {
    const legacy = { full_name: "x".repeat(500), gender: "Nam", province: "TP. Hồ Chí Minh (cũ)", dob: "1999-12-31" };
    expect(profileSchema.parse(legacy)).toEqual(legacy);
  });

  it.each(["31/12/1999", "1999-13-01", "1999-02-30", "not a date", "1999-1-1"])(
    "refuses the date of birth %s with the field message",
    (dob) => {
      expect(messagesOf(profileSchema.safeParse({ full_name: "", gender: "", province: "", dob }))).toEqual([PROFILE_DOB_MESSAGE]);
    },
  );
});

describe("reviewSchema", () => {
  it.each([1, 2, 3, 4, 5])("accepts the rating %i with any non-blank text and trims it", (rating) => {
    expect(reviewSchema.parse({ rating, content: "  Khóa học rất hay  " })).toEqual({ rating, content: "Khóa học rất hay" });
  });

  it("accepts a very long review", () => {
    const content = "a".repeat(20_000);
    expect(reviewSchema.parse({ rating: 5, content }).content).toBe(content);
  });

  it.each(["", "   ", "\n\t "])("refuses blank text %j", (content) => {
    expect(messagesOf(reviewSchema.safeParse({ rating: 5, content }))).toEqual([REVIEW_CONTENT_MESSAGE]);
  });

  it.each([0, 6, -1, 2.5, "5", null, Number.NaN])("refuses the rating %j", (rating) => {
    expect(messagesOf(reviewSchema.safeParse({ rating, content: "ok" }))).toEqual([REVIEW_RATING_MESSAGE]);
  });
});

describe("commentSchema", () => {
  it("accepts 3 characters, and 999 after trim", () => {
    expect(commentSchema.parse({ content: "abc" }).content).toBe("abc");
    expect(commentSchema.parse({ content: ` ${"x".repeat(999)} ` }).content).toBe("x".repeat(999));
  });

  it("counts code points like char_length, so 999 emoji pass and 1000 do not", () => {
    expect(commentSchema.safeParse({ content: "😀".repeat(999) }).success).toBe(true);
    expect(messagesOf(commentSchema.safeParse({ content: "😀".repeat(1000) }))).toEqual([COMMENT_TOO_LONG_MESSAGE]);
    expect(messagesOf(commentSchema.safeParse({ content: "😀😀" }))).toEqual([COMMENT_TOO_SHORT_MESSAGE]);
  });

  it.each(["", "  ", "a", "ab", "  ab  "])("refuses %j as too short", (content) => {
    expect(messagesOf(commentSchema.safeParse({ content }))).toEqual([COMMENT_TOO_SHORT_MESSAGE]);
  });

  it("refuses 1000 characters or more", () => {
    expect(messagesOf(commentSchema.safeParse({ content: "x".repeat(1000) }))).toEqual([COMMENT_TOO_LONG_MESSAGE]);
  });

  it("keeps inner line breaks and trims the outside", () => {
    expect(commentSchema.parse({ content: "\n dòng 1\ndòng 2 \n" }).content).toBe("dòng 1\ndòng 2");
  });
});

describe("noteSchema", () => {
  it("accepts any non-blank text, long text included, and trims it", () => {
    expect(noteSchema.parse({ content: "  Nhớ phân biệt let và const.  " }).content).toBe("Nhớ phân biệt let và const.");
    expect(noteSchema.parse({ content: "n".repeat(10_000) }).content).toHaveLength(10_000);
  });

  it.each(["", "   ", "\n"])("refuses blank text %j", (content) => {
    expect(messagesOf(noteSchema.safeParse({ content }))).toEqual([NOTE_CONTENT_MESSAGE]);
  });
});

describe("learner-forms.ts", () => {
  it("imports only zod (AF-U3 AC8), so the server can reuse it", () => {
    const source = readFileSync(join(__dirname, "../../lib/schemas/learner-forms.ts"), "utf8");
    const specifiers = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((match) => match[1]);
    expect(specifiers).toEqual(["zod"]);
  });
});
