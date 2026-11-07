// Test plan
// Goal: describe how an admin approves and rejects orders today, in the UI and through the action endpoints.
// Layer: e2e (the e2e server on the local stack). AP rows drive /admin/transactions with its confirm dialogs and
//   post straight to the action endpoints for the states the page cannot reach.
// Subject: app/action/payment.ts (approvePayment, rejectPayment, getAllPayments), the transactions page and
//   lib/email.server.ts (through the mail record of the e2e server).
// Allowed paths: the admin approves the learner's pending order (enrollment and one mail) or rejects it (the
//   reserved coupon use is released).
// Denied paths: approving or rejecting an order that is not pending (approved, rejected, cancelled) changes
//   nothing and sends no mail; the non-admin denials are rows H5 of payment-learner.spec.ts.
// Known bugs: none (SE-P10 is resolved by SE-U1).
// Invariants: the learner's orders are created through the actions as the learner (G8); the service role only
//   reads state back and cleans up; the mail record is read from the point a row starts.
//
// Layer audit (QE-U6, AC11, 2026-11-07): the layer each row needs under the e2e rule of test-quality-strategy.
// Boundaries: persistence, refusal (server, database or Auth), failed request, permission, redirect, upload, layout
// (real browser: layout, engine or sandbox). A row that needs two names both; "guard client-only" marks a part a
// component test could cover. "client-only -> <file>" is a QE-F8 move candidate under __tests__/unit/components/.
// The audit changes no row, assertion or timeout.
//   [AP1] persistence: approving enrolls the learner and sends one mail
//   [AP2] persistence: rejecting cancels the order with no enrollment or mail
//   [AP3] persistence: the discounted amount and the coupon count are kept
//   [AP10] persistence: rejecting releases the coupon use
//   [AP4] client-only -> TransactionsPage.test.tsx (cancelling the dialog sends nothing)
//   [AP5] client-only -> TransactionsPage.test.tsx (the dialog stays open and disabled while pending)
//   [AP6] failed request: a reject that fails in transit leaves the order pending
//   [AP7] persistence: a stale second tab does not mail twice
//   [AP8] refusal: rejecting an approved order changes nothing
//   [AP9] refusal: approving a cancelled order changes nothing
//   [AP11] refusal: an unknown order or malformed id changes nothing
import type { Page } from "@playwright/test";
import { authFile } from "./accounts";
import { expect, test } from "./fixtures";
import {
  FIRST_PAID_LESSON_PATH,
  PAID_COURSE_NAME,
  confirmDialog,
  createLearnerOrder,
  paymentActions,
  signInAs,
} from "./payment-helpers";
import {
  SEED_COUPON,
  assertPaymentFixturesClean,
  couponUsedCount,
  learnerEnrollmentCount,
  paymentById,
} from "./service-role";

test.use({ storageState: authFile("admin") });

test.beforeEach(async () => {
  await assertPaymentFixturesClean();
});

const LEARNER_EMAIL = "learner@devspace.test";

// The learner's pending order is the only pending row of the table, so the status badge tells the row apart.
const pendingRow = (page: Page) =>
  page.getByRole("row").filter({ hasText: "Chờ duyệt" });

