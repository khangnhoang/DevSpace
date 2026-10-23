// Test plan
// Goal: describe how an admin approves and rejects orders today, in the UI and through the action endpoints.
// Layer: e2e (the e2e server on the local stack). AP rows drive /admin/transactions with its confirm dialogs; K6
//   to K8 are known bugs of approvePayment and rejectPayment (P25).
// Subject: app/action/payment.ts (approvePayment, rejectPayment, getAllPayments), the transactions page and
//   lib/email.server.ts (through the mail record of the e2e server).
// Allowed paths: the admin approves the learner's pending order (enrollment and one mail) or rejects it.
// Denied paths: none here; the non-admin denials are rows H5 of payment-learner.spec.ts.
// Known bugs: P25 (K6, K7, K8) approve and reject act on an order in any state, and approve mails again.
// Invariants: the learner's orders are created through the actions as the learner (G8); the service role only
//   reads state back and cleans up; the mail record is read from the point a row starts.
import type { Page } from "@playwright/test";
import { authFile } from "./accounts";
import { expect, test } from "./fixtures";
import { knownBugE2e } from "./known-bug";
import { FIRST_PAID_LESSON_PATH, PAID_COURSE_NAME, acceptNextDialog, createLearnerOrder, paymentActions, signInAs } from "./payment-helpers";
import {
  SEED_COUPON,
  assertPaymentFixturesClean,
  couponUsedCount,
  learnerEnrollmentCount,
  paymentById,
  restorePaymentFixtures,
} from "./service-role";

test.use({ storageState: authFile("admin") });

test.beforeEach(async () => {
  await assertPaymentFixturesClean();
});

test.afterEach(async () => {
  await restorePaymentFixtures();
});

const LEARNER_EMAIL = "learner@devspace.test";

// The learner's pending order is the only pending row of the table. The page shows "Ẩn danh" for every user (it
// reads `profiles`, the action returns `users`), so the status badge is what tells the row apart.
const pendingRow = (page: Page) => page.getByRole("row").filter({ hasText: "Chờ duyệt" });

test.describe("approving and rejecting through the transactions page", () => {
  test("[AP1] approving the learner's order enrolls them and sends one mail", async ({ page, context, callAction, serverRecords }) => {
    const orderId = await createLearnerOrder(paymentActions(callAction));
    await page.goto("/admin/transactions");

    acceptNextDialog(page);
    await pendingRow(page).getByRole("button", { name: "Duyệt" }).click();

    await expect(page.getByText("Duyệt đơn thành công!")).toBeVisible();
    expect(await paymentById(orderId)).toMatchObject({ amount: 199000, status: "success" });
    expect(await learnerEnrollmentCount(2)).toBe(1);
    const mails = serverRecords.mailsSent();
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe(LEARNER_EMAIL);
    expect(mails[0].subject).toContain(PAID_COURSE_NAME);

    await signInAs(context, "learner");
    await page.goto(FIRST_PAID_LESSON_PATH);
    await expect(page.getByText("Khai báo biến bằng let và const.")).toBeVisible();
  });

  test("[AP2] rejecting the learner's order cancels it without an enrollment or a mail", async ({ page, callAction, serverRecords }) => {
    const orderId = await createLearnerOrder(paymentActions(callAction));
    await page.goto("/admin/transactions");

    acceptNextDialog(page);
    await pendingRow(page).getByRole("button", { name: "Hủy đơn này" }).click();

    await expect(page.getByText("Đã hủy đơn hàng")).toBeVisible();
    expect(await paymentById(orderId)).toMatchObject({ status: "failed" });
    expect(await learnerEnrollmentCount(2)).toBe(0);
    expect(serverRecords.mailsSent()).toEqual([]);
  });

  test("[AP3] approving an order discounted with LOCAL10 keeps the discounted amount and the coupon count", async ({
    page,
    callAction,
    serverRecords,
  }) => {
    const orderId = await createLearnerOrder(paymentActions(callAction), SEED_COUPON);
    const usedBefore = await couponUsedCount(SEED_COUPON);
    await page.goto("/admin/transactions");

    acceptNextDialog(page);
    await pendingRow(page).getByRole("button", { name: "Duyệt" }).click();

    await expect(page.getByText("Duyệt đơn thành công!")).toBeVisible();
    expect(await paymentById(orderId)).toMatchObject({ amount: 179100, status: "success" });
    expect(await couponUsedCount(SEED_COUPON)).toBe(usedBefore);
    expect(serverRecords.mailsSent()).toHaveLength(1);
  });
});

test.describe("known bugs of approving and rejecting", () => {
  knownBugE2e("P25", "[K6] approving the same order in a stale second tab does not mail the learner again", async (bug, { context, page, callAction, serverRecords }) => {
    const orderId = await createLearnerOrder(paymentActions(callAction));
    const secondTab = await context.newPage();
    await page.goto("/admin/transactions");
    await secondTab.goto("/admin/transactions");
    await expect(pendingRow(page)).toBeVisible();
    await expect(pendingRow(secondTab)).toBeVisible();

    acceptNextDialog(page);
    await pendingRow(page).getByRole("button", { name: "Duyệt" }).click();
    await expect(page.getByText("Duyệt đơn thành công!")).toBeVisible();
    expect(await paymentById(orderId)).toMatchObject({ status: "success" });
    expect(serverRecords.mailsSent()).toHaveLength(1);

    // The second tab still shows the order as pending.
    const secondApprove = secondTab.waitForResponse((response) => response.request().method() === "POST");
    acceptNextDialog(secondTab);
    await pendingRow(secondTab).getByRole("button", { name: "Duyệt" }).click();
    expect((await secondApprove).status()).toBe(200);

    await bug(() => expect(serverRecords.mailsSent().filter((mail) => mail.to === LEARNER_EMAIL)).toHaveLength(1));
  });

  knownBugE2e("P25", "[K7] rejecting an approved order leaves it approved", async (bug, { callAction, serverRecords }) => {
    const actions = paymentActions(callAction);
    const orderId = await createLearnerOrder(actions);
    expect(await actions.approvePayment("admin", orderId)).toMatchObject({ success: true });
    expect(serverRecords.mailsSent(), "the setup approval mails the learner").toHaveLength(1);

    // Not the requireAdmin refusal: an admin whose role was lost would leave the order approved for the wrong reason.
    const rejected = await actions.rejectPayment("admin", orderId);
    expect(rejected, "the reject request was not refused for missing admin rights").not.toEqual({ error: "Không có quyền truy cập" });
    expect(typeof rejected, "the reject request got a response").toBe("object");

    await bug(async () => expect((await paymentById(orderId)).status).toBe("success"));
  });

  knownBugE2e("P25", "[K8] approving a cancelled order leaves it cancelled", async (bug, { callAction }) => {
    const actions = paymentActions(callAction);
    const orderId = await createLearnerOrder(actions);
    expect(await actions.cancelPayment("learner", orderId)).toMatchObject({ success: true });
    expect(await learnerEnrollmentCount(2), "the learner has no enrollment before the approval").toBe(0);

    // No approve ran before in this row, so the admin's rights are proved here: a refusal would leave the
    // order cancelled for the wrong reason and pass the bug check.
    const approved = await actions.approvePayment("admin", orderId);
    expect(approved, "the approve request was not refused for missing admin rights").not.toEqual({ error: "Không có quyền truy cập" });
    expect(typeof approved, "the approve request got a response").toBe("object");

    await bug(async () => expect((await paymentById(orderId)).status).toBe("failed"));
  });
});
