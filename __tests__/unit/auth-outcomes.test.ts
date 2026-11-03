import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FORGOT_FAILED_MESSAGE,
  FORGOT_SUCCESS_MESSAGE,
  RATE_LIMIT_MESSAGE,
  SIGN_IN_FAILED_MESSAGE,
  SIGN_IN_SUCCESS_MESSAGE,
  SIGN_IN_THROWN_MESSAGE,
  SIGN_IN_UNCONFIRMED_MESSAGE,
  SIGN_UP_CHECK_MAIL_MESSAGE,
  SIGN_UP_FAILED_MESSAGE,
  SIGN_UP_SESSION_MESSAGE,
  SIGN_UP_TAKEN_MESSAGE,
  SIGN_UP_WEAK_PASSWORD_MESSAGE,
  forgotPasswordOutcome,
  signInOutcome,
  signUpOutcome,
  submitForgotPassword,
  submitSignIn,
  submitSignUp,
  type SubmitControl,
} from "@/app/(main)/login/auth-outcomes";
import {
  RESET_FAILED_MESSAGE,
  RESET_SAME_PASSWORD_MESSAGE,
  RESET_SUCCESS_MESSAGE,
  RESET_WEAK_PASSWORD_MESSAGE,
  resetPasswordOutcome,
  submitResetPassword,
} from "@/app/auth/reset-password/reset-outcome";

