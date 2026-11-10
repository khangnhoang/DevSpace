import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { join } from "node:path";
import pg from "pg";
import { requireActiveRun } from "../../scripts/test-stack/lock.mjs";
import { type LocalStack } from "../helpers/local-stack";
import { readTestStack } from "../../scripts/test-stack/read.mjs";
import {
  FixtureScope,
  checked as must,
  userExists as checkUserExists,
  type RunMarker,
} from "../helpers/fixture-ownership";
import { ACCOUNTS, IDS } from "./accounts";

let client: SupabaseClient | undefined;
let active: FixtureScope | undefined;
let local: LocalStack | undefined;
function localStack() {
  return (local ??= readTestStack(join(__dirname, "../..")));
}
function serviceRole(): SupabaseClient {
  if (!client) {
    const stack = localStack();
    client = createClient(stack.apiUrl, stack.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
export function beginFixtureScope(options?: { run?: RunMarker }) {
  active = new FixtureScope(serviceRole(), localStack().dbUrl, options);
  return active;
}
function scope() {
  if (!active) throw new Error("No active fixture scope");
  return active;
}
export const fixtureCode = (value: string) => scope().code(value);
export const userExists = (id: string) => checkUserExists(serviceRole(), id);
export async function learnerEnrollmentCount(
  courseId: number,
): Promise<number> {
  return must(
    await serviceRole()
      .from("enrollments")
      .select("id")
      .eq("user_id", IDS.learner)
      .eq("course_id", courseId),
  ).length;
}
const enrollmentNotification = (learnerName: string, courseName: string) => ({
  receiver_id: IDS.admin,
  actor_id: IDS.learner,
  type: "enrollment",
  title: "Đăng ký khóa học mới",
  message: `${learnerName} đã đăng ký khóa học ${courseName}`,
  link: "/admin",
});
// The admin notification a free enrollment of course 1 by the learner sends; zero before the enrollment.
export async function learnerEnrollmentNotificationCount(
  courseId: number,
): Promise<number> {
  const db = serviceRole();
  const course = must(
    await db.from("courses").select("name").eq("id", courseId).single(),
  );
  const learner = must(
    await db
      .from("profiles")
      .select("full_name")
      .eq("id", IDS.learner)
      .single(),
  );
  return must(
    await db
      .from("notifications")
      .select("id")
      .match(enrollmentNotification(learner.full_name, course.name)),
  ).length;
}
export async function prepareLearnerEnrollment(courseId: number) {
  const db = serviceRole();
  // The UI resolves this slug and submits its ID; reservations must describe that same course.
  const course = must(
    await db
      .from("courses")
      .select("id,name,price")
      .eq("slug", "lam-quen-voi-html")
      .maybeSingle(),
  );
  if (!course || course.id !== courseId)
    throw new Error("Free-enrollment course identity differs");
  const learner = must(
    await db
      .from("profiles")
      .select("full_name")
      .eq("id", IDS.learner)
      .single(),
  );
  const admins = must(
    await db.from("profiles").select("id").eq("role", "admin"),
  );
  if (course.price !== 0 || admins.length !== 1 || admins[0].id !== IDS.admin)
    throw new Error("Free-enrollment baseline differs");
  if (!learner.full_name)
    throw new Error(
      "Free-enrollment learner name is absent; no resources acquired",
    );
  const notification = enrollmentNotification(learner.full_name, course.name);
  // Every prerequisite precedes acquisition; a failed preflight owns nothing to delete.
  if (
    (await learnerEnrollmentCount(courseId)) ||
    must(await db.from("notifications").select("id").match(notification)).length
  )
    throw new Error("Free-enrollment fixture slot is occupied");
  await scope().reserve("enrollments", {
    user_id: IDS.learner,
    course_id: courseId,
  });
  await scope().reserve("notifications", notification);
}
export async function profileOf(id: string): Promise<{
  role: string;
  full_name: string | null;
  avatar_url: string | null;
}> {
  return must(
    await serviceRole()
      .from("profiles")
      .select("role,full_name,avatar_url")
      .eq("id", id)
      .single(),
  );
}
export async function profileEmailOf(id: string): Promise<string | null> {
  return must(
    await serviceRole().from("profiles").select("email").eq("id", id).single(),
  ).email;
}
// The profile fields the learner-form rows change. The scope restores them on cleanup; the baseline is the seed student
// (the on_auth_user_created trigger copies the name, nothing else is set).
const STUDENT_PROFILE_FIELDS = [
  "full_name",
  "gender",
  "province",
  "dob",
  "avatar_url",
];
export async function acquireStudentProfile() {
  await scope().acquire("profiles", IDS.student, STUDENT_PROFILE_FIELDS, {
    full_name: ACCOUNTS.student.fullName,
    gender: null,
    province: null,
    dob: null,
    avatar_url: null,
  });
}
export type StudentProfile = {
  full_name: string | null;
  gender: string | null;
  province: string | null;
  dob: string | null;
  avatar_url: string | null;
};
export async function studentProfile(): Promise<StudentProfile> {
  return must(
    await serviceRole()
      .from("profiles")
      .select(STUDENT_PROFILE_FIELDS.join(","))
      .eq("id", IDS.student)
      .single(),
  ) as unknown as StudentProfile;
}
// The flat objects of the bucket root plus the student's own folder, where the learner profile uploads since SE-P5.
// A folder entry in the root listing has no id and is not an object, so it is skipped.
export async function avatarObjectNames(): Promise<string[]> {
  const bucket = serviceRole().storage.from("avatars");
  const root = must(await bucket.list("", { limit: 1000 }));
  const folder = must(await bucket.list(IDS.student, { limit: 1000 }));
  return [
    ...root.filter((object) => object.id).map((object) => object.name),
    ...folder
      .filter((object) => object.id)
      .map((object) => `${IDS.student}/${object.name}`),
  ];
}
// An exact-name read: a root or folder listing cannot prove that one named object is absent from another folder.
async function avatarObjectExists(name: string): Promise<boolean> {
  const stack = readTestStack(join(__dirname, "../.."));
  const connection = new pg.Client({
    connectionString: stack.dbUrl,
    application_name: "devspace-avatar-fixture",
  });
  try {
    await connection.connect();
    const result = await connection.query(
      "select 1 from storage.objects where bucket_id = 'avatars' and name = $1",
      [name],
    );
    return result.rowCount === 1;
  } finally {
    await connection.end();
  }
}
// Removes the one Storage object a row uploaded, by the exact name it recorded from its own upload request, and checks
// that it is gone. A shared name pattern would prove no ownership, so with no recorded name nothing is removed and the
// end-of-run audit of storage.objects reports any residue.
export async function removeAvatarObject(
  name: string | undefined,
): Promise<void> {
  if (!name) return;
  requireActiveRun({ command: "npm run test:e2e" });
  must(await serviceRole().storage.from("avatars").remove([name]));
  if (await avatarObjectExists(name))
    throw new Error(`e2e avatar object left in Storage: ${name}`);
}
export const fixtureLabel = (value: string) => scope().label(value);
// The learner-form rows create their rows through the UI, so each reserves the exact selector of the row it expects
// first; the scope deletes whatever the UI wrote under it (a row a rule refused is never created).
const STUDENT_LESSON_ID = 3;
export async function reserveStudentReview() {
  await scope().reserve("reviews", {
    user_id: IDS.student,
    course_id: PAID_COURSE_ID,
  });
}
export async function studentReviews(): Promise<
  { rating: number; content: string }[]
> {
  return must(
    await serviceRole()
      .from("reviews")
      .select("rating,content")
      .match({ user_id: IDS.student, course_id: PAID_COURSE_ID }),
  );
}
export async function reserveStudentComment(content: string) {
  await scope().reserve("comments", {
    user_id: IDS.student,
    lesson_id: STUDENT_LESSON_ID,
    content,
  });
}
export async function studentCommentsWith(content: string): Promise<number> {
  return must(
    await serviceRole()
      .from("comments")
      .select("id")
      .match({ user_id: IDS.student, lesson_id: STUDENT_LESSON_ID, content }),
  ).length;
}
export async function commentContent(id: number): Promise<string> {
  return must(
    await serviceRole()
      .from("comments")
      .select("content")
      .eq("id", id)
      .single(),
  ).content;
}
export async function reserveStudentNote(content: string) {
  await scope().reserve("notes", {
    user_id: IDS.student,
    lesson_id: STUDENT_LESSON_ID,
    content,
  });
}
export async function studentNotesWith(content: string): Promise<number> {
  return must(
    await serviceRole()
      .from("notes")
      .select("id")
      .match({ user_id: IDS.student, lesson_id: STUDENT_LESSON_ID, content }),
  ).length;
}
export async function studentNoteCount(): Promise<number> {
  return must(
    await serviceRole()
      .from("notes")
      .select("id")
      .match({ user_id: IDS.student, lesson_id: STUDENT_LESSON_ID }),
  ).length;
}
export const PAID_COURSE_ID = 2;
export const FREE_COURSE_ID = 1;
export const UNKNOWN_COURSE_ID = 9999;
export const SEED_COUPON = "LOCAL10";
export type PaymentRow = {
  id: number;
  user_id: string;
  course_id: number;
  amount: number;
  status: string;
  coupon_id: number | null;
};
export async function paymentsOf(userId: string): Promise<PaymentRow[]> {
  return must(
    await serviceRole()
      .from("payments")
      .select("id,user_id,course_id,amount,status,coupon_id")
      .eq("user_id", userId)
      .order("id"),
  );
}
export const studentOrders = () => paymentsOf(IDS.student);
export async function paymentById(id: number): Promise<PaymentRow> {
  return must(
    await serviceRole()
      .from("payments")
      .select("id,user_id,course_id,amount,status,coupon_id")
      .eq("id", id)
      .single(),
  );
}
export async function couponUsedCount(code: string): Promise<number> {
  return must(
    await serviceRole()
      .from("coupons")
      .select("used_count")
      .eq("code", code)
      .single(),
  ).used_count;
}
export type CouponFixture = {
  code: string;
  discount_percent: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
};
export async function createCouponFixture(fixture: CouponFixture) {
  await scope().reserve("coupons", { code: fixture.code });
  must(await serviceRole().from("coupons").insert(fixture).select("id"));
}
export async function assertPaymentFixturesClean() {
  const db = serviceRole();
  const course = must(
    await db
      .from("courses")
      .select("id")
      .eq("slug", "javascript-can-ban")
      .maybeSingle(),
  );
  if (!course || course.id !== PAID_COURSE_ID)
    throw new Error("Payment course identity differs");
  if (
    must(await db.from("courses").select("id").eq("id", UNKNOWN_COURSE_ID))
      .length
  )
    throw new Error(
      "Unknown-course fixture ID is occupied; no resources acquired",
    );
  for (const user of [IDS.learner, IDS.admin]) {
    if (
      must(
        await db
          .from("payments")
          .select("id")
          .match({ user_id: user, course_id: PAID_COURSE_ID }),
      ).length
    )
      throw new Error("Payment fixture slot is occupied");
    if (
      must(
        await db
          .from("enrollments")
          .select("id")
          .match({ user_id: user, course_id: PAID_COURSE_ID }),
      ).length
    )
      throw new Error("Enrollment fixture slot is occupied");
  }
  const coupon = must(
    await db
      .from("coupons")
      .select("used_count")
      .eq("code", SEED_COUPON)
      .single(),
  );
  if (coupon.used_count !== 0)
    throw new Error("LOCAL10 baseline differs; no fields acquired");
  for (const user of [IDS.learner, IDS.admin]) {
    await scope().reserve("payments", {
      user_id: user,
      course_id: PAID_COURSE_ID,
    });
    await scope().reserve("enrollments", {
      user_id: user,
      course_id: PAID_COURSE_ID,
    });
  }
  const seed = must(
    await db.from("coupons").select("id").eq("code", SEED_COUPON).single(),
  );
  await scope().acquire("coupons", seed.id, ["used_count"], { used_count: 0 });
}
export type Fixture = { id: number; label: string };
async function createFixture(
  table: string,
  labelColumn: string,
  label: string,
  values: Record<string, unknown>,
): Promise<Fixture> {
  const actual = scope().label(label);
  await scope().reserve(table, { [labelColumn]: actual });
  const row = must(
    await serviceRole()
      .from(table)
      .insert({ ...values, [labelColumn]: actual })
      .select("id")
      .single(),
  );
  return { id: row.id, label: actual };
}
export const createCourseFixture = () =>
  createFixture("courses", "name", "E2E Khóa học xóa", {
    slug: `e2e-course-${scope().tag}`,
    description: "E2E fixture",
    price: 0,
  });
// Free courses without lessons, each with an enrollment of the seed student, so the profile lists more than four courses.
// The scope deletes the enrollments before the courses.
export async function createStudentCourseFixtures(
  count: number,
): Promise<(Fixture & { slug: string })[]> {
  const fixtures: (Fixture & { slug: string })[] = [];
  for (let i = 1; i <= count; i++) {
    const slug = `e2e-profile-${i}-${scope().tag}`;
    const course = await createFixture(
      "courses",
      "name",
      `E2E Khóa học hồ sơ ${i}`,
      { slug, description: "E2E fixture", price: 0 },
    );
    await scope().reserve("enrollments", {
      user_id: IDS.student,
      course_id: course.id,
    });
    must(
      await serviceRole()
        .from("enrollments")
        .insert({ user_id: IDS.student, course_id: course.id })
        .select("id"),
    );
    fixtures.push({ ...course, slug });
  }
  return fixtures;
}
// A free course with one lesson that the seed student has finished and is enrolled in, so its row reads "Hoàn thành".
// The scope deletes the progress, lesson and enrollment before the course.
export async function createCompletedStudentCourseFixture(): Promise<
  Fixture & { lessonSlug: string; slug: string }
> {
  const slug = `e2e-done-${scope().tag}`;
  const course = await createFixture(
    "courses",
    "name",
    "E2E Khóa học hoàn thành",
    { slug, description: "E2E fixture", price: 0 },
  );
  await scope().reserve("enrollments", {
    user_id: IDS.student,
    course_id: course.id,
  });
  must(
    await serviceRole()
      .from("enrollments")
      .insert({ user_id: IDS.student, course_id: course.id })
      .select("id"),
  );
  const lesson = await createLessonFixture({ courseId: course.id });
  await scope().reserve("user_progress", {
    user_id: IDS.student,
    lesson_id: lesson.id,
  });
  must(
    await serviceRole()
      .from("user_progress")
      .insert({ user_id: IDS.student, lesson_id: lesson.id })
      .select("id"),
  );
  return { ...course, slug, lessonSlug: lesson.slug };
}
export const createChapterFixture = () =>
  createFixture("chapters", "title", "E2E Chương xóa", {
    course_id: 1,
    order_index: 99,
  });
// The defaults are the course 1 lesson of the admin delete rows; a row that needs a lesson its student can open passes course 2 (the seed student is enrolled there).
export type LessonFixtureOptions = {
  courseId?: number;
  chapterId?: number;
  content?: string;
  // A lesson with no order, as an admin who left the field blank saved it (AF-U5).
  orderIndex?: number | null;
};
export const createLessonFixture = async ({
  courseId = 1,
  chapterId = 1,
  content = "E2E fixture",
  orderIndex = 99,
}: LessonFixtureOptions = {}) => {
  const slug = `e2e-lesson-${scope().tag}`;
  const fixture = await createFixture("lessons", "title", "E2E Bài học xóa", {
    course_id: courseId,
    chapter_id: chapterId,
    slug,
    order_index: orderIndex,
    content,
  });
  return { ...fixture, slug };
};
export const createExerciseFixture = (lessonId: number) =>
  createFixture("exercises", "question", "E2E Câu hỏi xóa", {
    lesson_id: lessonId,
    option_a: "a",
    option_b: "b",
    option_c: "c",
    option_d: "d",
    correct_answer: "a",
    explanation: "E2E fixture",
  });
export const createCommentFixture = () =>
  createFixture("comments", "content", "E2E bình luận xóa", {
    user_id: IDS.student,
    lesson_id: 3,
  });
// The admin content-form rows (AF-U5) create their rows through the UI, so each reserves the exact name or title first;
// a row that edits a fixture reserves the edited value too, because the scope deletes by selector and the edit moves the row.
export type CourseRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  instructor_id: number | null;
};
const COURSE_COLUMNS = "id,name,slug,description,price,instructor_id";
export async function reserveCourse(name: string) {
  await scope().reserve("courses", { name });
}
export async function coursesNamed(name: string): Promise<CourseRow[]> {
  return must(
    await serviceRole().from("courses").select(COURSE_COLUMNS).eq("name", name),
  );
}
export async function courseById(id: number): Promise<CourseRow> {
  return must(
    await serviceRole()
      .from("courses")
      .select(COURSE_COLUMNS)
      .eq("id", id)
      .single(),
  );
}
export type ChapterRow = {
  id: number;
  course_id: number;
  title: string;
  order_index: number;
};
const CHAPTER_COLUMNS = "id,course_id,title,order_index";
export async function reserveChapter(title: string) {
  await scope().reserve("chapters", { title });
}
export async function chaptersTitled(title: string): Promise<ChapterRow[]> {
  return must(
    await serviceRole()
      .from("chapters")
      .select(CHAPTER_COLUMNS)
      .eq("title", title),
  );
}
export async function chapterById(id: number): Promise<ChapterRow> {
  return must(
    await serviceRole()
      .from("chapters")
      .select(CHAPTER_COLUMNS)
      .eq("id", id)
      .single(),
  );
}
export type LessonRow = {
  id: number;
  title: string;
  slug: string;
  course_id: number;
  chapter_id: number | null;
  video_url: string | null;
  order_index: number | null;
  content: string | null;
};
const LESSON_COLUMNS =
  "id,title,slug,course_id,chapter_id,video_url,order_index,content";
export async function reserveLesson(title: string) {
  await scope().reserve("lessons", { title });
}
export async function lessonsTitled(title: string): Promise<LessonRow[]> {
  return must(
    await serviceRole()
      .from("lessons")
      .select(LESSON_COLUMNS)
      .eq("title", title),
  );
}
export async function lessonById(id: number): Promise<LessonRow> {
  return must(
    await serviceRole()
      .from("lessons")
      .select(LESSON_COLUMNS)
      .eq("id", id)
      .single(),
  );
}
export type ExerciseRow = {
  id: number;
  lesson_id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string | null;
};
const EXERCISE_COLUMNS =
  "id,lesson_id,question,option_a,option_b,option_c,option_d,correct_answer,explanation";
export async function reserveExercise(question: string) {
  await scope().reserve("exercises", { question });
}
export async function exercisesAsking(
  question: string,
): Promise<ExerciseRow[]> {
  return must(
    await serviceRole()
      .from("exercises")
      .select(EXERCISE_COLUMNS)
      .eq("question", question),
  );
}
export async function exerciseById(id: number): Promise<ExerciseRow> {
  return must(
    await serviceRole()
      .from("exercises")
      .select(EXERCISE_COLUMNS)
      .eq("id", id)
      .single(),
  );
}
export async function createUserFixture(variant?: string) {
  const email = `e2e-${scope().tag}${variant ? `-${variant}` : ""}@devspace.test`;
  const label = scope().label("E2E Người dùng xóa");
  await scope().reserveAuth(email);
  const password = "e2e-local-pass-1";
  const { data, error } = await serviceRole().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: label },
  });
  if (error || !data.user)
    throw new Error(`e2e createUser failed: ${error?.message}`);
  return { id: data.user.id, email, label, password };
}
// QE-U6: a free course with `count` reviews, each by its own new user (reviews are unique per user and course), so a
// visitor sees more reviews than one page. The two oldest share a timestamp and sort by descending ID.
// The scope deletes the reviews, then the users and the course.
export async function createCourseWithReviewsFixture(count: number) {
  const slug = `e2e-course-${scope().tag}`;
  const course = await createFixture(
    "courses",
    "name",
    "E2E Khóa học đánh giá",
    {
      slug,
      description: "E2E fixture",
      price: 0,
    },
  );
  const reviews: { content: string; rating: number }[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const user = await createUserFixture(`r${i + 1}`);
    const review = {
      content: scope().label(`E2E đánh giá số ${i + 1}`),
      rating: (i % 5) + 1,
    };
    await scope().reserve("reviews", {
      user_id: user.id,
      course_id: course.id,
    });
    must(
      await serviceRole()
        .from("reviews")
        .insert({
          user_id: user.id,
          course_id: course.id,
          ...review,
          created_at: new Date(
            now - Math.min(i, Math.max(0, count - 2)) * 3_600_000,
          ).toISOString(),
        })
        .select("id"),
    );
    reviews.push(review);
  }
  if (reviews.length >= 2) reviews.push(...reviews.splice(-2).reverse());
  return { ...course, slug, reviews };
}
// The seed student's review of the paid course as it is stored before the row edits it. It is the same selector as
// reserveStudentReview, which the scope deletes.
export async function createStudentReviewFixture(
  rating: number,
  content: string,
) {
  await reserveStudentReview();
  must(
    await serviceRole()
      .from("reviews")
      .insert({
        user_id: IDS.student,
        course_id: PAID_COURSE_ID,
        rating,
        content,
      })
      .select("id"),
  );
}
// QE-U6: a free course the seed student is enrolled in, with one chapter and one lesson that has `exerciseCount`
// four-option questions (question n is answered by option n modulo 4, counting from 0, so the keys differ) and no progress yet, so a
// row sees the progress it causes. The lesson is the only one of the course, which makes it the next unfinished lesson
// the "learn in order" check lets the student open. The scope deletes the progress, exercises, lesson, chapter and
// enrollment before the course.
export async function createLearningCourseFixture(exerciseCount: number) {
  const slug = `e2e-learn-${scope().tag}`;
  const course = await createFixture(
    "courses",
    "name",
    "E2E Khóa học bài tập",
    {
      slug,
      description: "E2E fixture",
      price: 0,
    },
  );
  await scope().reserve("enrollments", {
    user_id: IDS.student,
    course_id: course.id,
  });
  must(
    await serviceRole()
      .from("enrollments")
      .insert({ user_id: IDS.student, course_id: course.id })
      .select("id"),
  );
  const chapter = await createFixture(
    "chapters",
    "title",
    "E2E Chương bài tập",
    {
      course_id: course.id,
      order_index: 1,
    },
  );
  const lessonSlug = `e2e-lesson-${scope().tag}`;
  const lesson = await createFixture(
    "lessons",
    "title",
    "E2E Bài học bài tập",
    {
      course_id: course.id,
      chapter_id: chapter.id,
      slug: lessonSlug,
      order_index: 1,
      content: "E2E fixture",
    },
  );
  const questions: { question: string; options: string[]; correct: number }[] =
    [];
  for (let n = 1; n <= exerciseCount; n++) {
    const options = ["a", "b", "c", "d"].map(
      (letter) => `Lựa chọn ${n}${letter}`,
    );
    const correct = n % 4;
    const exercise = await createFixture(
      "exercises",
      "question",
      `E2E Câu hỏi bài tập ${n}`,
      {
        lesson_id: lesson.id,
        option_a: options[0],
        option_b: options[1],
        option_c: options[2],
        option_d: options[3],
        correct_answer: ["a", "b", "c", "d"][correct],
        explanation: "E2E fixture",
      },
    );
    questions.push({ question: exercise.label, options, correct });
  }
  await scope().reserve("user_progress", {
    user_id: IDS.student,
    lesson_id: lesson.id,
  });
  return { ...course, slug, lessonId: lesson.id, lessonSlug, questions };
}
export async function studentProgressOf(lessonId: number): Promise<number> {
  return must(
    await serviceRole()
      .from("user_progress")
      .select("id")
      .match({ user_id: IDS.student, lesson_id: lessonId }),
  ).length;
}
// QE-U6: unread notifications the admin received, so the header bell has something to read without touching the seed.
// The only seed notification belongs to the student (`SEED_STUDENT_NOTIFICATION_ID`), which a row uses as the untouched
// control for "mark all read". `type` is one of the values the table check allows. The scope deletes them.
export const SEED_STUDENT_NOTIFICATION_ID = 1;
export async function createAdminNotificationFixtures(count: number) {
  const fixtures: { id: number; title: string }[] = [];
  for (let i = 1; i <= count; i++) {
    const title = scope().label(`E2E thông báo ${i}`);
    await scope().reserve("notifications", {
      receiver_id: IDS.admin,
      title,
    });
    const row = must(
      await serviceRole()
        .from("notifications")
        .insert({
          receiver_id: IDS.admin,
          actor_id: IDS.student,
          type: "system",
          title,
          message: `Nội dung của ${title}`,
        })
        .select("id")
        .single(),
    );
    fixtures.push({ id: row.id, title });
  }
  return fixtures;
}
export async function notificationIsRead(id: number): Promise<boolean> {
  return must(
    await serviceRole()
      .from("notifications")
      .select("is_read")
      .eq("id", id)
      .single(),
  ).is_read;
}
// A new address for the sign-up row: the scope deletes the user it creates (the profile row cascades), and a seed user's
// password or profile is never touched.
export async function reserveSignUpEmail() {
  const email = `e2e-signup-${scope().tag}@devspace.test`;
  await scope().reserveAuth(email);
  return email;
}
export const authUsersWithEmail = async (email: string) =>
  (await scope().authIds(email)).length;
