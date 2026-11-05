"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import {
  AUTH_SUBMIT_CLASS,
  AuthInput,
  PasswordInput,
  usePasswordVisibility,
} from "@/app/components/AuthFields";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/lib/schemas/auth-forms";
import { submitResetPassword } from "./_lib/reset-outcome";

function redirectToRecoveryEntry(
  router: Pick<ReturnType<typeof useRouter>, "replace">,
) {
  toast.error(
    "Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.",
    { id: "reset-link-invalid" },
  );
  router.replace("/login");
}

async function verifiedRecoverySession() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session) return null;

  const accessToken = session.access_token;
  const { data, error } = await supabase.auth.getClaims(accessToken);
  const claims = data?.claims;
  if (
    error ||
    !claims?.sub ||
    !claims.session_id ||
    !claims.amr?.some(
      (entry) => typeof entry !== "string" && entry.method === "recovery",
    )
  )
    return null;

  return { accessToken, userId: claims.sub, sessionId: claims.session_id };
}

async function updateRecoveryPassword(accessToken: string, password: string) {
  // Sending the verified JWT explicitly prevents the SDK from picking up a
  // replacement browser session between verification and the write.
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
    {
      method: "PUT",
      redirect: "error",
      credentials: "omit",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    },
  );
  if (response.ok) return { error: null };

  const { error_code: code } = await response.json().catch(() => ({}));
  return { error: { code, status: response.status } };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [recovery, setRecovery] = useState<{
    userId: string;
    sessionId: string;
  } | null>(null);
  const password = usePasswordVisibility();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  // Set before the first await (inside the submit helper): see the login forms.
  const inFlight = useRef(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    void verifiedRecoverySession()
      .catch(() => null)
      .then((session) => {
        if (!active) return;
        if (session)
          setRecovery({ userId: session.userId, sessionId: session.sessionId });
        else redirectToRecoveryEntry(router);
      });
    return () => {
      active = false;
      if (redirectTimer.current !== null) clearTimeout(redirectTimer.current);
    };
  }, [router]);

  const handleResetPassword = async (values: ResetPasswordValues) => {
    if (!recovery || redirectTimer.current !== null) return;
    let recoveryLost = false;
    const outcome = await submitResetPassword(
      { inFlight, setPending: setLoading },
      async () => {
        const session = await verifiedRecoverySession().catch(() => null);
        if (
          !session ||
          session.sessionId !== recovery.sessionId ||
          session.userId !== recovery.userId
        ) {
          recoveryLost = true;
          return { error: { code: "session_not_found" } };
        }
        return updateRecoveryPassword(session.accessToken, values.password);
      },
    );
    if (!outcome) return;
    if (recoveryLost) {
      setRecovery(null);
      redirectToRecoveryEntry(router);
      return;
    }
    if (outcome.message.type === "success") toast.success(outcome.message.text);
    else toast.error(outcome.message.text);
    if (outcome.redirect)
      redirectTimer.current = setTimeout(
        () => router.push("/"),
        outcome.redirect.delayMs,
      );
  };

  if (!recovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="animate-spin text-blue-600" size={32} />
          <p className="text-gray-500">Đang xác thực liên kết...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95">
        <div className="bg-blue-600 p-6 text-center">
          <div className="mx-auto w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3 text-white">
            <Lock size={24} />
          </div>
          <h1 className="text-2xl font-bold text-white">Đặt lại mật khẩu</h1>
          <p className="text-blue-100 text-sm mt-1">
            Nhập mật khẩu mới cho tài khoản của bạn
          </p>
        </div>

        <form
          onSubmit={(e) => handleSubmit(handleResetPassword)(e)}
          noValidate
          className="p-8 space-y-5"
        >
          <Field className="gap-1.5" data-invalid={!!errors.password}>
            <PasswordInput
              className="pr-10 placeholder:text-gray-400"
              placeholder="Mật khẩu mới..."
              aria-label="Mật khẩu mới"
              aria-invalid={!!errors.password}
              visible={password.visible}
              onToggle={password.toggle}
              toggleTabIndex={-1}
              {...register("password")}
            />
            <FieldError className="text-xs" errors={[errors.password]} />
          </Field>

          <Field className="gap-1.5" data-invalid={!!errors.confirmPassword}>
            <AuthInput
              className="placeholder:text-gray-400"
              type={password.visible ? "text" : "password"}
              placeholder="Nhập lại mật khẩu..."
              aria-label="Nhập lại mật khẩu"
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            <FieldError className="text-xs" errors={[errors.confirmPassword]} />
          </Field>

          <Button
            type="submit"
            disabled={loading}
            className={AUTH_SUBMIT_CLASS}
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <CheckCircle className="size-5" />
            )}
            Đổi mật khẩu
          </Button>
        </form>
      </div>
    </div>
  );
}
