import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { join } from "node:path";
import { readLocalStack, type LocalStack } from "../helpers/local-stack";
import { FixtureScope, checked as must, userExists as checkUserExists } from "../helpers/fixture-ownership";
import { inheritedRun } from "../helpers/run-ownership.mjs";
import { IDS } from "./accounts";

let client: SupabaseClient | undefined;
let active: FixtureScope | undefined;
let local: LocalStack | undefined;
function localStack() { return local ??= readLocalStack(join(__dirname, "../..")); }
function serviceRole(): SupabaseClient {
  if (!client) {
    const stack = localStack();
    client = createClient(stack.apiUrl, stack.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  return client;
}
export function beginFixtureScope() {
  const stack = localStack();
  const ref = inheritedRun();
  if (new URL(stack.apiUrl).origin.replace("localhost", "127.0.0.1") !== ref.target.api) throw new Error("Fixture target does not match run ownership");
  active = new FixtureScope(ref, serviceRole(), stack.dbUrl);
  return active;
}
function scope() { if (!active) throw new Error("No active fixture scope"); return active; }
export const fixtureCode = (value: string) => scope().code(value);
export const userExists = (id: string) => checkUserExists(serviceRole(), id);
export async function learnerEnrollmentCount(courseId: number): Promise<number> {
  return must(await serviceRole().from("enrollments").select("id").eq("user_id", IDS.learner).eq("course_id", courseId)).length;
}
export async function prepareLearnerEnrollment(courseId: number) {
  const db = serviceRole();
  const course = must(await db.from("courses").select("name,price").eq("id", courseId).single());
  const learner = must(await db.from("profiles").select("full_name").eq("id", IDS.learner).single());
  const admins = must(await db.from("profiles").select("id").eq("role", "admin"));
  if (course.price !== 0 || admins.length !== 1 || admins[0].id !== IDS.admin) throw new Error("Free-enrollment baseline differs");
  const notification = { receiver_id: IDS.admin, actor_id: IDS.learner, type: "enrollment", title: "Đăng ký khóa học mới", message: `${learner.full_name} đã đăng ký khóa học ${course.name}`, link: "/admin" };
  // Every prerequisite precedes acquisition; a failed preflight owns nothing to delete.
  if (await learnerEnrollmentCount(courseId) || must(await db.from("notifications").select("id").match(notification)).length) throw new Error("Free-enrollment fixture slot is occupied");
  await scope().reserve("enrollments", { user_id: IDS.learner, course_id: courseId });
  await scope().reserve("notifications", notification);
}
export async function removeLearnerEnrollment() { await scope().cleanup(); }
export const PAID_COURSE_ID = 2;
export const SEED_PAYMENT_ID = 1;
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
export async function restorePaymentFixtures() { await scope().cleanup(); }
export type Fixture = { id: number; label: string };
async function createFixture(table: string, labelColumn: string, label: string, values: Record<string, unknown>): Promise<Fixture> {
  const actual = scope().label(label);
  await scope().reserve(table, { [labelColumn]: actual });
  const row = must(await serviceRole().from(table).insert({ ...values, [labelColumn]: actual }).select("id").single());
  return { id: row.id, label: actual };
}
export const createCourseFixture = () => createFixture("courses", "name", "E2E Khóa học xóa", { slug: `e2e-course-${scope().tag}`, description: "E2E fixture", price: 0 });
export const createChapterFixture = () => createFixture("chapters", "title", "E2E Chương xóa", { course_id: 1, order_index: 99 });
export const createLessonFixture = () => createFixture("lessons", "title", "E2E Bài học xóa", { course_id: 1, chapter_id: 1, slug: `e2e-lesson-${scope().tag}`, order_index: 99, content: "E2E fixture" });
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
export async function removeE2eFixtures() { await scope().cleanup(); }
