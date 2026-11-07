// Test plan
// Goal: describe the current payment and coupon flow as the learner and a hostile client see it.
// Layer: e2e (the e2e server on the local stack). PF rows drive the course page and its payment modal; H rows post
//   straight to the server action endpoints (D24).
// Subject: app/action/payment.ts (createPendingPayment, updatePaymentWithCoupon, cancelPayment, approvePayment,
//   rejectPayment as a non-admin), CoursePaymentModal and the course page.
// Allowed paths: the learner buys the paid course, applies a coupon (a use is reserved), switches or repeats a code,
//   cancels or confirms their payment (a cancel releases the use).
// Denied paths: no session; another user's order; a non-admin approving or rejecting; a cancelled order; an
//   unknown, a free or an already owned course; a malformed argument.
// Known bugs: none (SE-P8 to SE-P12 are resolved by SE-U1).
// Invariants: payments are created and changed only through the actions as the right actor (G8); the service
//   role prepares coupon fixtures, reads state back and cleans up; no row records a mail.
//
// Layer audit (QE-U6, AC11, 2026-11-07): the layer each row needs under the e2e rule of test-quality-strategy.
// Boundaries: persistence, refusal (server, database or Auth), failed request, permission, redirect, upload, layout
// (real browser: layout, engine or sandbox). A row that needs two names both; "guard client-only" marks a part a
// component test could cover. "client-only -> <file>" is a QE-F8 move candidate under __tests__/unit/components/.
// The audit changes no row, assertion or timeout.
//   [PF1] persistence: the buy button creates one pending order
//   [PF2] persistence: a reload still shows one pending order
//   [PF3] persistence: LOCAL10 is stored on the order
//   [PF4] refusal: an unknown code leaves the full price
//   [PF5] refusal: an inactive code is refused
//   [PF6] refusal: an exhausted code is refused
//   [PF7] persistence: a code without a use limit is applied
//   [PF8] persistence: the cancel button cancels the order
//   [PF10] persistence: cancelling releases the coupon use
//   [PF11] refusal: a cancel the server refuses shows the error
//   [PF9] persistence: confirming leaves the order pending
//   [H1] permission: an anonymous client cannot create an order
//   [H2] persistence: creating an order twice returns the same order
//   [H3] permission: a learner cannot apply a coupon to another's order
//   [H4] permission: a learner cannot cancel another's order
//   [H5] permission: a learner cannot approve or reject an order
//   [H6] refusal: a cancelled order cannot take a coupon
//   [H7] refusal: an unknown course creates no order
//   [H8] persistence: one coupon use is reserved
//   [H9] refusal: an extra coupon argument is ignored
//   [H10] persistence: switching codes reserves the new use and releases the old
//   [H11] refusal: a refused code keeps the stored coupon
//   [H12] persistence: cancelling releases the use once
//   [H13] refusal: an owner gets no pending order
//   [H14] refusal: a free course gets no pending order
//   [H15] refusal: a malformed argument writes nothing
import { IDS, authFile } from "./accounts";
import { expect, test } from "./fixtures";
import {
  PAID_COURSE_NAME,
  createLearnerOrder,
  modalAmount,
  money,
  openPaymentModal,
  paymentActions,
} from "./payment-helpers";
import {
  FREE_COURSE_ID,
  SEED_COUPON,
  UNKNOWN_COURSE_ID,
  fixtureCode,
  assertPaymentFixturesClean,
  couponUsedCount,
  createCouponFixture,
  learnerEnrollmentCount,
  paymentById,
  paymentsOf,
  studentOrders,
} from "./service-role";

test.use({ storageState: authFile("learner") });

test.beforeEach(async () => {
  await assertPaymentFixturesClean();
});

// The automatic scope owns failure cleanup; these rows must never send an approval mail.
test.afterEach(async ({ serverRecords }) => {
  expect(
    serverRecords.mailsSent(),
    "no row of this file approves an order",
  ).toEqual([]);
});

const learnerOrders = () => paymentsOf(IDS.learner);

