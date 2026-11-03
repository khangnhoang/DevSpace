"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { AuthInput, AuthSubmitButton } from "@/app/components/AuthFields";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/schemas/auth-forms";
import { AuthMessageBox } from "./AuthMessageBox";
import { submitForgotPassword, type AuthMessage } from "../_lib/auth-outcomes";

export default function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const inFlight = useRef(false);

  const requestReset = async ({ email }: ForgotPasswordValues) => {
    setMessage(null);
    const outcome = await submitForgotPassword({ inFlight, setPending }, () =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`, // Sau khi bấm link trong mail thì bay về trang đổi pass
      }),
    );
    if (outcome) setMessage(outcome.message);
  };

  return (
    <form onSubmit={(e) => handleSubmit(requestReset)(e)} noValidate className="p-8">
      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="mb-1 h-auto w-full cursor-pointer justify-start gap-1 rounded-none p-0 text-xs font-normal text-gray-500 hover:bg-transparent hover:text-blue-600"
        >
          <ArrowLeft className="size-3" /> Quay lại đăng nhập
        </Button>
        <div className="bg-blue-50 text-blue-800 p-3 rounded text-sm mb-2">
          Nhập email bạn đã đăng ký, chúng tôi sẽ gửi liên kết để đặt lại mật khẩu.
        </div>
        <Field className="gap-1.5" data-invalid={!!errors.email}>
          <div className="relative">
            <Mail size={18} className="absolute left-3 top-4 text-gray-400" />
            <AuthInput
              className="pl-10"
              placeholder="Email của bạn..."
              aria-label="Email"
              aria-invalid={!!errors.email}
              type="email"
              {...register("email")}
            />
          </div>
          <FieldError className="text-xs" errors={[errors.email]} />
        </Field>
      </div>

      <AuthMessageBox message={message} />

      <AuthSubmitButton pending={pending} label="Gửi yêu cầu">Gửi yêu cầu</AuthSubmitButton>
    </form>
  );
}
