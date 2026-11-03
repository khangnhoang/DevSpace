"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { AuthInput, AuthSubmitButton, PasswordInput, usePasswordVisibility } from "@/app/components/AuthFields";
import {
  signUpAccountSchema,
  signUpProfileSchema,
  type SignUpAccountValues,
  type SignUpProfileInput,
  type SignUpProfileValues,
} from "@/lib/schemas/auth-forms";
import { AuthMessageBox } from "./AuthMessageBox";
import { submitSignUp, type AuthMessage } from "../_lib/auth-outcomes";

type Props = { onSwitchView: (view: "login") => void };

// Disabled while a sign-up is pending: leaving the step then coming back would mount a fresh form with a fresh
// in-flight flag and could send a second request while the first is still held.
const SwitchToSignIn = ({ onSwitchView, disabled = false }: Props & { disabled?: boolean }) => (
  <div className="mt-6 text-center">
    <button
      type="button"
      onClick={() => onSwitchView("login")}
      disabled={disabled}
      className="cursor-pointer text-sm text-gray-500 hover:text-blue-600 hover:underline disabled:cursor-default disabled:opacity-50"
    >
      Đã có tài khoản? Đăng nhập ngay
    </button>
  </div>
);

// The two steps are two forms: step 1 only checks the account fields and hands them up, step 2 sends everything to
// Auth. Going back to step 1 keeps its values because they live here, not in the step that unmounts.
export default function SignUpForm({ onSwitchView }: Props) {
  const [account, setAccount] = useState<SignUpAccountValues | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  return step === 2 && account ? (
    <ProfileStep account={account} onBack={() => setStep(1)} onSwitchView={onSwitchView} />
  ) : (
    <AccountStep
      initial={account}
      onNext={(values) => {
        setAccount(values);
        setStep(2);
      }}
      onSwitchView={onSwitchView}
    />
  );
}

function AccountStep({
  initial,
  onNext,
  onSwitchView,
}: Props & { initial: SignUpAccountValues | null; onNext: (account: SignUpAccountValues) => void }) {
  const password = usePasswordVisibility();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpAccountValues>({
    resolver: zodResolver(signUpAccountSchema),
    defaultValues: initial ?? { email: "", password: "", confirmPassword: "" },
  });

  return (
    <form onSubmit={(e) => handleSubmit(onNext)(e)} noValidate className="p-8">
      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
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
            placeholder="Mật khẩu (tối thiểu 8 ký tự)..."
            aria-label="Mật khẩu"
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
            placeholder="Xác nhận mật khẩu..."
            aria-label="Xác nhận mật khẩu"
            aria-invalid={!!errors.confirmPassword}
            type={password.visible ? "text" : "password"}
            {...register("confirmPassword")}
          />
          <FieldError className="text-xs" errors={[errors.confirmPassword]} />
        </Field>
      </div>

      <AuthSubmitButton pending={false} label="Tiếp tục">
        Tiếp tục <ArrowRight className="size-[18px]" />
      </AuthSubmitButton>

      <SwitchToSignIn onSwitchView={onSwitchView} />
    </form>
  );
}

function ProfileStep({
  account,
  onBack,
  onSwitchView,
}: Props & { account: SignUpAccountValues; onBack: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpProfileInput, unknown, SignUpProfileValues>({
    resolver: zodResolver(signUpProfileSchema),
    defaultValues: { full_name: "", phone: "", gender: "male" },
  });
  const inFlight = useRef(false);
  const phone = register("phone");

  const signUp = async (values: SignUpProfileValues) => {
    setMessage(null);
    const outcome = await submitSignUp({ inFlight, setPending }, () =>
      supabase.auth.signUp({
        email: account.email,
        password: account.password,
        options: {
          data: { full_name: values.full_name, phone: values.phone, gender: values.gender },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      }),
    );
    if (!outcome) return;
    setMessage(outcome.message);
    if (outcome.redirect) {
      if (outcome.redirect.refresh) router.refresh();
      setTimeout(() => router.push("/"), outcome.redirect.delayMs);
    }
  };

  return (
    <form onSubmit={(e) => handleSubmit(signUp)(e)} noValidate className="p-8">
      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={pending}
          className="mb-1 h-auto w-full cursor-pointer justify-start gap-1 rounded-none p-0 text-xs font-normal text-gray-500 hover:bg-transparent hover:text-blue-600"
        >
          <ArrowLeft className="size-3" /> Quay lại bước trước
        </Button>
        <Field className="gap-1.5" data-invalid={!!errors.full_name}>
          <AuthInput
            placeholder="Họ và tên đầy đủ..."
            aria-label="Họ và tên"
            aria-invalid={!!errors.full_name}
            {...register("full_name")}
          />
          <FieldError className="text-xs" errors={[errors.full_name]} />
        </Field>
        <Field className="gap-1.5" data-invalid={!!errors.phone}>
          <AuthInput
            placeholder="Số điện thoại (10 số)..."
            aria-label="Số điện thoại"
            aria-invalid={!!errors.phone}
            type="tel"
            maxLength={10}
            {...phone}
            // Digits only: a pasted or typed letter never reaches the field.
            onChange={(e) => {
              e.target.value = e.target.value.replace(/\D/g, "");
              return phone.onChange(e);
            }}
          />
          <FieldError className="text-xs" errors={[errors.phone]} />
        </Field>
        <Field
          className="gap-1.5 [&_[data-slot=native-select-wrapper]]:w-full"
          data-invalid={!!errors.gender}
        >
          <NativeSelect
            aria-label="Giới tính"
            aria-invalid={!!errors.gender}
            className="h-auto rounded-lg border-gray-200 bg-white px-4 py-3 text-base text-gray-700 shadow-none focus-visible:border-blue-600 focus-visible:ring-blue-600/10"
            {...register("gender")}
          >
            <NativeSelectOption value="male">Nam</NativeSelectOption>
            <NativeSelectOption value="female">Nữ</NativeSelectOption>
            <NativeSelectOption value="other">Khác</NativeSelectOption>
          </NativeSelect>
          <FieldError className="text-xs" errors={[errors.gender]} />
        </Field>
      </div>

      <AuthMessageBox message={message} />

      <AuthSubmitButton pending={pending} label="Hoàn tất đăng ký">
        Hoàn tất đăng ký
      </AuthSubmitButton>

      <SwitchToSignIn onSwitchView={onSwitchView} disabled={pending} />
    </form>
  );
}
