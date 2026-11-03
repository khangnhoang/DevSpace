"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AuthInput, AuthSubmitButton, PasswordInput, usePasswordVisibility } from "@/app/components/AuthFields";
import { AuthMessageBox } from "./AuthMessageBox";
import type { AuthMessage } from "./auth-outcomes";

// Moved from the old login page unchanged in CP1 of AF-U4; CP2 converts it to React Hook Form.
const isValidPhone = (phone: string) => /(84|0[3|5|7|8|9])+([0-9]{8})\b/g.test(phone);
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function SignUpForm({ onSwitchView }: { onSwitchView: (view: "login") => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const password = usePasswordVisibility();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("male");
  const [registerStep, setRegisterStep] = useState(1);

  const handleNextStep = () => {
    setMessage(null);
    if (!email || !pass || !confirmPassword) {
      setMessage({ text: "Vui lòng điền đầy đủ thông tin", type: "error" });
      return;
    }
    if (!isValidEmail(email)) {
      setMessage({ text: "Email không đúng định dạng", type: "error" });
      return;
    }
    if (pass.length < 8) {
      setMessage({ text: "Mật khẩu phải có ít nhất 8 ký tự", type: "error" });
      return;
    }
    if (pass !== confirmPassword) {
      setMessage({ text: "Mật khẩu xác nhận không khớp", type: "error" });
      return;
    }
    setRegisterStep(2);
  };

  const handleSignUp = async () => {
    if (!fullName || !phone) {
      setMessage({ text: "Vui lòng nhập Họ tên và SĐT", type: "error" });
      return;
    }
    if (!isValidPhone(phone)) {
      setMessage({ text: "Số điện thoại không hợp lệ (10 số)", type: "error" });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: { full_name: fullName, phone: phone, gender: gender },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    const emailTaken =
      error?.code === "user_already_exists" || (!error && data.user && data.user.identities?.length === 0);

    if (emailTaken) {
      setMessage({
        text: "Email này đã được sử dụng. Vui lòng chọn email khác hoặc đăng nhập.",
        type: "error",
      });
    } else if (error) {
      setMessage({ text: error.message, type: "error" });
    } else if (data.session) {
      setMessage({ text: "Đăng ký thành công! Đang đăng nhập...", type: "success" });
      router.refresh();
      setTimeout(() => router.push("/"), 2000);
    } else {
      setMessage({
        text: "Đăng ký thành công! Vui lòng kiểm tra email để kích hoạt tài khoản.",
        type: "success",
      });
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerStep === 1) handleNextStep();
    else await handleSignUp();
  };

  return (
    <form onSubmit={handleSubmit} className="p-8">
      {registerStep === 1 && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <AuthInput placeholder="Email..." value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          <PasswordInput
            placeholder="Mật khẩu (tối thiểu 8 ký tự)..."
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            visible={password.visible}
            onToggle={password.toggle}
            toggleTabIndex={-1}
          />
          <AuthInput
            placeholder="Xác nhận mật khẩu..."
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type={password.visible ? "text" : "password"}
          />
        </div>
      )}

      {registerStep === 2 && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <button
            type="button"
            onClick={() => setRegisterStep(1)}
            className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer hover:text-blue-600 mb-1"
          >
            <ArrowLeft size={12} /> Quay lại bước trước
          </button>
          <AuthInput placeholder="Họ và tên đầy đủ..." value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <AuthInput
            placeholder="Số điện thoại (10 số)..."
            value={phone}
            type="tel"
            maxLength={10}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          />
          <select
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-700"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
          </select>
        </div>
      )}

      <AuthMessageBox message={message} />

      <AuthSubmitButton pending={loading} label={registerStep === 1 ? "Tiếp tục" : "Hoàn tất đăng ký"}>
        {registerStep === 1 ? (
          <>
            Tiếp tục <ArrowRight className="size-[18px]" />
          </>
        ) : (
          "Hoàn tất đăng ký"
        )}
      </AuthSubmitButton>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => onSwitchView("login")}
          className="cursor-pointer text-sm text-gray-500 hover:text-blue-600 hover:underline"
        >
          Đã có tài khoản? Đăng nhập ngay
        </button>
      </div>
    </form>
  );
}
