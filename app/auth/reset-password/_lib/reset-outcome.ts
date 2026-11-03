// What the reset page shows and does after `updateUser` answers. It imports no Supabase client, React or Next module
// (AF-U4 plan, G7) and has its own result function and submit helper: the reset page shows its outcome as a toast, not
// in the message box of the login page. The structural types below mirror the login route's on purpose, because a
// route's `_lib` is private to it.
type AuthErrorLike = { code?: string; status?: number } | null | undefined;
type AuthOutcome = {
  message: { text: string; type: "error" | "success" };
  redirect: { refresh: boolean; delayMs: number } | null;
  keepValues: boolean;
};
type SubmitControl = { inFlight: { current: boolean }; setPending: (pending: boolean) => void };

export const RESET_SUCCESS_MESSAGE = "Khôi phục mật khẩu thành công!";
export const RESET_SAME_PASSWORD_MESSAGE = "Mật khẩu mới phải khác mật khẩu cũ";
export const RESET_WEAK_PASSWORD_MESSAGE = "Mật khẩu quá yếu";
export const RESET_FAILED_MESSAGE = "Không đổi được mật khẩu, vui lòng thử lại";

const resetError = (text: string): AuthOutcome => ({ message: { text, type: "error" }, redirect: null, keepValues: true });

export function resetPasswordOutcome(error: AuthErrorLike): AuthOutcome {
  if (!error) {
    // No `router.refresh()` here, as before: the page only goes to "/".
    return {
      message: { text: RESET_SUCCESS_MESSAGE, type: "success" },
      redirect: { refresh: false, delayMs: 1500 },
      keepValues: true,
    };
  }
  if (error.code === "same_password") return resetError(RESET_SAME_PASSWORD_MESSAGE);
  if (error.code === "weak_password") return resetError(RESET_WEAK_PASSWORD_MESSAGE);
  return resetError(RESET_FAILED_MESSAGE);
}

export async function submitResetPassword(
  control: SubmitControl,
  updatePassword: () => Promise<{ error: AuthErrorLike }>,
): Promise<AuthOutcome | null> {
  if (control.inFlight.current) return null;
  control.inFlight.current = true;
  control.setPending(true);
  try {
    const { error } = await updatePassword();
    if (error) console.error("Lỗi đổi mật khẩu:", error);
    return resetPasswordOutcome(error);
  } catch (error) {
    console.error("Lỗi đổi mật khẩu:", error);
    return resetError(RESET_FAILED_MESSAGE);
  } finally {
    control.inFlight.current = false;
    control.setPending(false);
  }
}
