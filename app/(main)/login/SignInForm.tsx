"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/lib/supabase";
import { Field, FieldError } from "@/components/ui/field";
import { AuthInput, AuthSubmitButton, PasswordInput, usePasswordVisibility } from "@/app/components/AuthFields";
import { signInSchema, type SignInValues } from "@/lib/schemas/auth-forms";
import { AuthMessageBox } from "./AuthMessageBox";
import { submitSignIn, type AuthMessage } from "./auth-outcomes";

export default function SignInForm({ onSwitchView }: { onSwitchView: (view: "register" | "forgot") => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const password = usePasswordVisibility();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });
  // Set before the first await (inside the submit helper): the resolver runs before React Hook Form sets
  // isSubmitting, so two Enter presses can both reach the handler before the button renders as disabled.
  const inFlight = useRef(false);

  const signIn = async (values: SignInValues) => {
    setMessage(null);
    const outcome = await submitSignIn({ inFlight, setPending }, () =>
      supabase.auth.signInWithPassword({ email: values.email, password: values.password }),
    );
    if (!outcome) return;
    setMessage(outcome.message);
    if (outcome.redirect) {
      if (outcome.redirect.refresh) router.refresh();
      setTimeout(() => router.push("/"), outcome.redirect.delayMs);
    }
  };

  return (
    <form onSubmit={(e) => handleSubmit(signIn)(e)} noValidate className="p-8">
      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-left-4 duration-300">
        <Field className="gap-1.5" data-invalid={!!errors.email}>
          <AuthInput
            placeholder="Email..."
            aria-label="Email"
            aria-invalid={!!errors.email}
            type="email"
            {...register("email")}
          />
          <FieldError className="text-xs" errors={[errors.email]} />
        </Field>
        <Field className="gap-1.5" data-invalid={!!errors.password}>
          <PasswordInput
            placeholder="Mật khẩu..."
            aria-label="Mật khẩu"
            aria-invalid={!!errors.password}
            visible={password.visible}
            onToggle={password.toggle}
            {...register("password")}
          />
          <FieldError className="text-xs" errors={[errors.password]} />
        </Field>
        {/* Nút Quên mật khẩu nhỏ */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onSwitchView("forgot")}
            className="cursor-pointer text-xs text-blue-600 hover:underline"
          >
            Quên mật khẩu?
          </button>
        </div>
      </div>

      <AuthMessageBox message={message} />

      <AuthSubmitButton pending={pending} label="Đăng nhập">Đăng nhập</AuthSubmitButton>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => onSwitchView("register")}
          className="cursor-pointer text-sm text-gray-500 hover:text-blue-600 hover:underline"
        >
          Chưa có tài khoản? Đăng ký miễn phí
        </button>
      </div>
    </form>
  );
}
