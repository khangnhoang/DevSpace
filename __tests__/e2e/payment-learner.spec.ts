// Test plan
// Goal: describe the current payment and coupon flow as the learner and a hostile client see it.
// Layer: e2e (the e2e server on the local stack). PF rows drive the course page and its payment modal; H rows post
//   straight to the server action endpoints (D24); K4 and K5 are known bugs.
// Subject: app/action/payment.ts (createPendingPayment, updatePaymentWithCoupon, cancelPayment, approvePayment,
//   rejectPayment as a non-admin), CoursePaymentModal and the course page.
// Allowed paths: the learner buys the paid course, applies a coupon, cancels or confirms their payment.
// Denied paths: no session; another user's order; a non-admin approving or rejecting; a cancelled order; an
//   unknown course.
// Known bugs: P6 (K4) a coupon use is never counted; P5 (K5) createPendingPayment discounts by a code the UI
//   never sends.
// Invariants: payments are created and changed only through the actions as the right actor (G8); the service
//   role prepares coupon fixtures, reads state back and cleans up; no row records a mail.
import { IDS, authFile } from "./accounts";
import { expect, test } from "./fixtures";
import { knownBugE2e } from "./known-bug";
import {
  PAID_COURSE_NAME,
  createLearnerOrder,
  modalAmount,
  money,
  openPaymentModal,
  paymentActions,
} from "./payment-helpers";
import {
  SEED_COUPON,
  assertPaymentFixturesClean,
  couponUsedCount,
  createCouponFixture,
  learnerEnrollmentCount,
  paymentById,
  paymentsOf,
  restorePaymentFixtures,
} from "./service-role";

test.use({ storageState: authFile("learner") });

test.beforeEach(async () => {
  await assertPaymentFixturesClean();
});

// G5: restore everything the row wrote, even when it failed, and prove no row of this file sent a mail.
test.afterEach(async ({ serverRecords }) => {
  try {
    expect(serverRecords.mailsSent(), "no row of this file approves an order").toEqual([]);
  } finally {
    await restorePaymentFixtures();
  }
});

const learnerOrders = () => paymentsOf(IDS.learner);

