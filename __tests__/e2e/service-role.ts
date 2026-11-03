import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { join } from "node:path";
import { type LocalStack } from "../helpers/local-stack";
import { readTestStack } from "../../scripts/test-stack/read.mjs";
import { FixtureScope, checked as must, userExists as checkUserExists, type RunMarker } from "../helpers/fixture-ownership";
import { ACCOUNTS, IDS } from "./accounts";

let client: SupabaseClient | undefined;
let active: FixtureScope | undefined;
let local: LocalStack | undefined;
function localStack() { return local ??= readTestStack(join(__dirname, "../..")); }
function serviceRole(): SupabaseClient {
  if (!client) {
    const stack = localStack();
    client = createClient(stack.apiUrl, stack.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  return client;
}
export function beginFixtureScope(options?: { run?: RunMarker }) {
  active = new FixtureScope(serviceRole(), localStack().dbUrl, options);
  return active;
}
function scope() { if (!active) throw new Error("No active fixture scope"); return active; }
export const fixtureCode = (value: string) => scope().code(value);
export const userExists = (id: string) => checkUserExists(serviceRole(), id);
export async function learnerEnrollmentCount(courseId: number): Promise<number> {
  return must(await serviceRole().from("enrollments").select("id").eq("user_id", IDS.learner).eq("course_id", courseId)).length;
}
const enrollmentNotification = (learnerName: string, courseName: string) => ({ receiver_id: IDS.admin, actor_id: IDS.learner, type: "enrollment", title: "Đăng ký khóa học mới", message: `${learnerName} đã đăng ký khóa học ${courseName}`, link: "/admin" });
// The admin notification a free enrollment of course 1 by the learner sends; zero before the enrollment.
export async function learnerEnrollmentNotificationCount(courseId: number): Promise<number> {
  const db = serviceRole();
  const course = must(await db.from("courses").select("name").eq("id", courseId).single());
  const learner = must(await db.from("profiles").select("full_name").eq("id", IDS.learner).single());
  return must(await db.from("notifications").select("id").match(enrollmentNotification(learner.full_name, course.name))).length;
}
export async function prepareLearnerEnrollment(courseId: number) {
  const db = serviceRole();
  // The UI resolves this slug and submits its ID; reservations must describe that same course.
  const course = must(await db.from("courses").select("id,name,price").eq("slug", "lam-quen-voi-html").maybeSingle());
  if (!course || course.id !== courseId) throw new Error("Free-enrollment course identity differs");
  const learner = must(await db.from("profiles").select("full_name").eq("id", IDS.learner).single());
  const admins = must(await db.from("profiles").select("id").eq("role", "admin"));
  if (course.price !== 0 || admins.length !== 1 || admins[0].id !== IDS.admin) throw new Error("Free-enrollment baseline differs");
  if (!learner.full_name) throw new Error("Free-enrollment learner name is absent; no resources acquired");
  const notification = enrollmentNotification(learner.full_name, course.name);
  // Every prerequisite precedes acquisition; a failed preflight owns nothing to delete.
  if (await learnerEnrollmentCount(courseId) || must(await db.from("notifications").select("id").match(notification)).length) throw new Error("Free-enrollment fixture slot is occupied");
  await scope().reserve("enrollments", { user_id: IDS.learner, course_id: courseId });
  await scope().reserve("notifications", notification);
}
export async function profileOf(id: string): Promise<{ role: string; full_name: string | null; avatar_url: string | null }> {
  return must(await serviceRole().from("profiles").select("role,full_name,avatar_url").eq("id", id).single());
}
// The profile fields the learner-form rows change. The scope restores them on cleanup; the baseline is the seed student
// (the on_auth_user_created trigger copies the name, nothing else is set).
const STUDENT_PROFILE_FIELDS = ["full_name", "gender", "province", "dob", "avatar_url"];
export async function acquireStudentProfile() {
  await scope().acquire("profiles", IDS.student, STUDENT_PROFILE_FIELDS, { full_name: ACCOUNTS.student.fullName, gender: null, province: null, dob: null, avatar_url: null });
}
export type StudentProfile = { full_name: string | null; gender: string | null; province: string | null; dob: string | null; avatar_url: string | null };
export async function studentProfile(): Promise<StudentProfile> {
  return must(await serviceRole().from("profiles").select(STUDENT_PROFILE_FIELDS.join(",")).eq("id", IDS.student).single()) as unknown as StudentProfile;
}
export async function avatarObjectNames(): Promise<string[]> {
  return must(await serviceRole().storage.from("avatars").list("", { limit: 1000 })).map((object) => object.name);
}
// Removes the one Storage object a row uploaded, by the exact name it recorded from its own upload request, and checks
// that it is gone. A shared name pattern would prove no ownership, so with no recorded name nothing is removed and the
// end-of-run audit of storage.objects reports any residue.
export async function removeAvatarObject(name: string | undefined): Promise<void> {
  if (!name) return;
  must(await serviceRole().storage.from("avatars").remove([name]));
  if ((await avatarObjectNames()).includes(name)) throw new Error(`e2e avatar object left in Storage: ${name}`);
}
export const fixtureLabel = (value: string) => scope().label(value);
// The learner-form rows create their rows through the UI, so each reserves the exact selector of the row it expects
// first; the scope deletes whatever the UI wrote under it (a row a rule refused is never created).
const STUDENT_LESSON_ID = 3;
export async function reserveStudentReview() { await scope().reserve("reviews", { user_id: IDS.student, course_id: PAID_COURSE_ID }); }
export async function studentReviews(): Promise<{ rating: number; content: string }[]> {
  return must(await serviceRole().from("reviews").select("rating,content").match({ user_id: IDS.student, course_id: PAID_COURSE_ID }));
}
export async function reserveStudentComment(content: string) { await scope().reserve("comments", { user_id: IDS.student, lesson_id: STUDENT_LESSON_ID, content }); }
export async function studentCommentsWith(content: string): Promise<number> {
  return must(await serviceRole().from("comments").select("id").match({ user_id: IDS.student, lesson_id: STUDENT_LESSON_ID, content })).length;
}
export async function commentContent(id: number): Promise<string> { return must(await serviceRole().from("comments").select("content").eq("id", id).single()).content; }
export async function reserveStudentNote(content: string) { await scope().reserve("notes", { user_id: IDS.student, lesson_id: STUDENT_LESSON_ID, content }); }
export async function studentNotesWith(content: string): Promise<number> {
  return must(await serviceRole().from("notes").select("id").match({ user_id: IDS.student, lesson_id: STUDENT_LESSON_ID, content })).length;
}
export async function studentNoteCount(): Promise<number> {
  return must(await serviceRole().from("notes").select("id").match({ user_id: IDS.student, lesson_id: STUDENT_LESSON_ID })).length;
}
export const PAID_COURSE_ID = 2;
export const UNKNOWN_COURSE_ID = 9999;
export const SEED_COUPON = "LOCAL10";
export type PaymentRow = { id: number; user_id: string; course_id: number; amount: number; status: string };
export async function paymentsOf(userId: string): Promise<PaymentRow[]> {
  return must(await serviceRole().from("payments").select("id,user_id,course_id,amount,status").eq("user_id", userId).order("id"));
}
export async function paymentById(id: number): Promise<PaymentRow> {
  return must(await serviceRole().from("payments").select("id,user_id,course_id,amount,status").eq("id", id).single());
}
export async function couponUsedCount(code: string): Promise<number> {
  return must(await serviceRole().from("coupons").select("used_count").eq("code", code).single()).used_count;
}
export type CouponFixture = { code: string; discount_percent: number; max_uses: number | null; used_count: number; is_active: boolean };
export async function createCouponFixture(fixture: CouponFixture) {
  await scope().reserve("coupons", { code: fixture.code });
  must(await serviceRole().from("coupons").insert(fixture).select("id"));
}
export async function assertPaymentFixturesClean() {
  const db = serviceRole();
  const course = must(await db.from("courses").select("id").eq("slug", "javascript-can-ban").maybeSingle());
  if (!course || course.id !== PAID_COURSE_ID) throw new Error("Payment course identity differs");
  if (must(await db.from("courses").select("id").eq("id", UNKNOWN_COURSE_ID)).length) throw new Error("Unknown-course fixture ID is occupied; no resources acquired");
  for (const user of [IDS.learner, IDS.admin]) {
    if (must(await db.from("payments").select("id").match({ user_id: user, course_id: PAID_COURSE_ID })).length) throw new Error("Payment fixture slot is occupied");
    if (must(await db.from("enrollments").select("id").match({ user_id: user, course_id: PAID_COURSE_ID })).length) throw new Error("Enrollment fixture slot is occupied");
  }
  const coupon = must(await db.from("coupons").select("used_count").eq("code", SEED_COUPON).single());
  if (coupon.used_count !== 0) throw new Error("LOCAL10 baseline differs; no fields acquired");
  for (const user of [IDS.learner, IDS.admin]) {
    await scope().reserve("payments", { user_id: user, course_id: PAID_COURSE_ID });
    await scope().reserve("enrollments", { user_id: user, course_id: PAID_COURSE_ID });
  }
  const seed = must(await db.from("coupons").select("id").eq("code", SEED_COUPON).single());
  await scope().acquire("coupons", seed.id, ["used_count"], { used_count: 0 });
}
export type Fixture = { id: number; label: string };
async function createFixture(table: string, labelColumn: string, label: string, values: Record<string, unknown>): Promise<Fixture> {
  const actual = scope().label(label);
  await scope().reserve(table, { [labelColumn]: actual });
  const row = must(await serviceRole().from(table).insert({ ...values, [labelColumn]: actual }).select("id").single());
  return { id: row.id, label: actual };
}
export const createCourseFixture = () => createFixture("courses", "name", "E2E Khóa học xóa", { slug: `e2e-course-${scope().tag}`, description: "E2E fixture", price: 0 });
// Free courses without lessons, each with an enrollment of the seed student, so the profile lists more than four courses.
// The scope deletes the enrollments before the courses.
export async function createStudentCourseFixtures(count: number): Promise<(Fixture & { slug: string })[]> {
  const fixtures: (Fixture & { slug: string })[] = [];
  for (let i = 1; i <= count; i++) {
    const slug = `e2e-profile-${i}-${scope().tag}`;
    const course = await createFixture("courses", "name", `E2E Khóa học hồ sơ ${i}`, { slug, description: "E2E fixture", price: 0 });
    await scope().reserve("enrollments", { user_id: IDS.student, course_id: course.id });
    must(await serviceRole().from("enrollments").insert({ user_id: IDS.student, course_id: course.id }).select("id"));
    fixtures.push({ ...course, slug });
  }
  return fixtures;
}
// A free course with one lesson that the seed student has finished and is enrolled in, so its row reads "Hoàn thành".
// The scope deletes the progress, lesson and enrollment before the course.
export async function createCompletedStudentCourseFixture(): Promise<Fixture & { lessonSlug: string; slug: string }> {
  const slug = `e2e-done-${scope().tag}`;
  const course = await createFixture("courses", "name", "E2E Khóa học hoàn thành", { slug, description: "E2E fixture", price: 0 });
  await scope().reserve("enrollments", { user_id: IDS.student, course_id: course.id });
  must(await serviceRole().from("enrollments").insert({ user_id: IDS.student, course_id: course.id }).select("id"));
  const lesson = await createLessonFixture({ courseId: course.id });
  await scope().reserve("user_progress", { user_id: IDS.student, lesson_id: lesson.id });
  must(await serviceRole().from("user_progress").insert({ user_id: IDS.student, lesson_id: lesson.id }).select("id"));
  return { ...course, slug, lessonSlug: lesson.slug };
}
export const createChapterFixture = () => createFixture("chapters", "title", "E2E Chương xóa", { course_id: 1, order_index: 99 });
// The defaults are the course 1 lesson of the admin delete rows; a row that needs a lesson its student can open passes course 2 (the seed student is enrolled there).
export type LessonFixtureOptions = { courseId?: number; chapterId?: number; content?: string };
export const createLessonFixture = async ({ courseId = 1, chapterId = 1, content = "E2E fixture" }: LessonFixtureOptions = {}) => {
  const slug = `e2e-lesson-${scope().tag}`;
  const fixture = await createFixture("lessons", "title", "E2E Bài học xóa", { course_id: courseId, chapter_id: chapterId, slug, order_index: 99, content });
  return { ...fixture, slug };
};
export const createExerciseFixture = (lessonId: number) => createFixture("exercises", "question", "E2E Câu hỏi xóa", { lesson_id: lessonId, option_a: "a", option_b: "b", option_c: "c", option_d: "d", correct_answer: "a", explanation: "E2E fixture" });
export const createCommentFixture = () => createFixture("comments", "content", "E2E bình luận xóa", { user_id: IDS.student, lesson_id: 3 });
export async function createUserFixture() {
  const email = `e2e-${scope().tag}@devspace.test`;
  const label = scope().label("E2E Người dùng xóa");
  await scope().reserveAuth(email);
  const { data, error } = await serviceRole().auth.admin.createUser({ email, password: "e2e-local-pass-1", email_confirm: true, user_metadata: { full_name: label } });
  if (error || !data.user) throw new Error(`e2e createUser failed: ${error?.message}`);
  return { id: data.user.id, email, label };
}
export async function rowExists(table: "courses" | "chapters" | "lessons" | "exercises", id: number) { return must(await serviceRole().from(table).select("id").eq("id", id)).length > 0; }
export async function commentDeletedAt(id: number): Promise<string | null> { return must(await serviceRole().from("comments").select("deleted_at").eq("id", id).single()).deleted_at; }
