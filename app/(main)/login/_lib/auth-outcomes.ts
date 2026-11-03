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

// --- Sign up ---

export const SIGN_UP_TAKEN_MESSAGE = "Email này đã được sử dụng. Vui lòng chọn email khác hoặc đăng nhập.";
export const SIGN_UP_WEAK_PASSWORD_MESSAGE = "Mật khẩu quá yếu";
// Never Supabase's own English text (Owner decision 2026-11-03); the detail goes to the console.
export const SIGN_UP_FAILED_MESSAGE = "Đăng ký thất bại, vui lòng thử lại";
export const SIGN_UP_SESSION_MESSAGE = "Đăng ký thành công! Đang đăng nhập...";
export const SIGN_UP_CHECK_MAIL_MESSAGE = "Đăng ký thành công! Vui lòng kiểm tra email để kích hoạt tài khoản.";

// The part of `signUp`'s `data` the mapping reads. With confirmations on, Supabase answers a registered address with
// a user that has no identities instead of an error.
export type SignUpData = { user?: { identities?: unknown[] | null } | null; session?: unknown } | null;

const signUpError = (text: string): AuthOutcome => ({ message: { text, type: "error" }, redirect: null, keepValues: true });

export function signUpOutcome({ data, error }: { data?: SignUpData; error: AuthErrorLike }): AuthOutcome {
  const emailTaken = error?.code === "user_already_exists" || (!error && data?.user?.identities?.length === 0);
  if (emailTaken) return signUpError(SIGN_UP_TAKEN_MESSAGE);
  if (error) {
    if (error.code === "weak_password") return signUpError(SIGN_UP_WEAK_PASSWORD_MESSAGE);
    if (isRateLimited(error)) return signUpError(RATE_LIMIT_MESSAGE);
    return signUpError(SIGN_UP_FAILED_MESSAGE);
  }
  if (data?.session) {
    return {
      message: { text: SIGN_UP_SESSION_MESSAGE, type: "success" },
      redirect: { refresh: true, delayMs: 2000 },
      keepValues: true,
    };
  }
  // No session: the account waits for its mail, so the page stays for the visitor to read the message.
  return { message: { text: SIGN_UP_CHECK_MAIL_MESSAGE, type: "success" }, redirect: null, keepValues: true };
}

export async function submitSignUp(
  control: SubmitControl,
  signUp: () => Promise<{ data: SignUpData; error: AuthErrorLike }>,
): Promise<AuthOutcome | null> {
  if (control.inFlight.current) return null;
  control.inFlight.current = true;
  control.setPending(true);
  try {
    const result = await signUp();
    if (result.error && result.error.code !== "user_already_exists") console.error("Lỗi đăng ký:", result.error);
    return signUpOutcome(result);
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    return signUpError(SIGN_UP_FAILED_MESSAGE);
  } finally {
    control.inFlight.current = false;
    control.setPending(false);
  }
}
