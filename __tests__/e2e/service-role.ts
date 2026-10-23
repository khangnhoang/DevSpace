import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { join } from "node:path";
import { readLocalStack } from "../helpers/local-stack";
import { IDS } from "./accounts";

// Service role: bypasses RLS. Only for checking a precondition and for cleanup, never for a request under test.
// The keys come from `npx supabase status` and the host check runs inside readLocalStack.
let client: SupabaseClient | undefined;
function serviceRole(): SupabaseClient {
  if (!client) {
    const stack = readLocalStack(join(__dirname, "../.."));
    client = createClient(stack.apiUrl, stack.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

function must<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(`e2e service-role query failed: ${result.error.message}`);
  return result.data as NonNullable<T>;
}

export async function learnerEnrollmentCount(courseId: number): Promise<number> {
  const rows = must(
    await serviceRole().from("enrollments").select("id").eq("user_id", IDS.learner).eq("course_id", courseId),
  );
  return rows.length;
}

// Removes what enrolling the learner in a free course writes: the enrollment and the admin notifications
// that `enrollCourse` inserts with the learner as actor.
export async function removeLearnerEnrollment(courseId: number): Promise<void> {
  must(await serviceRole().from("enrollments").delete().eq("user_id", IDS.learner).eq("course_id", courseId).select("id"));
  must(await serviceRole().from("notifications").delete().eq("actor_id", IDS.learner).eq("type", "enrollment").select("id"));
}

// ---- Payment rows (infrastructure U5) ----
// A payment in any state but a new pending order is reached through the actions as the right actor (G8), so
// this module only reads payments back, creates coupon fixtures (D26) and cleans up.

export const PAID_COURSE_ID = 2;
export const SEED_PAYMENT_ID = 1;
export const SEED_COUPON = "LOCAL10";

export type PaymentRow = { id: number; user_id: string; course_id: number; amount: number; status: string };

export async function paymentsOf(userId: string): Promise<PaymentRow[]> {
  return must(
    await serviceRole()
      .from("payments")
      .select("id, user_id, course_id, amount, status")
      .eq("user_id", userId)
      .order("id"),
  ) as PaymentRow[];
}

export async function paymentById(id: number): Promise<PaymentRow> {
  return must(
    await serviceRole().from("payments").select("id, user_id, course_id, amount, status").eq("id", id).single(),
  ) as PaymentRow;
}

export async function couponUsedCount(code: string): Promise<number> {
  const row = must(await serviceRole().from("coupons").select("used_count").eq("code", code).single());
  return row.used_count as number;
}

export type CouponFixture = { code: string; discount_percent: number; max_uses: number | null; used_count: number; is_active: boolean };

// The code starts with E2E- so the cleanup can tell a fixture from the seed coupon.
export async function createCouponFixture(fixture: CouponFixture): Promise<void> {
  must(await serviceRole().from("coupons").insert(fixture).select("id"));
}

// What a row needs before it writes: the learner has no payment and no enrollment in the paid course, the
// seed coupon is unused and no coupon fixture is left. A leftover means an earlier run was killed halfway.
export async function assertPaymentFixturesClean(): Promise<void> {
  const leftovers: string[] = [];

  const payments = must(await serviceRole().from("payments").select("id, user_id, status").neq("id", SEED_PAYMENT_ID));
  if (payments.length > 0) leftovers.push(`payments ${JSON.stringify(payments)}`);

  const enrollments = await learnerEnrollmentCount(PAID_COURSE_ID);
  if (enrollments > 0) leftovers.push(`${enrollments} learner enrollment(s) in course ${PAID_COURSE_ID}`);

  const coupons = must(await serviceRole().from("coupons").select("id, code, used_count").order("id"));
  if (coupons.length !== 1 || coupons[0].code !== SEED_COUPON || coupons[0].used_count !== 0) {
    leftovers.push(`coupons ${JSON.stringify(coupons)}`);
  }

  if (leftovers.length > 0) {
    throw new Error(
      `the payment fixtures are not clean: ${leftovers.join("; ")}. Run npx supabase db reset after a killed run.`,
    );
  }
}

// Restores what a payment row may have changed. Payments go first: a later coupon reference would refuse the
// coupon delete.
export async function restorePaymentFixtures(): Promise<void> {
  must(await serviceRole().from("payments").delete().neq("id", SEED_PAYMENT_ID).select("id"));
  must(
    await serviceRole().from("enrollments").delete().eq("user_id", IDS.learner).eq("course_id", PAID_COURSE_ID).select("id"),
  );
  must(await serviceRole().from("coupons").delete().neq("code", SEED_COUPON).select("id"));
  must(await serviceRole().from("coupons").update({ used_count: 0 }).eq("code", SEED_COUPON).select("id"));
}
