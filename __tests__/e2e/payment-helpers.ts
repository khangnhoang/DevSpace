import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { authFile, type Actor } from "./accounts";
import { expect } from "./fixtures";
import type { ActionCaller, Caller } from "./server-action";

export const PAID_COURSE_PATH = "/course/javascript-can-ban";
export const PAID_COURSE_NAME = "JavaScript căn bản";
export const FIRST_PAID_LESSON_PATH = "/learn/javascript-can-ban/bien-va-kieu-du-lieu";
const PAYMENT_ACTIONS = "app/action/payment.ts";

// The shapes the payment actions return today (app/action/payment.ts); every field is optional because one
// object type covers the success and the error form.
export type PaymentResult = {
  error?: string;
  success?: boolean;
  paymentId?: number;
  amount?: number;
  isResumed?: boolean;
  newAmount?: number;
  discountPercent?: number;
};

// Typed wrappers over the direct call. `caller` is the actor whose saved session the request carries.
export function paymentActions(callAction: ActionCaller) {
  const call = async (caller: Caller, name: string, args: unknown[]): Promise<PaymentResult> => {
    const value = await callAction(caller, PAYMENT_ACTIONS, name, args);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`server action ${PAYMENT_ACTIONS}#${name} as ${caller} returned ${JSON.stringify(value)}, not an object`);
    }
    return value as PaymentResult;
  };
  return {
    createPendingPayment: (caller: Caller, courseId: number, couponCode?: string) =>
      call(caller, "createPendingPayment", couponCode === undefined ? [courseId] : [courseId, couponCode]),
    updatePaymentWithCoupon: (caller: Caller, paymentId: number, code: string) =>
      call(caller, "updatePaymentWithCoupon", [paymentId, code]),
    cancelPayment: (caller: Caller, paymentId: number) => call(caller, "cancelPayment", [paymentId]),
    approvePayment: (caller: Caller, paymentId: number) => call(caller, "approvePayment", [paymentId]),
    rejectPayment: (caller: Caller, paymentId: number) => call(caller, "rejectPayment", [paymentId]),
  };
}

// The learner's new pending order through the actions, as G8 asks. Fails when the action did not create one.
export async function createLearnerOrder(actions: ReturnType<typeof paymentActions>, couponCode?: string): Promise<number> {
  const order = await actions.createPendingPayment("learner", 2);
  expect(order, "the learner's pending order").toMatchObject({ success: true, amount: 199000 });
  const paymentId = order.paymentId;
  if (typeof paymentId !== "number") throw new Error(`createPendingPayment returned no payment id: ${JSON.stringify(order)}`);
  if (couponCode !== undefined) {
    const applied = await actions.updatePaymentWithCoupon("learner", paymentId, couponCode);
    expect(applied, `applying ${couponCode}`).toMatchObject({ success: true });
  }
  return paymentId;
}

// Replaces the session of a browser context, so a row can see a page as another actor while the context keeps
// the network guard of fixtures.ts.
export async function signInAs(context: BrowserContext, actor: Actor): Promise<void> {
  const state = JSON.parse(readFileSync(authFile(actor), "utf8")) as { cookies: Parameters<BrowserContext["addCookies"]>[0] };
  await context.clearCookies();
  await context.addCookies(state.cookies);
}

// The course page of the learner: press the buy button and wait for the payment modal.
export async function openPaymentModal(page: Page): Promise<void> {
  await page.goto(PAID_COURSE_PATH);
  await page.getByRole("button", { name: "Mua khóa học ngay" }).click();
  await expect(page.getByRole("heading", { name: "Thanh toán khóa học" })).toBeVisible();
}

// The row of the amount in the modal. toLocaleString follows the browser locale, so the separator is a dot or a comma.
export const modalAmount = (page: Page) => page.getByText("Số tiền:").locator("..");
export const money = (digits: string) => new RegExp(digits.replace(/(\d)(?=(\d{3})+$)/g, "$1[.,]") + "đ");

// The confirm dialogs of /admin/transactions are accepted by an explicit handler registered before the click.
export function acceptNextDialog(page: Page): void {
  page.once("dialog", (dialog) => void dialog.accept());
}