test.describe("buying the paid course through the page", () => {
  test("[PF1] pressing the buy button opens the modal with the full price and creates one pending order", async ({ page }) => {
    await openPaymentModal(page);

    await expect(page.getByRole("heading", { level: 2, name: new RegExp(PAID_COURSE_NAME, "i") })).toBeVisible();
    await expect(modalAmount(page)).toContainText(money("199000"));
    expect(await learnerOrders()).toMatchObject([{ course_id: 2, amount: 199000, status: "pending" }]);
  });

  test("[PF2] reloading the page shows the order as waiting and still holds one pending order", async ({ page }) => {
    await openPaymentModal(page);
    await page.reload();

    const waiting = page.getByRole("button", { name: "Đang chờ duyệt thanh toán..." });
    await expect(waiting).toBeVisible();
    await expect(waiting).toBeDisabled();
    expect(await learnerOrders()).toMatchObject([{ course_id: 2, amount: 199000, status: "pending" }]);
  });

  test("[PF3] applying LOCAL10 shows the discounted price and stores it on the order", async ({ page }) => {
    await openPaymentModal(page);
    await page.getByPlaceholder("Nhập mã (VD: SV2025)").fill(SEED_COUPON);
    await page.getByRole("button", { name: "Áp dụng" }).click();

    await expect(page.getByText("Đã áp dụng mã!")).toBeVisible();
    await expect(modalAmount(page)).toContainText(money("179100"));
    expect(await learnerOrders()).toMatchObject([{ amount: 179100, status: "pending" }]);
  });

  test("[PF4] an unknown code is refused and leaves the full price", async ({ page }) => {
    await openPaymentModal(page);
    await page.getByPlaceholder("Nhập mã (VD: SV2025)").fill("NOSUCHCODE");
    await page.getByRole("button", { name: "Áp dụng" }).click();

    await expect(page.getByText("Mã giảm giá không tồn tại hoặc đã hết hạn")).toBeVisible();
    expect(await learnerOrders()).toMatchObject([{ amount: 199000, status: "pending" }]);
  });

  test("[PF5] an inactive code is refused with the same message and leaves the full price", async ({ page }) => {
    await createCouponFixture({ code: "E2E-INACTIVE", discount_percent: 50, max_uses: 10, used_count: 0, is_active: false });
    await openPaymentModal(page);
    await page.getByPlaceholder("Nhập mã (VD: SV2025)").fill("E2E-INACTIVE");
    await page.getByRole("button", { name: "Áp dụng" }).click();

    await expect(page.getByText("Mã giảm giá không tồn tại hoặc đã hết hạn")).toBeVisible();
    expect(await learnerOrders()).toMatchObject([{ amount: 199000, status: "pending" }]);
  });

  test("[PF6] an exhausted code is refused and leaves the full price", async ({ page }) => {
    await createCouponFixture({ code: "E2E-EXHAUSTED", discount_percent: 50, max_uses: 1, used_count: 1, is_active: true });
    await openPaymentModal(page);
    await page.getByPlaceholder("Nhập mã (VD: SV2025)").fill("E2E-EXHAUSTED");
    await page.getByRole("button", { name: "Áp dụng" }).click();

    await expect(page.getByText("Mã này đã hết lượt sử dụng")).toBeVisible();
    expect(await learnerOrders()).toMatchObject([{ amount: 199000, status: "pending" }]);
  });

  test("[PF7] a code without a use limit is applied", async ({ page }) => {
    await createCouponFixture({ code: "E2E-UNLIMITED", discount_percent: 50, max_uses: null, used_count: 0, is_active: true });
    await openPaymentModal(page);
    await page.getByPlaceholder("Nhập mã (VD: SV2025)").fill("E2E-UNLIMITED");
    await page.getByRole("button", { name: "Áp dụng" }).click();

    await expect(page.getByText("Đã áp dụng mã!")).toBeVisible();
    await expect(modalAmount(page)).toContainText(money("99500"));
    expect(await learnerOrders()).toMatchObject([{ amount: 99500, status: "pending" }]);
  });

  test("[PF8] the cancel button cancels the order", async ({ page }) => {
    await openPaymentModal(page);
    await page.getByRole("button", { name: "Hủy bỏ" }).click();

    await expect(page.getByText("Đã hủy giao dịch")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Thanh toán khóa học" })).toBeHidden();
    expect(await learnerOrders()).toMatchObject([{ amount: 199000, status: "failed" }]);
  });

  test("[PF9] confirming the payment closes the modal and leaves the order pending", async ({ page }) => {
    await openPaymentModal(page);
    await page.getByRole("button", { name: "Tôi đã thanh toán" }).click();

    // The modal waits 1.5 s before it confirms; the toast is the signal, not a sleep.
    await expect(page.getByText("Đã gửi xác nhận thanh toán!")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Thanh toán khóa học" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Đang chờ duyệt thanh toán..." })).toBeVisible();
    expect(await learnerOrders()).toMatchObject([{ amount: 199000, status: "pending" }]);
  });
});