test.describe("buying the paid course through the page", () => {
  test("[PF1] pressing the buy button opens the modal with the full price and creates one pending order", async ({
    page,
  }) => {
    await openPaymentModal(page);

    await expect(
      page.getByRole("heading", {
        level: 2,
        name: new RegExp(PAID_COURSE_NAME, "i"),
      }),
    ).toBeVisible();
    await expect(modalAmount(page)).toContainText(money("199000"));
    expect(await learnerOrders()).toMatchObject([
      { course_id: 2, amount: 199000, status: "pending" },
    ]);
  });

  test("[PF2] reloading the page shows the order as waiting and still holds one pending order", async ({
    page,
  }) => {
    await openPaymentModal(page);
    await page.reload();

    const waiting = page.getByRole("button", {
      name: "Đang chờ duyệt thanh toán...",
    });
    await expect(waiting).toBeVisible();
    await expect(waiting).toBeDisabled();
    expect(await learnerOrders()).toMatchObject([
      { course_id: 2, amount: 199000, status: "pending" },
    ]);
  });

  test("[PF3] applying LOCAL10 shows the discounted price and stores it on the order", async ({
    page,
  }) => {
    await openPaymentModal(page);
    await page.getByPlaceholder("Nhập mã (VD: SV2025)").fill(SEED_COUPON);
    await page.getByRole("button", { name: "Áp dụng" }).click();

    await expect(page.getByText("Đã áp dụng mã!")).toBeVisible();
    await expect(modalAmount(page)).toContainText(money("179100"));
    expect(await learnerOrders()).toMatchObject([
      { amount: 179100, status: "pending" },
    ]);
    // The use is reserved when the code is applied (D1).
    expect(await couponUsedCount(SEED_COUPON)).toBe(1);
  });

  test("[PF4] an unknown code is refused and leaves the full price", async ({
    page,
  }) => {
    await openPaymentModal(page);
    await page.getByPlaceholder("Nhập mã (VD: SV2025)").fill("NOSUCHCODE");
    await page.getByRole("button", { name: "Áp dụng" }).click();

    await expect(
      page.getByText("Mã giảm giá không tồn tại hoặc đã hết hạn"),
    ).toBeVisible();
    expect(await learnerOrders()).toMatchObject([
      { amount: 199000, status: "pending" },
    ]);
  });

  test("[PF5] an inactive code is refused with the same message and leaves the full price", async ({
    page,
  }) => {
    await createCouponFixture({
      code: fixtureCode("E2E-INACTIVE"),
      discount_percent: 50,
      max_uses: 10,
      used_count: 0,
      is_active: false,
    });
    await openPaymentModal(page);
    await page
      .getByPlaceholder("Nhập mã (VD: SV2025)")
      .fill(fixtureCode("E2E-INACTIVE"));
    await page.getByRole("button", { name: "Áp dụng" }).click();

    await expect(
      page.getByText("Mã giảm giá không tồn tại hoặc đã hết hạn"),
    ).toBeVisible();
    expect(await learnerOrders()).toMatchObject([
      { amount: 199000, status: "pending" },
    ]);
  });

  test("[PF6] an exhausted code is refused and leaves the full price", async ({
    page,
  }) => {
    await createCouponFixture({
      code: fixtureCode("E2E-EXHAUSTED"),
      discount_percent: 50,
      max_uses: 1,
      used_count: 1,
      is_active: true,
    });
    await openPaymentModal(page);
    await page
      .getByPlaceholder("Nhập mã (VD: SV2025)")
      .fill(fixtureCode("E2E-EXHAUSTED"));
    await page.getByRole("button", { name: "Áp dụng" }).click();

    await expect(page.getByText("Mã này đã hết lượt sử dụng")).toBeVisible();
    expect(await learnerOrders()).toMatchObject([
      { amount: 199000, status: "pending" },
    ]);
  });

  test("[PF7] a code without a use limit is applied", async ({ page }) => {
    await createCouponFixture({
      code: fixtureCode("E2E-UNLIMITED"),
      discount_percent: 50,
      max_uses: null,
      used_count: 0,
      is_active: true,
    });
    await openPaymentModal(page);
    await page
      .getByPlaceholder("Nhập mã (VD: SV2025)")
      .fill(fixtureCode("E2E-UNLIMITED"));
    await page.getByRole("button", { name: "Áp dụng" }).click();

    await expect(page.getByText("Đã áp dụng mã!")).toBeVisible();
    await expect(modalAmount(page)).toContainText(money("99500"));
    expect(await learnerOrders()).toMatchObject([
      { amount: 99500, status: "pending" },
    ]);
  });

  test("[PF8] the cancel button cancels the order", async ({ page }) => {
    await openPaymentModal(page);
    await page.getByRole("button", { name: "Hủy bỏ" }).click();

    await expect(page.getByText("Đã hủy giao dịch")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Thanh toán khóa học" }),
    ).toBeHidden();
    expect(await learnerOrders()).toMatchObject([
      { amount: 199000, status: "failed" },
    ]);
  });

  test("[PF10] cancelling an order that holds LOCAL10 releases its use", async ({
    page,
  }) => {
    await openPaymentModal(page);
    await page.getByPlaceholder("Nhập mã (VD: SV2025)").fill(SEED_COUPON);
    await page.getByRole("button", { name: "Áp dụng" }).click();
    await expect(page.getByText("Đã áp dụng mã!")).toBeVisible();
    expect(await couponUsedCount(SEED_COUPON)).toBe(1);

    await page.getByRole("button", { name: "Hủy bỏ" }).click();

    await expect(page.getByText("Đã hủy giao dịch")).toBeVisible();
    expect(await learnerOrders()).toMatchObject([
      { amount: 179100, status: "failed" },
    ]);
    expect(await couponUsedCount(SEED_COUPON)).toBe(0);
  });

  test("[PF11] a cancel the server refuses shows the error and not the cancelled message", async ({
    page,
    callAction,
  }) => {
    await openPaymentModal(page);
    const [order] = await learnerOrders();
    // The admin rejects the order while the learner still has the modal open.
    expect(
      await paymentActions(callAction).rejectPayment("admin", order.id),
    ).toEqual({ success: true });

    await page.getByRole("button", { name: "Hủy bỏ" }).click();

    await expect(page.getByText("Không thể hủy giao dịch này")).toBeVisible();
    await expect(page.getByText("Đã hủy giao dịch")).toBeHidden();
    expect(await paymentById(order.id)).toMatchObject({ status: "failed" });
  });

  test("[PF9] confirming the payment closes the modal and leaves the order pending", async ({
    page,
  }) => {
    await openPaymentModal(page);
    await page.getByRole("button", { name: "Tôi đã thanh toán" }).click();

    // The modal waits 1.5 s before it confirms; the toast is the signal, not a sleep.
    await expect(page.getByText("Đã gửi xác nhận thanh toán!")).toBeVisible();
    // BL-P8: one toast carries the title and the next step; two stacked toasts hid each other.
    const toasts = page.locator("[data-sonner-toast]");
    await expect(toasts).toHaveCount(1);
    await expect(toasts).toContainText(
      "Vui lòng đợi Admin duyệt trong giây lát.",
    );
    await expect(
      page.getByRole("heading", { name: "Thanh toán khóa học" }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Đang chờ duyệt thanh toán..." }),
    ).toBeVisible();
    expect(await learnerOrders()).toMatchObject([
      { amount: 199000, status: "pending" },
    ]);
  });
});

test.describe("calling the payment actions directly", () => {
  test("[H1] an anonymous client cannot create an order", async ({
    callAction,
  }) => {
    const actions = paymentActions(callAction);

    expect(await actions.createPendingPayment("anon", 2)).toEqual({
      error: "Bạn chưa đăng nhập",
    });
    expect(await learnerOrders()).toEqual([]);
  });

  test("[H2] creating an order twice returns the same pending order", async ({
    callAction,
  }) => {
    const actions = paymentActions(callAction);

    const first = await actions.createPendingPayment("learner", 2);
    const second = await actions.createPendingPayment("learner", 2);

    expect(first).toMatchObject({ success: true, amount: 199000 });
    expect(first.isResumed).toBeUndefined();
    expect(second).toMatchObject({
      success: true,
      paymentId: first.paymentId,
      isResumed: true,
    });
    expect(await learnerOrders()).toHaveLength(1);
    expect(await paymentById(first.paymentId!)).toMatchObject({
      id: first.paymentId,
      user_id: IDS.learner,
      course_id: 2,
      amount: 199000,
      status: "pending",
    });
  });

  test("[H3] a learner cannot apply a coupon to the admin's order", async ({
    callAction,
  }) => {
    const actions = paymentActions(callAction);
    const adminOrder = await actions.createPendingPayment("admin", 2);
    expect(adminOrder).toMatchObject({ success: true, amount: 199000 });
    const adminOrderId = adminOrder.paymentId!;

    expect(
      await actions.updatePaymentWithCoupon(
        "learner",
        adminOrderId,
        SEED_COUPON,
      ),
    ).toEqual({ error: "Đơn hàng không hợp lệ" });
    expect(await paymentById(adminOrderId)).toMatchObject({
      user_id: IDS.admin,
      amount: 199000,
      status: "pending",
    });
  });

  test("[H4] a learner cannot cancel the admin's order", async ({
    callAction,
  }) => {
    const actions = paymentActions(callAction);
    const adminOrderId = (await actions.createPendingPayment("admin", 2))
      .paymentId!;

    expect(await actions.cancelPayment("learner", adminOrderId)).toEqual({
      error: "Không thể hủy giao dịch này",
    });
    expect(await paymentById(adminOrderId)).toMatchObject({
      user_id: IDS.admin,
      status: "pending",
    });
  });

  test("[H5] a learner cannot approve or reject their own order", async ({
    callAction,
    serverRecords,
  }) => {
    const actions = paymentActions(callAction);
    const orderId = await createLearnerOrder(actions);

    const approved = await actions.approvePayment("learner", orderId);
    const rejected = await actions.rejectPayment("learner", orderId);

    expect(approved).toEqual({ error: "Không có quyền truy cập" });
    expect(rejected).toEqual({ error: "Không có quyền truy cập" });
    expect(await paymentById(orderId)).toMatchObject({
      user_id: IDS.learner,
      status: "pending",
    });
    expect(await learnerEnrollmentCount(2)).toBe(0);
    expect(serverRecords.mailsSent()).toEqual([]);
  });

  test("[H6] a cancelled order cannot take a coupon", async ({
    callAction,
  }) => {
    const actions = paymentActions(callAction);
    const orderId = await createLearnerOrder(actions);
    expect(await actions.cancelPayment("learner", orderId)).toEqual({
      success: true,
    });

    expect(
      await actions.updatePaymentWithCoupon("learner", orderId, SEED_COUPON),
    ).toEqual({ error: "Đơn hàng không hợp lệ" });
    expect(await paymentById(orderId)).toMatchObject({
      amount: 199000,
      status: "failed",
    });
  });

  test("[H7] an unknown course creates no order", async ({ callAction }) => {
    const actions = paymentActions(callAction);

    expect(
      await actions.createPendingPayment("learner", UNKNOWN_COURSE_ID),
    ).toEqual({ error: "Khóa học không tồn tại" });
    expect(await learnerOrders()).toEqual([]);
  });

  test("[H8] applying a coupon reserves exactly one use, and the same code again changes no count", async ({
    callAction,
  }) => {
    const actions = paymentActions(callAction);
    const orderId = await createLearnerOrder(actions);

    expect(
      await actions.updatePaymentWithCoupon("learner", orderId, SEED_COUPON),
    ).toMatchObject({ success: true, newAmount: 179100, discountPercent: 10 });
    expect(await paymentById(orderId)).toMatchObject({
      amount: 179100,
      status: "pending",
    });
    expect(await couponUsedCount(SEED_COUPON)).toBe(1);

    expect(
      await actions.updatePaymentWithCoupon(
        "learner",
        orderId,
        " " + SEED_COUPON.toLowerCase() + " ",
      ),
    ).toMatchObject({ success: true, newAmount: 179100 });
    expect(await couponUsedCount(SEED_COUPON)).toBe(1);
  });

  test("[H9] creating an order never discounts: an extra coupon argument is ignored and counts nothing", async ({
    callAction,
  }) => {
    const actions = paymentActions(callAction);

    const created = await actions.createPendingPayment(
      "learner",
      2,
      SEED_COUPON,
    );

    expect(created).toMatchObject({ success: true, amount: 199000 });
    expect(await learnerOrders()).toMatchObject([
      { course_id: 2, amount: 199000, status: "pending", coupon_id: null },
    ]);
    expect(await couponUsedCount(SEED_COUPON)).toBe(0);
  });

  test("[H10] switching to another code reserves the new code and releases the old one", async ({
    callAction,
  }) => {
    const actions = paymentActions(callAction);
    const other = fixtureCode("E2E-SWITCH");
    await createCouponFixture({
      code: other,
      discount_percent: 50,
      max_uses: 5,
      used_count: 0,
      is_active: true,
    });
    const orderId = await createLearnerOrder(actions, SEED_COUPON);
    expect(await couponUsedCount(SEED_COUPON)).toBe(1);

    expect(
      await actions.updatePaymentWithCoupon("learner", orderId, other),
    ).toMatchObject({ success: true, newAmount: 99500, discountPercent: 50 });

    expect(await couponUsedCount(SEED_COUPON)).toBe(0);
    expect(await couponUsedCount(other)).toBe(1);
    expect(await paymentById(orderId)).toMatchObject({
      amount: 99500,
      status: "pending",
    });
  });

  test("[H11] a refused code leaves the stored coupon and its count in place", async ({
    callAction,
  }) => {
    const actions = paymentActions(callAction);
    const orderId = await createLearnerOrder(actions, SEED_COUPON);

    expect(
      await actions.updatePaymentWithCoupon("learner", orderId, "NOSUCHCODE"),
    ).toEqual({ error: "Mã giảm giá không tồn tại hoặc đã hết hạn" });

    expect(await couponUsedCount(SEED_COUPON)).toBe(1);
    expect(await paymentById(orderId)).toMatchObject({
      amount: 179100,
      status: "pending",
    });
  });

  test("[H12] cancelling releases the reserved use once; a second cancel changes nothing", async ({
    callAction,
  }) => {
    const actions = paymentActions(callAction);
    const orderId = await createLearnerOrder(actions, SEED_COUPON);

    expect(await actions.cancelPayment("learner", orderId)).toEqual({
      success: true,
    });
    expect(await couponUsedCount(SEED_COUPON)).toBe(0);
    expect(await actions.cancelPayment("learner", orderId)).toEqual({
      error: "Không thể hủy giao dịch này",
    });
    expect(await couponUsedCount(SEED_COUPON)).toBe(0);
  });

  test("[H13] a learner who already owns the course gets no pending order", async ({
    callAction,
  }) => {
    const actions = paymentActions(callAction);
    const before = await studentOrders();
    expect(before, "the seed payment of the student exists").toHaveLength(1);

    expect(await actions.createPendingPayment("student", 2)).toEqual({
      error: "Bạn đã sở hữu khóa học này",
    });

    expect(await studentOrders()).toEqual(before);
  });

  test("[H14] a free course gets no pending order", async ({ callAction }) => {
    const actions = paymentActions(callAction);

    expect(
      await actions.createPendingPayment("learner", FREE_COURSE_ID),
    ).toEqual({ error: "Khóa học này miễn phí, hãy đăng ký trực tiếp" });

    expect(await learnerOrders()).toEqual([]);
  });

  test("[H15] a malformed argument returns the generic message and writes nothing", async ({
    callAction,
  }) => {
    const actions = paymentActions(callAction);
    const orderId = await createLearnerOrder(actions, SEED_COUPON);
    const GENERIC = { error: "Dữ liệu không hợp lệ." };
    const before = await learnerOrders();
    const post = (name: string, args: unknown[]) =>
      callAction("learner", "app/action/payment.ts", name, args);

    for (const courseId of ["2", -1, 1.5, null]) {
      expect(
        await post("createPendingPayment", [courseId]),
        "course " + JSON.stringify(courseId),
      ).toEqual(GENERIC);
    }
    for (const paymentId of ["1", 0, 1.5, null]) {
      expect(
        await post("cancelPayment", [paymentId]),
        "cancel " + JSON.stringify(paymentId),
      ).toEqual(GENERIC);
      expect(
        await post("updatePaymentWithCoupon", [paymentId, SEED_COUPON]),
        "apply " + JSON.stringify(paymentId),
      ).toEqual(GENERIC);
    }
    for (const code of ["   ", "", 5, null, "X".repeat(65)]) {
      expect(
        await post("updatePaymentWithCoupon", [orderId, code]),
        "code " + JSON.stringify(code),
      ).toEqual(GENERIC);
    }

    expect(await learnerOrders()).toEqual(before);
    expect(await couponUsedCount(SEED_COUPON)).toBe(1);
  });
});