export function assertOwnedAuthEmail(email: string) {
  if (
    !scope().entries.some(
      (entry) => entry.kind === "auth" && entry.email === email,
    )
  ) {
    throw new Error(
      "Recovery mailbox requires an exactly reserved Auth recipient",
    );
  }
}

export async function expireFixtureRecovery(user: {
  id: string;
  email: string;
}) {
  requireActiveRun({ command: "npm run test:e2e" });
  assertOwnedAuthEmail(user.email);
  const stack = readTestStack(join(__dirname, "../.."));
  const ids = await scope().authIds(user.email);
  if (ids.length !== 1 || ids[0] !== user.id)
    throw new Error("Recovery fixture ownership mismatch");
  const connection = new pg.Client({
    connectionString: stack.dbUrl,
    application_name: "devspace-recovery-fixture",
  });
  try {
    await connection.connect();
    // GoTrue checks recovery_sent_at against the configured OTP expiry. Age only
    // the exact temporary account, keeping the genuine token and shared settings intact.
    const result = await connection.query(
      "update auth.users set recovery_sent_at = '2000-01-01T00:00:00Z' where id = $1 and email = $2 and recovery_sent_at is not null and recovery_token <> ''",
      [user.id, user.email],
    );
    if (result.rowCount !== 1)
      throw new Error("No issued fixture recovery token to expire");
  } finally {
    await connection.end();
  }
}
export async function profileOfEmail(email: string): Promise<{
  full_name: string | null;
  phone: string | null;
  gender: string | null;
}> {
  return must(
    await serviceRole()
      .from("profiles")
      .select("full_name,phone,gender")
      .eq("email", email)
      .single(),
  );
}
export async function rowExists(
  table: "courses" | "chapters" | "lessons" | "exercises",
  id: number,
) {
  return (
    must(await serviceRole().from(table).select("id").eq("id", id)).length > 0
  );
}
export async function commentDeletedAt(id: number): Promise<string | null> {
  return must(
    await serviceRole()
      .from("comments")
      .select("deleted_at")
      .eq("id", id)
      .single(),
  ).deleted_at;
}
