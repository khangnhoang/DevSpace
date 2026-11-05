import type { Locator, Page, Request, Route } from "@playwright/test";
import { ACCOUNTS } from "./accounts";
import { expect, test } from "./fixtures";
import {
  authUsersWithEmail,
  createUserFixture,
  expireFixtureRecovery,
  profileOfEmail,
  reserveSignUpEmail,
} from "./service-role";
import {
  requestRecovery,
  requestMagicLink,
  followAuthMail,
  expectRecoveryRoute,
  expectSensitiveValue,
  fillSensitiveInput,
  verifiedSessionClaims,
  acceptsFixturePassword,
  verifiedRecovery,
  withRecoveryMail,
} from "./recovery-mail";

test.use({ trace: "off", screenshot: "off", video: "off" });

test("[SE-U2 CP2] real PKCE recovery survives reload; a controlled failure cleans the exact mailbox and user", async ({
  page,
  owned,
}) => {
  const user = await createUserFixture();
  let controlledFailure = false;
  try {
    await withRecoveryMail(user.email, async (mail) => {
      await requestRecovery(page, user.email);
      const link = await mail.link();
      const requestingOrigin = new URL(page.url()).origin;
      const callback = page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/auth/callback",
      );
      await followAuthMail(page, link);
      const callbackLocation = URL.parse(
        (await callback).headers()["location"] ?? "",
        requestingOrigin,
      );
      expect(
        callbackLocation?.origin === requestingOrigin,
        "callback preserves the requesting browser origin",
      ).toBe(true);
      expect(callbackLocation?.pathname === "/auth/reset-password").toBe(true);
      await expect(page.getByPlaceholder("Mật khẩu mới...")).toBeVisible();
      await expectRecoveryRoute(page, "/auth/reset-password");
      await verifiedRecovery(page, user.id);
      await page.reload();
      await expect(page.getByPlaceholder("Mật khẩu mới...")).toBeVisible();
      await verifiedRecovery(page, user.id);
      controlledFailure = true;
      throw new Error("controlled harness failure");
    });
  } catch (error) {
    if (
      !controlledFailure ||
      !(error instanceof Error) ||
      error.message !== "controlled harness failure"
    )
      throw error;
  }
  await owned.cleanup();
  expect(await authUsersWithEmail(user.email)).toBe(0);
});

// Request outcome rows control the mail boundary; recovery security rows use genuine
// messages captured only by the managed test stack's loopback Mailpit.
const TOKEN = "**/auth/v1/token**";
const RECOVER = "**/auth/v1/recover**";
const SIGNUP = "**/auth/v1/signup**";
const USER = "**/auth/v1/user**";

const emailBox = (page: Page) => page.getByPlaceholder("Email...");
const passwordBox = (page: Page) => page.getByPlaceholder("Mật khẩu...");
const signInButton = (page: Page) =>
  page.getByRole("button", { name: "Đăng nhập", exact: true });

// Counts the requests that match, from the moment it is called.
function countRequests(page: Page, pattern: RegExp): Request[] {
  const seen: Request[] = [];
  page.on("request", (request) => {
    if (pattern.test(request.url())) seen.push(request);
  });
  return seen;
}