// The submit helpers take the auth call as a parameter (AF-U4 plan, G7), so a stub stands in for Supabase and the
// mapping runs with no network.
function control() {
  const pending: boolean[] = [];
  const inFlight = { current: false };
  const value: SubmitControl = { inFlight, setPending: (state) => pending.push(state) };
  return { value, inFlight, pending };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("sign-in outcome", () => {
  it("signs in: success message, refresh then push after 1000 ms, values kept", () => {
    expect(signInOutcome(null)).toEqual({
      message: { text: SIGN_IN_SUCCESS_MESSAGE, type: "success" },
      redirect: { refresh: true, delayMs: 1000 },
      keepValues: true,
    });
  });

  it("maps email_not_confirmed", () => {
    expect(signInOutcome({ code: "email_not_confirmed", status: 400 }).message).toEqual({
      text: SIGN_IN_UNCONFIRMED_MESSAGE,
      type: "error",
    });
  });

  it.each([{ status: 429 }, { code: "over_request_rate_limit" }, { code: "over_request_rate_limit", status: 429 }])(
    "maps the rate limit %j",
    (error) => {
      expect(signInOutcome(error).message).toEqual({ text: RATE_LIMIT_MESSAGE, type: "error" });
    },
  );

  // A wrong password and an unknown email must look the same (G3), and neither redirects.
  it.each([
    { code: "invalid_credentials", status: 400 },
    { code: "user_not_found", status: 400 },
    { status: 0 },
    {},
  ])("answers the generic message for %j and does not redirect", (error) => {
    const outcome = signInOutcome(error);
    expect(outcome.message).toEqual({ text: SIGN_IN_FAILED_MESSAGE, type: "error" });
    expect(outcome.redirect).toBeNull();
    expect(outcome.keepValues).toBe(true);
  });

  it("never shares the wrong-password text with a message about registration", () => {
    expect(SIGN_IN_FAILED_MESSAGE).not.toMatch(/đã được sử dụng|chưa đăng ký|không tồn tại/);
  });
});

describe("sign-in submit", () => {
  it("returns the outcome of a success and releases the guard and the pending state", async () => {
    const { value, inFlight, pending } = control();
    const signIn = vi.fn().mockResolvedValue({ error: null });

    const outcome = await submitSignIn(value, signIn);

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual(signInOutcome(null));
    expect(inFlight.current).toBe(false);
    expect(pending).toEqual([true, false]);
  });

  it("maps an error returned in { data, error } and releases the guard", async () => {
    const { value, inFlight, pending } = control();

    const outcome = await submitSignIn(value, async () => ({ error: { code: "invalid_credentials", status: 400 } }));

    expect(outcome?.message.text).toBe(SIGN_IN_FAILED_MESSAGE);
    expect(inFlight.current).toBe(false);
    expect(pending).toEqual([true, false]);
  });

  it("shows the thrown-request message for a rejected call, keeps the values and releases the guard", async () => {
    const { value, inFlight, pending } = control();

    const outcome = await submitSignIn(value, () => Promise.reject(new Error("network down")));

    expect(outcome).toEqual({ message: { text: SIGN_IN_THROWN_MESSAGE, type: "error" }, redirect: null, keepValues: true });
    expect(inFlight.current).toBe(false);
    expect(pending).toEqual([true, false]);
    expect(console.error).toHaveBeenCalled();
  });

  it("calls nothing and changes nothing while a submit is in flight", async () => {
    const { value, inFlight, pending } = control();
    inFlight.current = true;
    const signIn = vi.fn();

    expect(await submitSignIn(value, signIn)).toBeNull();
    expect(signIn).not.toHaveBeenCalled();
    expect(inFlight.current).toBe(true);
    expect(pending).toEqual([]);
  });

  it("sends one call for two submits made before the first answers", async () => {
    const { value } = control();
    let release: (result: { error: null }) => void = () => {};
    const signIn = vi.fn(() => new Promise<{ error: null }>((resolve) => (release = resolve)));

    const first = submitSignIn(value, signIn);
    const second = await submitSignIn(value, signIn);
    release({ error: null });

    expect(second).toBeNull();
    expect(await first).toEqual(signInOutcome(null));
    expect(signIn).toHaveBeenCalledTimes(1);
  });
});

describe("forgot-password outcome", () => {
  it("shows the existing success message for any accepted request, with no redirect", () => {
    expect(forgotPasswordOutcome(null)).toEqual({
      message: { text: FORGOT_SUCCESS_MESSAGE, type: "success" },
      redirect: null,
      keepValues: true,
    });
  });

  // The success text never says whether the email has an account (G3).
  it("does not reveal whether the email is registered", () => {
    expect(FORGOT_SUCCESS_MESSAGE).not.toMatch(/không tồn tại|chưa đăng ký|đã đăng ký/);
  });

  it.each([{ status: 429 }, { code: "over_email_send_rate_limit" }, { status: 400 }, {}])(
    "shows the existing failure message for the error %j",
    (error) => {
      expect(forgotPasswordOutcome(error).message).toEqual({ text: FORGOT_FAILED_MESSAGE, type: "error" });
    },
  );
});

describe("forgot-password submit", () => {
  it("returns the success outcome and releases the guard", async () => {
    const { value, inFlight, pending } = control();

    const outcome = await submitForgotPassword(value, async () => ({ error: null }));

    expect(outcome).toEqual(forgotPasswordOutcome(null));
    expect(inFlight.current).toBe(false);
    expect(pending).toEqual([true, false]);
  });

  it("maps a returned error to the failure message", async () => {
    const { value, inFlight } = control();

    const outcome = await submitForgotPassword(value, async () => ({ error: { status: 429 } }));

    expect(outcome?.message).toEqual({ text: FORGOT_FAILED_MESSAGE, type: "error" });
    expect(inFlight.current).toBe(false);
  });

  it("shows the failure message for a rejected call, keeps the values and releases the guard", async () => {
    const { value, inFlight, pending } = control();

    const outcome = await submitForgotPassword(value, () => Promise.reject(new Error("offline")));

    expect(outcome).toEqual({ message: { text: FORGOT_FAILED_MESSAGE, type: "error" }, redirect: null, keepValues: true });
    expect(inFlight.current).toBe(false);
    expect(pending).toEqual([true, false]);
  });

  it("calls nothing while a submit is in flight", async () => {
    const { value, inFlight } = control();
    inFlight.current = true;
    const requestReset = vi.fn();

    expect(await submitForgotPassword(value, requestReset)).toBeNull();
    expect(requestReset).not.toHaveBeenCalled();
  });
});

describe("sign-up outcome", () => {
  const withSession = { user: { identities: [{}] }, session: {} };
  const noSession = { user: { identities: [{}] }, session: null };

  it("with a session: success message, refresh then push after 2000 ms, values kept", () => {
    expect(signUpOutcome({ data: withSession, error: null })).toEqual({
      message: { text: SIGN_UP_SESSION_MESSAGE, type: "success" },
      redirect: { refresh: true, delayMs: 2000 },
      keepValues: true,
    });
  });

  it("without a session: the check-your-mail message and the page stays", () => {
    expect(signUpOutcome({ data: noSession, error: null })).toEqual({
      message: { text: SIGN_UP_CHECK_MAIL_MESSAGE, type: "success" },
      redirect: null,
      keepValues: true,
    });
  });

  it("treats a user with no identities as an email already registered, with or without a session", () => {
    for (const session of [null, {}]) {
      const outcome = signUpOutcome({ data: { user: { identities: [] }, session }, error: null });
      expect(outcome.message).toEqual({ text: SIGN_UP_TAKEN_MESSAGE, type: "error" });
      expect(outcome.redirect).toBeNull();
    }
  });

  it("maps user_already_exists to the email-taken message", () => {
    expect(signUpOutcome({ data: null, error: { code: "user_already_exists", status: 422 } }).message.text).toBe(
      SIGN_UP_TAKEN_MESSAGE,
    );
  });

  it("maps weak_password", () => {
    expect(signUpOutcome({ data: null, error: { code: "weak_password", status: 422 } }).message).toEqual({
      text: SIGN_UP_WEAK_PASSWORD_MESSAGE,
      type: "error",
    });
  });

  it.each([{ code: "over_email_send_rate_limit" }, { code: "over_request_rate_limit" }, { status: 429 }])(
    "maps the rate limit %j",
    (error) => {
      expect(signUpOutcome({ data: null, error }).message).toEqual({ text: RATE_LIMIT_MESSAGE, type: "error" });
    },
  );

  // Supabase's own text is English and can name the account, so an unknown error never shows it.
  it("answers the generic Vietnamese message for any other error and keeps the values", () => {
    const outcome = signUpOutcome({ data: null, error: { code: "unexpected_failure", status: 500 } });
    expect(outcome).toEqual({ message: { text: SIGN_UP_FAILED_MESSAGE, type: "error" }, redirect: null, keepValues: true });
  });

  it("keeps the email-taken and the wrong-password messages apart", () => {
    expect(SIGN_UP_TAKEN_MESSAGE).not.toBe(SIGN_IN_FAILED_MESSAGE);
  });
});

describe("sign-up submit", () => {
  it("returns the outcome and releases the guard and the pending state", async () => {
    const { value, inFlight, pending } = control();

    const outcome = await submitSignUp(value, async () => ({ data: { user: { identities: [{}] }, session: {} }, error: null }));

    expect(outcome?.message.text).toBe(SIGN_UP_SESSION_MESSAGE);
    expect(inFlight.current).toBe(false);
    expect(pending).toEqual([true, false]);
  });

  it("logs the detail of an unknown error and shows only the generic message", async () => {
    const { value, inFlight } = control();
    const detail = { code: "unexpected_failure", message: "Database error saving new user" };

    const outcome = await submitSignUp(value, async () => ({ data: null, error: detail }));

    expect(outcome?.message.text).toBe(SIGN_UP_FAILED_MESSAGE);
    expect(JSON.stringify(outcome)).not.toContain("Database error");
    expect(console.error).toHaveBeenCalledWith("Lỗi đăng ký:", detail);
    expect(inFlight.current).toBe(false);
  });

  it("shows the generic message for a rejected call, keeps the values and releases the guard", async () => {
    const { value, inFlight, pending } = control();

    const outcome = await submitSignUp(value, () => Promise.reject(new TypeError("Failed to fetch")));

    expect(outcome).toEqual({ message: { text: SIGN_UP_FAILED_MESSAGE, type: "error" }, redirect: null, keepValues: true });
    expect(inFlight.current).toBe(false);
    expect(pending).toEqual([true, false]);
  });

  it("calls nothing while a submit is in flight", async () => {
    const { value, inFlight } = control();
    inFlight.current = true;
    const signUp = vi.fn();

    expect(await submitSignUp(value, signUp)).toBeNull();
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe("reset-password outcome", () => {
  it("success: the toast text, a push to / after 1500 ms with no refresh", () => {
    expect(resetPasswordOutcome(null)).toEqual({
      message: { text: RESET_SUCCESS_MESSAGE, type: "success" },
      redirect: { refresh: false, delayMs: 1500 },
      keepValues: true,
    });
  });

  it("maps same_password and weak_password", () => {
    expect(resetPasswordOutcome({ code: "same_password" }).message).toEqual({ text: RESET_SAME_PASSWORD_MESSAGE, type: "error" });
    expect(resetPasswordOutcome({ code: "weak_password" }).message).toEqual({ text: RESET_WEAK_PASSWORD_MESSAGE, type: "error" });
  });

  it("answers the generic message for any other error, without a redirect", () => {
    const outcome = resetPasswordOutcome({ code: "unexpected_failure", status: 500 });
    expect(outcome).toEqual({ message: { text: RESET_FAILED_MESSAGE, type: "error" }, redirect: null, keepValues: true });
  });
});

describe("reset-password submit", () => {
  it("returns the outcome of a success and releases the guard and the pending state", async () => {
    const { value, inFlight, pending } = control();

    const outcome = await submitResetPassword(value, async () => ({ error: null }));

    expect(outcome).toEqual(resetPasswordOutcome(null));
    expect(inFlight.current).toBe(false);
    expect(pending).toEqual([true, false]);
  });

  it("maps an error returned in { data, error } and releases the guard", async () => {
    const { value, inFlight } = control();

    const outcome = await submitResetPassword(value, async () => ({ error: { code: "same_password" } }));

    expect(outcome?.message.text).toBe(RESET_SAME_PASSWORD_MESSAGE);
    expect(inFlight.current).toBe(false);
  });

  it("shows the generic message for a rejected call, keeps the values and releases the guard", async () => {
    const { value, inFlight, pending } = control();

    const outcome = await submitResetPassword(value, () => Promise.reject(new Error("offline")));

    expect(outcome).toEqual({ message: { text: RESET_FAILED_MESSAGE, type: "error" }, redirect: null, keepValues: true });
    expect(inFlight.current).toBe(false);
    expect(pending).toEqual([true, false]);
  });

  it("calls nothing while a submit is in flight", async () => {
    const { value, inFlight } = control();
    inFlight.current = true;
    const updatePassword = vi.fn();

    expect(await submitResetPassword(value, updatePassword)).toBeNull();
    expect(updatePassword).not.toHaveBeenCalled();
  });
});
