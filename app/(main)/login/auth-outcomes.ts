// What each login-page flow shows and does after Supabase Auth answers. These modules import no Supabase client,
// React or Next module (AF-U4 plan, G7): the component passes the auth call in, so a unit test runs the mapping
// with a stub and no network. There is one result function and one submit helper per flow on purpose, and no
// helper shared by the flows: the techstack migration replaces Supabase Auth, and a shared layer would outlive it.

export type AuthMessage = { text: string; type: "error" | "success" };
// `refresh` is `router.refresh()` before the push; `delayMs` is the wait before `router.push("/")`.
export type AuthRedirect = { refresh: boolean; delayMs: number };
export type AuthOutcome = { message: AuthMessage; redirect: AuthRedirect | null; keepValues: boolean };

// The part of an Auth error the mapping reads; supabase-js errors satisfy it.
export type AuthErrorLike = { code?: string; status?: number } | null | undefined;

// The in-flight flag and the pending state of one form. The flag is a ref-like object that is set before the first
// await, because two submit events can arrive before React renders the disabled button.
export type SubmitControl = {
  inFlight: { current: boolean };
  setPending: (pending: boolean) => void;
};

const RATE_LIMIT_CODES = ["over_request_rate_limit", "over_email_send_rate_limit"];
const isRateLimited = (error: NonNullable<AuthErrorLike>) =>
  error.status === 429 || (error.code !== undefined && RATE_LIMIT_CODES.includes(error.code));

export const RATE_LIMIT_MESSAGE = "Bạn thử quá nhiều lần, vui lòng đợi một lúc rồi thử lại";

// --- Sign in ---

export const SIGN_IN_SUCCESS_MESSAGE = "Đăng nhập thành công!";
export const SIGN_IN_UNCONFIRMED_MESSAGE = "Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.";
// Generic on purpose: do not reveal whether the email is registered (G3).
export const SIGN_IN_FAILED_MESSAGE = "Email hoặc mật khẩu không đúng";
export const SIGN_IN_THROWN_MESSAGE = "Lỗi hệ thống, vui lòng thử lại";

const signInError = (text: string): AuthOutcome => ({ message: { text, type: "error" }, redirect: null, keepValues: true });

export function signInOutcome(error: AuthErrorLike): AuthOutcome {
  if (!error) {
    return {
      message: { text: SIGN_IN_SUCCESS_MESSAGE, type: "success" },
      redirect: { refresh: true, delayMs: 1000 },
      keepValues: true,
    };
  }
  if (error.code === "email_not_confirmed") return signInError(SIGN_IN_UNCONFIRMED_MESSAGE);
  if (isRateLimited(error)) return signInError(RATE_LIMIT_MESSAGE);
  return signInError(SIGN_IN_FAILED_MESSAGE);
}

// Returns `null` without calling when a submit is already in flight. An `error` returned in `{ data, error }` and a
// rejected call both release the guard and the pending state.
export async function submitSignIn(
  control: SubmitControl,
  signIn: () => Promise<{ error: AuthErrorLike }>,
): Promise<AuthOutcome | null> {
  if (control.inFlight.current) return null;
  control.inFlight.current = true;
  control.setPending(true);
  try {
    const { error } = await signIn();
    return signInOutcome(error);
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    return signInError(SIGN_IN_THROWN_MESSAGE);
  } finally {
    control.inFlight.current = false;
    control.setPending(false);
  }
}

// --- Forgot password ---

export const FORGOT_SUCCESS_MESSAGE = "Đã gửi link khôi phục! Vui lòng kiểm tra email (cả mục Spam).";
export const FORGOT_FAILED_MESSAGE = "Gửi yêu cầu thất bại (Thử lại sau 1p)";

const forgotFailed: AuthOutcome = { message: { text: FORGOT_FAILED_MESSAGE, type: "error" }, redirect: null, keepValues: true };

// Supabase does not report unknown emails here, which keeps them private (G3): any accepted request is a success.
export function forgotPasswordOutcome(error: AuthErrorLike): AuthOutcome {
  if (error) return forgotFailed;
  return { message: { text: FORGOT_SUCCESS_MESSAGE, type: "success" }, redirect: null, keepValues: true };
}

export async function submitForgotPassword(
  control: SubmitControl,
  requestReset: () => Promise<{ error: AuthErrorLike }>,
): Promise<AuthOutcome | null> {
  if (control.inFlight.current) return null;
  control.inFlight.current = true;
  control.setPending(true);
  try {
    const { error } = await requestReset();
    return forgotPasswordOutcome(error);
  } catch (error) {
    console.error("Lỗi gửi yêu cầu khôi phục:", error);
    return forgotFailed;
  } finally {
    control.inFlight.current = false;
    control.setPending(false);
  }
}