test.describe("approving and rejecting through the transactions page", () => {
  test("[AP1] approving the learner's order enrolls them and sends one mail", async ({
    page,
    context,
    callAction,
    serverRecords,
  }) => {
    const orderId = await createLearnerOrder(paymentActions(callAction));
    await page.goto("/admin/transactions");

    await pendingRow(page).getByRole("button", { name: "Duyệt" }).click();
    await confirmDialog(page, "Duyệt đơn");

    await expect(page.getByText("Duyệt đơn thành công!")).toBeVisible();
    expect(await paymentById(orderId)).toMatchObject({
      amount: 199000,
      status: "success",
    });
    expect(await learnerEnrollmentCount(2)).toBe(1);
    const mails = serverRecords.mailsSent();
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe(LEARNER_EMAIL);
    expect(mails[0].subject).toContain(PAID_COURSE_NAME);

    await signInAs(context, "learner");
    await page.goto(FIRST_PAID_LESSON_PATH);
    await expect(
      page.getByText("Khai báo biến bằng let và const."),
    ).toBeVisible();
  });

  test("[AP2] rejecting the learner's order cancels it without an enrollment or a mail", async ({
    page,
    callAction,
    serverRecords,
  }) => {
    const orderId = await createLearnerOrder(paymentActions(callAction));
    await page.goto("/admin/transactions");

    await pendingRow(page).getByRole("button", { name: "Hủy đơn này" }).click();
    await confirmDialog(page, "Hủy đơn hàng");

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
    const orderId = await createLearnerOrder(
      paymentActions(callAction),
      SEED_COUPON,
    );
    const usedBefore = await couponUsedCount(SEED_COUPON);
    expect(usedBefore, "applying the code reserved one use").toBe(1);
    await page.goto("/admin/transactions");

    await pendingRow(page).getByRole("button", { name: "Duyệt" }).click();
    await confirmDialog(page, "Duyệt đơn");

    await expect(page.getByText("Duyệt đơn thành công!")).toBeVisible();
    expect(await paymentById(orderId)).toMatchObject({
      amount: 179100,
      status: "success",
    });
    expect(await couponUsedCount(SEED_COUPON)).toBe(usedBefore);
    expect(serverRecords.mailsSent()).toHaveLength(1);
  });

  test("[AP10] rejecting an order that holds LOCAL10 releases its use", async ({
    page,
    callAction,
    serverRecords,
  }) => {
    const orderId = await createLearnerOrder(
      paymentActions(callAction),
      SEED_COUPON,
    );
    expect(await couponUsedCount(SEED_COUPON)).toBe(1);
    await page.goto("/admin/transactions");

    await pendingRow(page).getByRole("button", { name: "Hủy đơn này" }).click();
    await confirmDialog(page, "Hủy đơn hàng");

    await expect(page.getByText("Đã hủy đơn hàng")).toBeVisible();
    expect(await paymentById(orderId)).toMatchObject({
      amount: 179100,
      status: "failed",
    });
    expect(await couponUsedCount(SEED_COUPON)).toBe(0);
    expect(serverRecords.mailsSent()).toEqual([]);
  });

  test("[AP4] cancelling the reject dialog leaves the order pending and sends nothing", async ({
    page,
    callAction,
    serverRecords,
  }) => {
    const orderId = await createLearnerOrder(paymentActions(callAction));
    await page.goto("/admin/transactions");
    // The page loads its orders with an action POST after hydration; arm the recorder once the table is there.
    await expect(pendingRow(page)).toBeVisible();

    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
    await pendingRow(page).getByRole("button", { name: "Hủy đơn này" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    // The dialog names the learner from their profile (BL-P18), not "Ẩn danh".
    await expect(dialog).toContainText("Học viên: Nguyễn Văn Học.");
    await dialog.getByRole("button", { name: "Giữ đơn hàng" }).click();
    await expect(dialog).toBeHidden();

    expect(await paymentById(orderId)).toMatchObject({ status: "pending" });
    await expect(pendingRow(page)).toBeVisible();
    expect(posts).toEqual([]);
    expect(serverRecords.mailsSent()).toEqual([]);
  });

  test("[AP5] the approve dialog stays open and disabled while the action runs", async ({
    page,
    callAction,
    serverRecords,
  }) => {
    const orderId = await createLearnerOrder(paymentActions(callAction));
    await page.goto("/admin/transactions");
    // The orders load by an action POST after hydration; hold only the approve that follows.
    await expect(pendingRow(page)).toBeVisible();

    // Hold the action POST until the test releases it. fallback() (not continue()) passes every request on to the
    // fixture's network guard, which still sees it.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let held = 0;
    await page.route("**/admin/transactions", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      held++;
      await gate;
      return route.fallback();
    });

    await pendingRow(page).getByRole("button", { name: "Duyệt" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    // The confirm label changes while pending, so the button is found by either label.
    const confirm = dialog.getByRole("button", {
      name: /Duyệt đơn|Đang xử lý/,
    });
    await confirm.dblclick();

    await expect(confirm).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "Hủy", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    expect(held, "a double click sent the action once").toBe(1);

    release();
    await expect(page.getByText("Duyệt đơn thành công!")).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(await paymentById(orderId)).toMatchObject({ status: "success" });
    const mails = serverRecords.mailsSent();
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe(LEARNER_EMAIL);
  });

  test("[AP6] a reject that fails in transit shows an error and leaves the order pending", async ({
    page,
    callAction,
    serverRecords,
  }) => {
    const orderId = await createLearnerOrder(paymentActions(callAction));
    await page.goto("/admin/transactions");
    // The orders load by an action POST after hydration; abort only the reject that follows.
    await expect(pendingRow(page)).toBeVisible();

    let aborted = 0;
    await page.route("**/admin/transactions", (route) => {
      if (route.request().method() !== "POST" || aborted > 0)
        return route.fallback();
      aborted++;
      return route.abort();
    });

    await pendingRow(page).getByRole("button", { name: "Hủy đơn này" }).click();
    await confirmDialog(page, "Hủy đơn hàng");

    await expect(
      page.getByText("Không nhận được kết quả từ máy chủ"),
    ).toBeVisible();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(aborted).toBe(1);
    expect(await paymentById(orderId)).toMatchObject({ status: "pending" });
    expect(serverRecords.mailsSent()).toEqual([]);
  });
});

test.describe("approving and rejecting an order that is not pending", () => {
  test("[AP7] approving the same order in a stale second tab does not mail the learner again", async ({
    context,
    page,
    callAction,
    serverRecords,
  }) => {
    const orderId = await createLearnerOrder(paymentActions(callAction));
    const secondTab = await context.newPage();
    await page.goto("/admin/transactions");
    await secondTab.goto("/admin/transactions");
    await expect(pendingRow(page)).toBeVisible();
    await expect(pendingRow(secondTab)).toBeVisible();

    await pendingRow(page).getByRole("button", { name: "Duyệt" }).click();
    await confirmDialog(page, "Duyệt đơn");
    await expect(page.getByText("Duyệt đơn thành công!")).toBeVisible();
    expect(await paymentById(orderId)).toMatchObject({ status: "success" });
    expect(serverRecords.mailsSent()).toHaveLength(1);

    // The second tab still shows the order as pending.
    const secondApprove = secondTab.waitForResponse(
      (response) => response.request().method() === "POST",
    );
    await pendingRow(secondTab).getByRole("button", { name: "Duyệt" }).click();
    await confirmDialog(secondTab, "Duyệt đơn");
    expect((await secondApprove).status()).toBe(200);

    await expect(secondTab.getByText("Đơn đã được xử lý")).toBeVisible();
    expect(
      serverRecords.mailsSent().filter((mail) => mail.to === LEARNER_EMAIL),
    ).toHaveLength(1);
    expect(await learnerEnrollmentCount(2)).toBe(1);
  });

  test("[AP8] rejecting an approved order leaves it approved, enrolled and counted", async ({
    callAction,
    serverRecords,
  }) => {
    const actions = paymentActions(callAction);
    const orderId = await createLearnerOrder(actions, SEED_COUPON);
    expect(await actions.approvePayment("admin", orderId)).toMatchObject({
      success: true,
    });
    expect(
      serverRecords.mailsSent(),
      "the setup approval mails the learner",
    ).toHaveLength(1);

    expect(await actions.rejectPayment("admin", orderId)).toEqual({
      error: "Đơn đã được xử lý",
    });

    expect(await paymentById(orderId)).toMatchObject({ status: "success" });
    expect(await learnerEnrollmentCount(2)).toBe(1);
    // The reserved use stays counted once the order is approved.
    expect(await couponUsedCount(SEED_COUPON)).toBe(1);
    expect(serverRecords.mailsSent()).toHaveLength(1);
  });

  test("[AP9] approving a cancelled order leaves it cancelled, unenrolled and unmailed", async ({
    callAction,
    serverRecords,
  }) => {
    const actions = paymentActions(callAction);
    const orderId = await createLearnerOrder(actions, SEED_COUPON);
    expect(await actions.cancelPayment("learner", orderId)).toMatchObject({
      success: true,
    });
    expect(
      await learnerEnrollmentCount(2),
      "the learner has no enrollment before the approval",
    ).toBe(0);

    expect(await actions.approvePayment("admin", orderId)).toEqual({
      error: "Đơn đã được xử lý",
    });

    expect(await paymentById(orderId)).toMatchObject({ status: "failed" });
    expect(await learnerEnrollmentCount(2)).toBe(0);
    expect(await couponUsedCount(SEED_COUPON)).toBe(0);
    expect(serverRecords.mailsSent()).toEqual([]);
  });

  test("[AP11] approving or rejecting an unknown order, or a malformed id, changes nothing and sends no mail", async ({
    callAction,
    serverRecords,
  }) => {
    const actions = paymentActions(callAction);
    const GENERIC = { error: "Dữ liệu không hợp lệ." };

    expect(await actions.approvePayment("admin", 987654321)).toEqual({
      error: "Đơn đã được xử lý",
    });
    expect(await actions.rejectPayment("admin", 987654321)).toEqual({
      error: "Đơn đã được xử lý",
    });
    for (const id of ["1", 0, -1, 1.5, null]) {
      expect(
        await callAction("admin", "app/action/payment.ts", "approvePayment", [
          id,
        ]),
        "approve " + JSON.stringify(id),
      ).toEqual(GENERIC);
      expect(
        await callAction("admin", "app/action/payment.ts", "rejectPayment", [
          id,
        ]),
        "reject " + JSON.stringify(id),
      ).toEqual(GENERIC);
    }

    expect(serverRecords.mailsSent()).toEqual([]);
  });
});
