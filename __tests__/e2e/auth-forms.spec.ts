import type { Locator, Page, Request, Route } from "@playwright/test";
import { ACCOUNTS } from "./accounts";
import { expect, test } from "./fixtures";

// The auth forms of AF-U4 on an anonymous context (the project default has no saved session). The local stacks send
// no mail (`[local_smtp] enabled = false`), so the forgot-password rows answer or hold `/auth/v1/recover` with
// `page.route` and never depend on what Auth does without a mailer; a failure path aborts a request and never answers
// 5xx, which the network guard fails (AF-U4 plan, G5).
const TOKEN = "**/auth/v1/token**";
const RECOVER = "**/auth/v1/recover**";

const emailBox = (page: Page) => page.getByPlaceholder("Email...");
const passwordBox = (page: Page) => page.getByPlaceholder("Mật khẩu...");
const signInButton = (page: Page) => page.getByRole("button", { name: "Đăng nhập", exact: true });

// Counts the requests that match, from the moment it is called.
function countRequests(page: Page, pattern: RegExp): Request[] {
  const seen: Request[] = [];
  page.on("request", (request) => {
    if (pattern.test(request.url())) seen.push(request);
  });
  return seen;
}

// Holds every matching request without answering, so the form stays pending until the test aborts it.
async function holdRequests(page: Page, pattern: string): Promise<Route[]> {
  const held: Route[] = [];
  await page.route(pattern, (route) => {
    held.push(route);
  });
  return held;
}

// Two submit events in the same task, before React renders: only an in-flight flag set before the first await (a ref,
// not state) lets exactly one through. This is what a repeated Enter does in a form with a submit button.
const submitTwice = (control: Locator) =>
  control.evaluate((element) => {
    const form = (element as HTMLInputElement).form;
    if (!form) throw new Error("the control is not in a form");
    form.requestSubmit();
    form.requestSubmit();
  });

test.describe("sign-in form", () => {
  test("[AU1] a wrong password shows the generic message, keeps the email and lets the right password sign in", async ({ page }) => {
    await page.goto("/login");
    await emailBox(page).fill(ACCOUNTS.learner.email);
    await passwordBox(page).fill("not-the-password");
    await signInButton(page).click();

    await expect(page.getByText("Email hoặc mật khẩu không đúng")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(emailBox(page)).toHaveValue(ACCOUNTS.learner.email);
    await expect(signInButton(page)).toBeEnabled();

    await passwordBox(page).fill(ACCOUNTS.learner.password);
    await signInButton(page).click();
    await expect(page.getByText("Đăng nhập thành công!")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("[AU2] blank and malformed fields show field errors and send no sign-in request", async ({ page }) => {
    await page.goto("/login");
    const tokenRequests = countRequests(page, /\/auth\/v1\/token/);

    await signInButton(page).click();
    await expect(page.getByText("Vui lòng nhập email")).toBeVisible();
    await expect(page.getByText("Vui lòng nhập mật khẩu")).toBeVisible();
    await expect(emailBox(page)).toHaveAttribute("aria-invalid", "true");
    await expect(passwordBox(page)).toHaveAttribute("aria-invalid", "true");

    await emailBox(page).fill("not-an-email");
    await passwordBox(page).fill("x");
    await signInButton(page).click();
    await expect(page.getByText("Email không đúng định dạng")).toBeVisible();
    await expect(page.getByText("Vui lòng nhập mật khẩu")).toBeHidden();

    expect(tokenRequests, "no sign-in request was sent").toEqual([]);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("[AU9] sign in: a repeated Enter and a repeated submit send one request; an aborted request re-enables the form", async ({ page }) => {
    await page.goto("/login");
    const held = await holdRequests(page, TOKEN);
    await emailBox(page).fill(ACCOUNTS.learner.email);
    await passwordBox(page).fill(ACCOUNTS.learner.password);

    await Promise.all([passwordBox(page).press("Enter"), passwordBox(page).press("Enter")]);
    await submitTwice(passwordBox(page));

    await expect.poll(() => held.length).toBe(1);
    await expect(signInButton(page)).toBeDisabled();
    expect(held, "one request while the first is pending").toHaveLength(1);

    await held[0].abort("failed");
    await expect(page.getByText("Email hoặc mật khẩu không đúng")).toBeVisible();
    await expect(signInButton(page)).toBeEnabled();
    await expect(emailBox(page)).toHaveValue(ACCOUNTS.learner.email);
    await expect(passwordBox(page)).toHaveValue(ACCOUNTS.learner.password);
  });
});

test.describe("forgot-password form", () => {
  const openForgot = async (page: Page) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Quên mật khẩu?" }).click();
    await expect(page.getByPlaceholder("Email của bạn...")).toBeVisible();
  };
  const forgotBox = (page: Page) => page.getByPlaceholder("Email của bạn...");
  const sendButton = (page: Page) => page.getByRole("button", { name: "Gửi yêu cầu" });

  test("[AU6] blank and malformed emails send nothing; a valid one sends the callback redirect and shows the success message", async ({ page }) => {
    await openForgot(page);
    const recoverRequests = countRequests(page, /\/auth\/v1\/recover/);

    await sendButton(page).click();
    await expect(page.getByText("Vui lòng nhập email để khôi phục")).toBeVisible();
    await forgotBox(page).fill("nope");
    await sendButton(page).click();
    await expect(page.getByText("Email không đúng định dạng")).toBeVisible();
    expect(recoverRequests, "no recover request for an invalid email").toEqual([]);

    await page.route(RECOVER, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await forgotBox(page).fill("someone@example.com");
    await sendButton(page).click();

    await expect(page.getByText("Đã gửi link khôi phục! Vui lòng kiểm tra email (cả mục Spam).")).toBeVisible();
    expect(recoverRequests).toHaveLength(1);
    const redirectTo = new URL(recoverRequests[0].url()).searchParams.get("redirect_to");
    expect(redirectTo).toBe(`${new URL(page.url()).origin}/auth/callback?next=/auth/reset-password`);
    await expect(forgotBox(page)).toHaveValue("someone@example.com");
  });

  test("[AU6] a failed request shows the existing failure message and keeps the email", async ({ page }) => {
    await openForgot(page);
    await page.route(RECOVER, (route) => route.abort("failed"));

    await forgotBox(page).fill("someone@example.com");
    await sendButton(page).click();

    await expect(page.getByText("Gửi yêu cầu thất bại (Thử lại sau 1p)")).toBeVisible();
    await expect(forgotBox(page)).toHaveValue("someone@example.com");
    await expect(sendButton(page)).toBeEnabled();
  });

  test("[AU9] forgot password: a repeated Enter and a repeated submit send one request; an aborted request re-enables the form", async ({ page }) => {
    await openForgot(page);
    const held = await holdRequests(page, RECOVER);
    await forgotBox(page).fill("someone@example.com");

    await Promise.all([forgotBox(page).press("Enter"), forgotBox(page).press("Enter")]);
    await submitTwice(forgotBox(page));

    await expect.poll(() => held.length).toBe(1);
    await expect(sendButton(page)).toBeDisabled();
    expect(held, "one request while the first is pending").toHaveLength(1);

    await held[0].abort("failed");
    await expect(page.getByText("Gửi yêu cầu thất bại (Thử lại sau 1p)")).toBeVisible();
    await expect(sendButton(page)).toBeEnabled();
    await expect(forgotBox(page)).toHaveValue("someone@example.com");
  });
});
