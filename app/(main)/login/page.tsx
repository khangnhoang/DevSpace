"use client";
import { useState } from "react";
import ForgotPasswordForm from "./_components/ForgotPasswordForm";
import SignInForm from "./_components/SignInForm";
import SignUpForm from "./_components/SignUpForm";

type ViewState = "login" | "register" | "forgot";

// The page keeps only the view and the card. Each view is a form with its own state, so switching view starts the
// next one empty.
export default function LoginPage() {
  const [view, setView] = useState<ViewState>("login");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden transition-all duration-300">
        {/* Header */}
        <div className="bg-blue-600 p-6 text-center">
          <h1 className="text-2xl font-bold text-white">
            {view === "login" ? "Chào mừng trở lại" : "Tạo tài khoản mới"}
          </h1>
          <p className="text-blue-100 text-sm mt-1">
            {view === "login" ? "Đăng nhập để tiếp tục học tập" : "Đăng ký chỉ với 2 bước đơn giản"}
          </p>
        </div>

        {view === "login" && <SignInForm onSwitchView={setView} />}
        {view === "register" && <SignUpForm onSwitchView={setView} />}
        {view === "forgot" && <ForgotPasswordForm onBack={() => setView("login")} />}
      </div>
    </div>
  );
}