// Holds every matching request without answering, so the form stays pending until the test aborts it. Other methods
// fall through to the network guard of the context.
async function holdRequests(
  page: Page,
  pattern: string,
  method = "POST",
): Promise<Route[]> {
  const held: Route[] = [];
  await page.route(pattern, (route) => {
    if (route.request().method() !== method) return route.fallback();
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

// The duplicate-submit guard (AC9), in two phases that each start from an idle form: a repeated Enter, then two
// `requestSubmit()` calls in one task. The second phase is the one that proves the in-flight ref: both submit events
// arrive before React renders the disabled button. Each phase must hold exactly one more request, disable the button
// (and the controls that leave the form), and recover when the request is aborted.
async function expectOneRequestPerSubmit(
  page: Page,
  held: Route[],
  phases: {
    button: Locator;
    pressEnterTwice: () => Promise<unknown>;
    requestSubmitTwice: () => Promise<unknown>;
    whileHeld?: () => Promise<void>;
    recovered: () => Promise<void>;
  },
) {
  const sends = [phases.pressEnterTwice, phases.requestSubmitTwice];
  for (const [index, send] of sends.entries()) {
    await send();
    await expect.poll(() => held.length).toBe(index + 1);
    await expect(phases.button).toBeDisabled();
    await phases.whileHeld?.();
    // A second request of the same submit would have been sent by the next frame.
    await page.evaluate(
      () =>
        new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
    );
    expect(held, `one request for submit ${index + 1}`).toHaveLength(index + 1);

    await held[index].abort("failed");
    await phases.recovered();
    await expect(phases.button).toBeEnabled();
  }
  expect(held, "two submits, two requests").toHaveLength(2);
}

test.describe("sign-in form", () => {
  test("[AU1] a wrong password shows the generic message, keeps the email and lets the right password sign in", async ({
    page,
  }) => {
    await page.goto("/login");
    await emailBox(page).fill(ACCOUNTS.learner.email);
    await passwordBox(page).fill("not-the-password");
    await signInButton(page).click();

    await expect(
      page.getByText("Email hoặc mật khẩu không đúng"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(emailBox(page)).toHaveValue(ACCOUNTS.learner.email);
    await expect(signInButton(page)).toBeEnabled();

    await passwordBox(page).fill(ACCOUNTS.learner.password);
    await signInButton(page).click();
    await expect(page.getByText("Đăng nhập thành công!")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("[AU2] blank and malformed fields show field errors and send no sign-in request", async ({
    page,
  }) => {
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

  test("[AU9] sign in: a repeated Enter and a repeated submit each send one request; the switch links are disabled while it is held", async ({
    page,
  }) => {
    await page.goto("/login");
    const held = await holdRequests(page, TOKEN);
    await emailBox(page).fill(ACCOUNTS.learner.email);
    await passwordBox(page).fill(ACCOUNTS.learner.password);

    await expectOneRequestPerSubmit(page, held, {
      button: signInButton(page),
      pressEnterTwice: () =>
        Promise.all([
          passwordBox(page).press("Enter"),
          passwordBox(page).press("Enter"),
        ]),
      requestSubmitTwice: () => submitTwice(passwordBox(page)),
      whileHeld: async () => {
        await expect(
          page.getByRole("button", { name: "Quên mật khẩu?" }),
        ).toBeDisabled();
        await expect(
          page.getByRole("button", {
            name: "Chưa có tài khoản? Đăng ký miễn phí",
          }),
        ).toBeDisabled();
      },
      recovered: async () => {
        await expect(
          page.getByText("Email hoặc mật khẩu không đúng"),
        ).toBeVisible();
        await expect(emailBox(page)).toHaveValue(ACCOUNTS.learner.email);
        await expect(passwordBox(page)).toHaveValue(ACCOUNTS.learner.password);
      },
    });
  });
});

test.describe("forgot-password form", () => {
  const openForgot = async (page: Page) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Quên mật khẩu?" }).click();
    await expect(page.getByPlaceholder("Email của bạn...")).toBeVisible();
  };
  const forgotBox = (page: Page) => page.getByPlaceholder("Email của bạn...");
  const sendButton = (page: Page) =>
    page.getByRole("button", { name: "Gửi yêu cầu" });

  test("[AU6] blank and malformed emails send nothing; a valid one sends the callback redirect and shows the success message", async ({
    page,
  }) => {
    await openForgot(page);
    const recoverRequests = countRequests(page, /\/auth\/v1\/recover/);

    await sendButton(page).click();
    await expect(
      page.getByText("Vui lòng nhập email để khôi phục"),
    ).toBeVisible();
    await forgotBox(page).fill("nope");
    await sendButton(page).click();
    await expect(page.getByText("Email không đúng định dạng")).toBeVisible();
    expect(recoverRequests, "no recover request for an invalid email").toEqual(
      [],
    );

    await page.route(RECOVER, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );
    await forgotBox(page).fill("someone@example.com");
    await sendButton(page).click();

    await expect(
      page.getByText(
        "Đã gửi link khôi phục! Vui lòng kiểm tra email (cả mục Spam).",
      ),
    ).toBeVisible();
    expect(recoverRequests).toHaveLength(1);
    const redirectTo = new URL(recoverRequests[0].url()).searchParams.get(
      "redirect_to",
    );
    expect(redirectTo).toBe(
      `${new URL(page.url()).origin}/auth/callback?next=/auth/reset-password`,
    );
    await expect(forgotBox(page)).toHaveValue("someone@example.com");
  });

  test("[AU6] a failed request shows the existing failure message and keeps the email", async ({
    page,
  }) => {
    await openForgot(page);
    await page.route(RECOVER, (route) => route.abort("failed"));

    await forgotBox(page).fill("someone@example.com");
    await sendButton(page).click();

    await expect(
      page.getByText("Gửi yêu cầu thất bại (Thử lại sau 1p)"),
    ).toBeVisible();
    await expect(forgotBox(page)).toHaveValue("someone@example.com");
    await expect(sendButton(page)).toBeEnabled();
  });

  test("[AU9] forgot password: a repeated Enter and a repeated submit each send one request; the back link is disabled while it is held", async ({
    page,
  }) => {
    await openForgot(page);
    const held = await holdRequests(page, RECOVER);
    await forgotBox(page).fill("someone@example.com");

    await expectOneRequestPerSubmit(page, held, {
      button: sendButton(page),
      pressEnterTwice: () =>
        Promise.all([
          forgotBox(page).press("Enter"),
          forgotBox(page).press("Enter"),
        ]),
      requestSubmitTwice: () => submitTwice(forgotBox(page)),
      whileHeld: () =>
        expect(
          page.getByRole("button", { name: "Quay lại đăng nhập" }),
        ).toBeDisabled(),
      recovered: async () => {
        await expect(
          page.getByText("Gửi yêu cầu thất bại (Thử lại sau 1p)"),
        ).toBeVisible();
        await expect(forgotBox(page)).toHaveValue("someone@example.com");
      },
    });
  });
});

// The sign-up form, step by step. Its placeholders are the only labels the design has.
const signUpField = (page: Page, placeholder: string) =>
  page.getByPlaceholder(placeholder);
const NEXT = (page: Page) => page.getByRole("button", { name: "Tiếp tục" });
const FINISH = (page: Page) =>
  page.getByRole("button", { name: "Hoàn tất đăng ký" });

async function fillAccountStep(
  page: Page,
  email: string,
  password = "e2e-pass-1234",
) {
  await signUpField(page, "Email...").fill(email);
  await signUpField(page, "Mật khẩu (tối thiểu 8 ký tự)...").fill(password);
  await signUpField(page, "Xác nhận mật khẩu...").fill(password);
  await NEXT(page).click();
}

async function fillProfileStep(
  page: Page,
  values: { name: string; phone: string; gender?: string },
) {
  await signUpField(page, "Họ và tên đầy đủ...").fill(values.name);
  await signUpField(page, "Số điện thoại (10 số)...").fill(values.phone);
  if (values.gender)
    await page.getByLabel("Giới tính").selectOption({ label: values.gender });
}

async function openSignUp(page: Page) {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Chưa có tài khoản? Đăng ký miễn phí" })
    .click();
  await expect(signUpField(page, "Xác nhận mật khẩu...")).toBeVisible();
}

test.describe("sign-up form", () => {
  test("[AU3] a visitor completes both steps, is signed in and the profile row holds the trimmed name, phone and gender", async ({
    page,
  }) => {
    const email = await reserveSignUpEmail();
    await openSignUp(page);

    await fillAccountStep(page, email);
    await expect(signUpField(page, "Họ và tên đầy đủ...")).toBeVisible();
    await fillProfileStep(page, {
      name: "  E2E Người Đăng Ký  ",
      phone: "0912345678",
      gender: "Nữ",
    });
    await FINISH(page).click();

    await expect(
      page.getByText("Đăng ký thành công! Đang đăng nhập..."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    expect(await profileOfEmail(email)).toEqual({
      full_name: "E2E Người Đăng Ký",
      phone: "0912345678",
      gender: "female",
    });
  });

  test("[AU4] step 1 refuses a blank, short or mismatched account, step 2 refuses a bad name or phone, and nothing is sent", async ({
    page,
  }) => {
    await openSignUp(page);
    const signUpRequests = countRequests(page, /\/auth\/v1\/signup/);

    await NEXT(page).click();
    await expect(page.getByText("Vui lòng nhập email")).toBeVisible();
    await expect(
      page.getByText("Mật khẩu phải có ít nhất 8 ký tự"),
    ).toBeVisible();
    await expect(page.getByText("Vui lòng xác nhận mật khẩu")).toBeVisible();

    await signUpField(page, "Email...").fill("not-an-email");
    await signUpField(page, "Mật khẩu (tối thiểu 8 ký tự)...").fill("1234567");
    await signUpField(page, "Xác nhận mật khẩu...").fill("1234567");
    await NEXT(page).click();
    await expect(page.getByText("Email không đúng định dạng")).toBeVisible();
    await expect(
      page.getByText("Mật khẩu phải có ít nhất 8 ký tự"),
    ).toBeVisible();

    await signUpField(page, "Email...").fill("someone@example.com");
    await signUpField(page, "Mật khẩu (tối thiểu 8 ký tự)...").fill("12345678");
    await signUpField(page, "Xác nhận mật khẩu...").fill("87654321");
    await NEXT(page).click();
    await expect(page.getByText("Mật khẩu xác nhận không khớp")).toBeVisible();
    await expect(signUpField(page, "Họ và tên đầy đủ...")).toBeHidden();

    await signUpField(page, "Xác nhận mật khẩu...").fill("12345678");
    await NEXT(page).click();
    await expect(signUpField(page, "Họ và tên đầy đủ...")).toBeVisible();

    // Going back keeps what step 1 held.
    await page.getByRole("button", { name: "Quay lại bước trước" }).click();
    await expect(signUpField(page, "Email...")).toHaveValue(
      "someone@example.com",
    );
    await expect(
      signUpField(page, "Mật khẩu (tối thiểu 8 ký tự)..."),
    ).toHaveValue("12345678");
    await expect(signUpField(page, "Xác nhận mật khẩu...")).toHaveValue(
      "12345678",
    );
    await NEXT(page).click();

    await FINISH(page).click();
    await expect(page.getByText("Vui lòng nhập họ và tên")).toBeVisible();
    await expect(page.getByText("Vui lòng nhập số điện thoại")).toBeVisible();

    await fillProfileStep(page, { name: "   ", phone: "8412345678" });
    await FINISH(page).click();
    await expect(page.getByText("Vui lòng nhập họ và tên")).toBeVisible();
    await expect(
      page.getByText("Số điện thoại không hợp lệ (10 số)"),
    ).toBeVisible();

    await signUpField(page, "Số điện thoại (10 số)...").fill("091234567");
    await FINISH(page).click();
    await expect(
      page.getByText("Số điện thoại không hợp lệ (10 số)"),
    ).toBeVisible();

    // The phone input keeps digits only.
    await signUpField(page, "Số điện thoại (10 số)...").fill("09ab1");
    await expect(signUpField(page, "Số điện thoại (10 số)...")).toHaveValue(
      "091",
    );

    expect(signUpRequests, "no sign-up request was sent").toEqual([]);
  });

  test("[AU5] an email already registered shows the existing message and creates no user", async ({
    page,
  }) => {
    const email = ACCOUNTS.student.email;
    const before = await authUsersWithEmail(email);
    expect(before).toBe(1);
    await openSignUp(page);

    await fillAccountStep(page, email);
    await fillProfileStep(page, {
      name: "E2E Trùng Email",
      phone: "0912345678",
    });
    await FINISH(page).click();

    await expect(
      page.getByText(
        "Email này đã được sử dụng. Vui lòng chọn email khác hoặc đăng nhập.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(FINISH(page)).toBeEnabled();
    expect(await authUsersWithEmail(email)).toBe(before);
  });

  test("[AU10] a sign-up answered without a session shows the check-your-mail message and stays, with the call unchanged", async ({
    page,
  }) => {
    const email = "no-session@example.com";
    let sent: Request | undefined;
    await page.route(SIGNUP, (route) => {
      sent = route.request();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "00000000-0000-4000-8000-0000000000a1",
          aud: "authenticated",
          role: "",
          email,
          identities: [
            {
              identity_id: "00000000-0000-4000-8000-0000000000a2",
              id: "00000000-0000-4000-8000-0000000000a1",
              provider: "email",
              identity_data: {},
            },
          ],
          app_metadata: {},
          user_metadata: {},
          created_at: "2026-11-03T00:00:00Z",
        }),
      });
    });
    await openSignUp(page);

    await fillAccountStep(page, email);
    await fillProfileStep(page, {
      name: "E2E Chờ Email",
      phone: "0987654321",
      gender: "Khác",
    });
    await FINISH(page).click();

    await expect(
      page.getByText(
        "Đăng ký thành công! Vui lòng kiểm tra email để kích hoạt tài khoản.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    expect(sent, "the sign-up request was sent").toBeDefined();
    const body = sent!.postDataJSON();
    expect(body).toMatchObject({
      email,
      password: "e2e-pass-1234",
      data: {
        full_name: "E2E Chờ Email",
        phone: "0987654321",
        gender: "other",
      },
    });
    expect(new URL(sent!.url()).searchParams.get("redirect_to")).toBe(
      `${new URL(page.url()).origin}/auth/callback`,
    );
  });

  test("[AU9] sign up: a repeated Enter and a repeated submit each send one request; the step and view links are disabled while it is held", async ({
    page,
  }) => {
    await openSignUp(page);
    const held = await holdRequests(page, SIGNUP);
    await fillAccountStep(page, "held@example.com");
    await fillProfileStep(page, {
      name: "E2E Giữ Yêu Cầu",
      phone: "0912345678",
    });
    const nameBox = signUpField(page, "Họ và tên đầy đủ...");

    await expectOneRequestPerSubmit(page, held, {
      button: FINISH(page),
      pressEnterTwice: () =>
        Promise.all([nameBox.press("Enter"), nameBox.press("Enter")]),
      requestSubmitTwice: () => submitTwice(nameBox),
      whileHeld: async () => {
        await expect(
          page.getByRole("button", { name: "Quay lại bước trước" }),
        ).toBeDisabled();
        await expect(
          page.getByRole("button", { name: "Đã có tài khoản? Đăng nhập ngay" }),
        ).toBeDisabled();
      },
      recovered: async () => {
        await expect(
          page.getByText("Đăng ký thất bại, vui lòng thử lại"),
        ).toBeVisible();
        await expect(nameBox).toHaveValue("E2E Giữ Yêu Cầu");
        await expect(signUpField(page, "Số điện thoại (10 số)...")).toHaveValue(
          "0912345678",
        );
      },
    });
  });
});

test.describe("reset-password page", () => {
  const NEW_PASSWORD = "e2e-new-pass-2";
  const newBox = (page: Page) => page.getByPlaceholder("Mật khẩu mới...");
  const confirmBox = (page: Page) =>
    page.getByPlaceholder("Nhập lại mật khẩu...");
  const changeButton = (page: Page) =>
    page.getByRole("button", { name: "Đổi mật khẩu" });

  type FixtureUser = Awaited<ReturnType<typeof createUserFixture>>;
  const invalidMessage = (page: Page) =>
    page.getByText(
      "Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.",
    );
  const updatesSent = (requests: Request[]) =>
    requests.filter((request) => request.method() === "PUT").length;

  async function signInFixtureUser(page: Page, user: FixtureUser) {
    await page.goto("/login");
    await fillSensitiveInput(emailBox(page), user.email);
    await fillSensitiveInput(passwordBox(page), user.password);
    await signInButton(page).click();
    await expectRecoveryRoute(page, "/");
    await verifiedSessionClaims(page, user.id);
  }

  async function openFixtureRecovery(page: Page, user: FixtureUser) {
    return withRecoveryMail(user.email, async (mail) => {
      await requestRecovery(page, user.email);
      const link = await mail.link();
      await followAuthMail(page, link);
      await expect(newBox(page)).toBeVisible();
      await expectRecoveryRoute(page, "/auth/reset-password");
      await verifiedRecovery(page, user.id);
      return link;
    });
  }

  test("[AU7] a short or mismatched password shows a field error, the same password keeps its toast, a new one changes it and goes to /", async ({
    page,
  }) => {
    const user = await createUserFixture();
    await openFixtureRecovery(page, user);
    await page.reload();
    await expect(newBox(page)).toBeVisible();
    await verifiedRecovery(page, user.id);
    const updates = countRequests(page, /\/auth\/v1\/user/);

    await changeButton(page).click();
    await expect(
      page.getByText("Mật khẩu phải có ít nhất 8 ký tự"),
    ).toBeVisible();
    await expect(page.getByText("Vui lòng xác nhận mật khẩu")).toBeVisible();

    await fillSensitiveInput(newBox(page), NEW_PASSWORD);
    await fillSensitiveInput(confirmBox(page), `${NEW_PASSWORD}-mismatch`);
    await changeButton(page).click();
    await expect(page.getByText("Mật khẩu xác nhận không khớp")).toBeVisible();
    expect(updatesSent(updates), "no update was sent").toBe(0);

    await fillSensitiveInput(newBox(page), user.password);
    await fillSensitiveInput(confirmBox(page), user.password);
    await changeButton(page).click();
    await expect(
      page.getByText("Mật khẩu mới phải khác mật khẩu cũ"),
    ).toBeVisible();
    await expectRecoveryRoute(page, "/auth/reset-password");

    await fillSensitiveInput(newBox(page), NEW_PASSWORD);
    await fillSensitiveInput(confirmBox(page), NEW_PASSWORD);
    await changeButton(page).click();
    await expect(
      page.getByText("Khôi phục mật khẩu thành công!"),
    ).toBeVisible();
    await expectRecoveryRoute(page, "/");
    expect(await acceptsFixturePassword(user.email, NEW_PASSWORD)).toBe(true);
    expect(await acceptsFixturePassword(user.email, user.password)).toBe(false);
  });

  test("[AU8] without a session the page shows the expired-link toast and goes to /login", async ({
    page,
  }) => {
    const updates = countRequests(page, /\/auth\/v1\/user/);
    await page.goto("/auth/reset-password");

    await expect(invalidMessage(page)).toBeVisible();
    await expectRecoveryRoute(page, "/login");
    expect(updatesSent(updates)).toBe(0);
  });

  test("[AU9] reset password: a repeated Enter and a repeated submit each send one request", async ({
    page,
  }) => {
    await openFixtureRecovery(page, await createUserFixture());
    const held = await holdRequests(page, USER, "PUT");
    await fillSensitiveInput(newBox(page), NEW_PASSWORD);
    await fillSensitiveInput(confirmBox(page), NEW_PASSWORD);

    await expectOneRequestPerSubmit(page, held, {
      button: changeButton(page),
      pressEnterTwice: () =>
        Promise.all([
          confirmBox(page).press("Enter"),
          confirmBox(page).press("Enter"),
        ]),
      requestSubmitTwice: () => submitTwice(confirmBox(page)),
      recovered: async () => {
        // The toast of the first failure can still be on screen, so read the newest one.
        await expect(
          page.getByText("Không đổi được mật khẩu, vui lòng thử lại").last(),
        ).toBeVisible();
        await expectSensitiveValue(newBox(page), NEW_PASSWORD);
        await expectSensitiveValue(confirmBox(page), NEW_PASSWORD);
      },
    });
  });

  test("[AU8] a normal session and a spoofed reset URL cannot open the form", async ({
    page,
  }) => {
    const user = await createUserFixture();
    await signInFixtureUser(page, user);
    const updates = countRequests(page, /\/auth\/v1\/user/);
    for (const suffix of [
      "",
      "?type=recovery&next=/auth/reset-password#type=recovery",
    ]) {
      await page.goto(`/auth/reset-password${suffix}`);
      await expectRecoveryRoute(page, "/login");
      await expect(newBox(page)).toHaveCount(0);
    }
    expect(updatesSent(updates)).toBe(0);
  });

  test("[AU8] a genuine non-recovery PKCE exchange cannot open the reset form", async ({
    page,
  }) => {
    const user = await createUserFixture();
    const updates = countRequests(page, /\/auth\/v1\/user/);
    await page.goto("/login");
    await withRecoveryMail(user.email, async (mail) => {
      await requestMagicLink(page, user.email);
      await followAuthMail(page, await mail.link("magiclink"));
      await expect(invalidMessage(page)).toBeVisible();
      await expectRecoveryRoute(page, "/login");
      const claims = await verifiedSessionClaims(page, user.id);
      expect(
        claims.amr?.some(
          (entry) => typeof entry !== "string" && entry.method === "recovery",
        ),
      ).toBe(false);
      await expect(newBox(page)).toHaveCount(0);
    });
    expect(updatesSent(updates)).toBe(0);
  });

  test("[AU8] a used recovery link is refused with a normal session present", async ({
    page,
  }) => {
    const user = await createUserFixture();
    const link = await openFixtureRecovery(page, user);
    await signInFixtureUser(page, user);
    const updates = countRequests(page, /\/auth\/v1\/user/);
    await followAuthMail(page, link);
    await expectRecoveryRoute(page, "/auth/error");
    await expect(newBox(page)).toHaveCount(0);
    expect(updatesSent(updates)).toBe(0);
  });

  test("[AU8] an expired genuine recovery link is refused with a normal session present", async ({
    page,
  }) => {
    const user = await createUserFixture();
    await signInFixtureUser(page, user);
    const updates = countRequests(page, /\/auth\/v1\/user/);
    await withRecoveryMail(user.email, async (mail) => {
      await requestRecovery(page, user.email);
      const link = await mail.link();
      await expireFixtureRecovery(user);
      await followAuthMail(page, link);
      await expectRecoveryRoute(page, "/auth/error");
      await expect(newBox(page)).toHaveCount(0);
    });
    expect(updatesSent(updates)).toBe(0);
  });

  test("[AU8] a stale reset form refuses to submit after another account's recovery replaces the session", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const original = await createUserFixture();
    const replacement = await createUserFixture("alternate");
    await openFixtureRecovery(page, original);
    await fillSensitiveInput(newBox(page), NEW_PASSWORD);
    await fillSensitiveInput(confirmBox(page), NEW_PASSWORD);
    const otherTab = await page.context().newPage();
    await openFixtureRecovery(otherTab, replacement);
    await verifiedRecovery(page, replacement.id);
    const updates = countRequests(page, /\/auth\/v1\/user/);
    await changeButton(page).click();
    await expect(invalidMessage(page)).toBeVisible();
    await expectRecoveryRoute(page, "/login");
    expect(updatesSent(updates)).toBe(0);
    expect(
      await acceptsFixturePassword(replacement.email, replacement.password),
    ).toBe(true);
    expect(await acceptsFixturePassword(replacement.email, NEW_PASSWORD)).toBe(
      false,
    );
  });
});