test.describe("calling the payment actions directly", () => {
  test("[H1] an anonymous client cannot create an order", async ({ callAction }) => {
    const actions = paymentActions(callAction);

    expect(await actions.createPendingPayment("anon", 2)).toEqual({ error: "Bạn chưa đăng nhập" });
    expect(await learnerOrders()).toEqual([]);
  });

  test("[H2] creating an order twice returns the same pending order", async ({ callAction }) => {
    const actions = paymentActions(callAction);

    const first = await actions.createPendingPayment("learner", 2);
    const second = await actions.createPendingPayment("learner", 2);

    expect(first).toMatchObject({ success: true, amount: 199000 });
    expect(first.isResumed).toBeUndefined();
    expect(second).toMatchObject({ success: true, paymentId: first.paymentId, isResumed: true });
    expect(await learnerOrders()).toHaveLength(1);
  });

  test("[H3] a learner cannot apply a coupon to the admin's order", async ({ callAction }) => {
    const actions = paymentActions(callAction);
    const adminOrder = await actions.createPendingPayment("admin", 2);
    expect(adminOrder).toMatchObject({ success: true, amount: 199000 });
    const adminOrderId = adminOrder.paymentId!;

    expect(await actions.updatePaymentWithCoupon("learner", adminOrderId, SEED_COUPON)).toEqual({ error: "Đơn hàng không hợp lệ" });
    expect(await paymentById(adminOrderId)).toMatchObject({ user_id: IDS.admin, amount: 199000, status: "pending" });
  });

  test("[H4] a learner cannot cancel the admin's order", async ({ callAction }) => {
    const actions = paymentActions(callAction);
    const adminOrderId = (await actions.createPendingPayment("admin", 2)).paymentId!;

    expect(await actions.cancelPayment("learner", adminOrderId)).toEqual({ error: "Không thể hủy giao dịch này" });
    expect(await paymentById(adminOrderId)).toMatchObject({ user_id: IDS.admin, status: "pending" });
  });

  test("[H5] a learner cannot approve or reject their own order", async ({ callAction, serverRecords }) => {
    const actions = paymentActions(callAction);
    const orderId = await createLearnerOrder(actions);

    const approved = await actions.approvePayment("learner", orderId);
    const rejected = await actions.rejectPayment("learner", orderId);

    expect(approved).toEqual({ error: "Không có quyền truy cập" });
    expect(rejected).toEqual({ error: "Không có quyền truy cập" });
    expect(await paymentById(orderId)).toMatchObject({ user_id: IDS.learner, status: "pending" });
    expect(await learnerEnrollmentCount(2)).toBe(0);
    expect(serverRecords.mailsSent()).toEqual([]);
  });

  test("[H6] a cancelled order cannot take a coupon", async ({ callAction }) => {
    const actions = paymentActions(callAction);
    const orderId = await createLearnerOrder(actions);
    expect(await actions.cancelPayment("learner", orderId)).toEqual({ success: true });

    expect(await actions.updatePaymentWithCoupon("learner", orderId, SEED_COUPON)).toEqual({ error: "Đơn hàng không hợp lệ" });
    expect(await paymentById(orderId)).toMatchObject({ amount: 199000, status: "failed" });
  });

  test("[H7] an unknown course creates no order", async ({ callAction }) => {
    const actions = paymentActions(callAction);

    expect(await actions.createPendingPayment("learner", 9999)).toEqual({ error: "Khóa học không tồn tại" });
    expect(await learnerOrders()).toEqual([]);
  });
});

test.describe("known bugs of the payment flow", () => {
  knownBugE2e("P6", "[K4] applying a coupon to an order counts one use of the coupon", async (bug, { callAction }) => {
    const actions = paymentActions(callAction);
    const orderId = await createLearnerOrder(actions);

    const applied = await actions.updatePaymentWithCoupon("learner", orderId, SEED_COUPON);
    expect(applied).toMatchObject({ success: true, newAmount: 179100 });
    expect(await paymentById(orderId)).toMatchObject({ amount: 179100, status: "pending" });

    await bug(async () => expect(await couponUsedCount(SEED_COUPON)).toBe(1));
  });

  knownBugE2e("P5", "[K5] creating an order ignores the coupon parameter", async (bug, { callAction }) => {
    const actions = paymentActions(callAction);

    const created = await actions.createPendingPayment("learner", 2, SEED_COUPON);
    expect(created).toMatchObject({ success: true });
    const orders = await learnerOrders();
    expect(orders).toMatchObject([{ course_id: 2, status: "pending" }]);

    await bug(() => expect(orders[0].amount).toBe(199000));
  });
});
