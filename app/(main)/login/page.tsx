"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  Mail,
} from "lucide-react";

type ViewState = "login" | "register" | "forgot";
type AuthMessage = { text: string; type: "error" | "success" };

// --- HELPER: REGEX VALIDATION ---
const isValidPhone = (phone: string) => {
  // Regex số điện thoại VN: 10 số, bắt đầu bằng 0
  const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/g;
  return phoneRegex.test(phone);
};

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ViewState>("login");
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const [showPass, setShowPass] = useState(false); // Toggle xem pass

  // -- State Form --
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("male");
  const [registerStep, setRegisterStep] = useState(1);

  // --- 1. XỬ LÝ ĐĂNG NHẬP ---
  const handleLogin = async () => {
    // Validate cơ bản
    if (!email || !password) {
      setMessage({ text: "Vui lòng điền đầy đủ thông tin", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Generic on purpose: do not reveal whether the email is registered.
        if (error.code === "email_not_confirmed") {
          setMessage({
            text: "Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.",
            type: "error",
          });
        } else if (error.status === 429 || error.code === "over_request_rate_limit") {
          setMessage({
            text: "Bạn thử quá nhiều lần, vui lòng đợi một lúc rồi thử lại",
            type: "error",
          });
        } else {
          setMessage({ text: "Email hoặc mật khẩu không đúng", type: "error" });
        }
      } else {
        setMessage({ text: "Đăng nhập thành công!", type: "success" });
        router.refresh();
        setTimeout(() => router.push("/"), 1000);
      }
    } catch {
      setMessage({ text: "Lỗi hệ thống, vui lòng thử lại", type: "error" });
    }
    setLoading(false);
  };

  // --- 2. XỬ LÝ CHUYỂN BƯỚC ĐĂNG KÝ (Step 1 -> Step 2) ---
  const handleNextStep = () => {
    setMessage(null);

    // Validate Input
    if (!email || !password || !confirmPassword) {
      setMessage({ text: "Vui lòng điền đầy đủ thông tin", type: "error" });
      return;
    }
    if (!isValidEmail(email)) {
      setMessage({ text: "Email không đúng định dạng", type: "error" });
      return;
    }
    if (password.length < 8) {
      setMessage({ text: "Mật khẩu phải có ít nhất 8 ký tự", type: "error" });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ text: "Mật khẩu xác nhận không khớp", type: "error" });
      return;
    }

    // The "email already used" check happens after signUp (see handleSignUp).
    setRegisterStep(2);
  };

  // --- 3. XỬ LÝ ĐĂNG KÝ (Gửi Full Info) ---
  const handleSignUp = async () => {
    // Validate Step 2
    if (!fullName || !phone) {
      setMessage({ text: "Vui lòng nhập Họ tên và SĐT", type: "error" });
      return;
    }
    if (!isValidPhone(phone)) {
      setMessage({ text: "Số điện thoại không hợp lệ (10 số)", type: "error" });
      return;
    }

    setLoading(true);

    // Gọi Supabase Sign Up
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
          gender: gender,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    const emailTaken =
      error?.code === "user_already_exists" ||
      (!error && data.user && data.user.identities?.length === 0);

    if (emailTaken) {
      setMessage({
        text: "Email này đã được sử dụng. Vui lòng chọn email khác hoặc đăng nhập.",
        type: "error",
      });
    } else if (error) {
      setMessage({ text: error.message, type: "error" });
    } else if (data.session) {
      // 🟢 CASE 1: Server trả về Session -> Login luôn (Do tắt confirm email)
      setMessage({
        text: "Đăng ký thành công! Đang đăng nhập...",
        type: "success",
      });
      router.refresh();
      setTimeout(() => router.push("/"), 2000);
    } else {
      // 🟡 CASE 2: Không có Session -> Phải check mail (Logic chuẩn)
      setMessage({
        text: "Đăng ký thành công! Vui lòng kiểm tra email để kích hoạt tài khoản.",
        type: "success",
      });
      // KHÔNG REDIRECT: Để user đọc thông báo và tự đi check mail
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage({ text: "Vui lòng nhập email để khôi phục", type: "error" });
      return;
    }
    if (!isValidEmail(email)) {
      setMessage({ text: "Email không đúng định dạng", type: "error" });
      return;
    }

    setLoading(true);
    // Gửi yêu cầu reset
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`, // Sau khi bấm link trong mail thì bay về trang Profile để đổi pass
    });

    if (error) {
      // Supabase does not report unknown emails here, which keeps them private.
      setMessage({
        text: "Gửi yêu cầu thất bại (Thử lại sau 1p)",
        type: "error",
      });
    } else {
      setMessage({
        text: "Đã gửi link khôi phục! Vui lòng kiểm tra email (cả mục Spam).",
        type: "success",
      });
    }
    setLoading(false);
  };

  // --- MAIN HANDLER (ĐÃ FIX) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (view === "login") {
      await handleLogin();
    } else if (view === "forgot") {
      // 👇 Thêm case này để gọi đúng hàm
      await handleForgotPassword();
    } else {
      // Case Register
      if (registerStep === 1) {
        handleNextStep();
      } else {
        await handleSignUp();
      }
    }
  };

  const switchView = (newView: ViewState) => {
    setView(newView);
    setRegisterStep(1);
    setMessage(null);
    setEmail("");
    setPassword("");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden transition-all duration-300">
        {/* Header */}
        <div className="bg-blue-600 p-6 text-center">
          <h1 className="text-2xl font-bold text-white">
            {view === "login" ? "Chào mừng trở lại" : "Tạo tài khoản mới"}
          </h1>
          <p className="text-blue-100 text-sm mt-1">
            {view === "login"
              ? "Đăng nhập để tiếp tục học tập"
              : "Đăng ký chỉ với 2 bước đơn giản"}
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-8">
          {/* --- VIEW: LOGIN --- */}
          {view === "login" && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-left-4 duration-300">
              <input
                className="input-field"
                placeholder="Email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
              />
              <div className="relative">
                <input
                  className="input-field"
                  placeholder="Mật khẩu..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPass ? "text" : "password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="cursor-pointer absolute right-3 top-4 text-gray-400 hover:text-blue-600"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* Nút Quên mật khẩu nhỏ */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => switchView("forgot")}
                  className="cursor-pointer text-xs text-blue-600 hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>
            </div>
          )}

          {/* VIEW: FORGOT PASSWORD (MỚI) */}
          {view === "forgot" && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
              <div
                onClick={() => switchView("login")}
                className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer hover:text-blue-600 mb-1"
              >
                <ArrowLeft size={12} /> Quay lại đăng nhập
              </div>
              <div className="bg-blue-50 text-blue-800 p-3 rounded text-sm mb-2">
                Nhập email bạn đã đăng ký, chúng tôi sẽ gửi liên kết để đặt lại
                mật khẩu.
              </div>
              <div className="relative">
                {/* 👇 Thay KeyRound bằng Mail cho đúng bài */}
                <Mail
                  size={18}
                  className="absolute left-3 top-4 text-gray-400"
                />
                <input
                  className="input-field"
                  // 👇 Thêm style này để ép padding, tránh chữ đè lên icon
                  style={{ paddingLeft: "40px" }}
                  placeholder="Email của bạn..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                />
              </div>
            </div>
          )}

          {/* --- VIEW: REGISTER STEP 1 --- */}
          {view === "register" && registerStep === 1 && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <input
                className="input-field"
                placeholder="Email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
              />
              <div className="relative">
                <input
                  className="input-field"
                  placeholder="Mật khẩu (tối thiểu 8 ký tự)..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPass ? "text" : "password"}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-4 text-gray-400 hover:text-blue-600"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <input
                className="input-field"
                placeholder="Xác nhận mật khẩu..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type={showPass ? "text" : "password"}
              />
            </div>
          )}

          {/* --- VIEW: REGISTER STEP 2 --- */}
          {view === "register" && registerStep === 2 && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div
                onClick={() => setRegisterStep(1)}
                className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer hover:text-blue-600 mb-1"
              >
                <ArrowLeft size={12} /> Quay lại bước trước
              </div>
              <input
                className="input-field"
                placeholder="Họ và tên đầy đủ..."
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <input
                className="input-field"
                placeholder="Số điện thoại (10 số)..."
                value={phone}
                type="tel"
                maxLength={10}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} // Chỉ cho nhập số
              />
              <select
                className="input-field bg-white"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>
          )}

          {/* Message Box */}
          {message && (
            <div
              className={`mt-4 p-3 rounded text-sm text-center font-medium animate-in zoom-in-95 ${message.type === "error" ? "bg-red-50 text-red-600 border border-red-100" : "bg-green-50 text-green-600 border border-green-100"}`}
            >
              {message.text}
            </div>
          )}

          {/* Submit Button (ĐÃ FIX) */}
          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : view === "login" ? (
              "Đăng nhập"
            ) : view === "forgot" ? ( // 👈 Thêm case này
              "Gửi yêu cầu"
            ) : registerStep === 1 ? (
              <>
                Tiếp tục <ArrowRight size={18} />
              </>
            ) : (
              "Hoàn tất đăng ký"
            )}
          </button>

          {/* Footer Switch */}
          {view !== "forgot" && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() =>
                  switchView(view === "login" ? "register" : "login")
                }
                className="cursor-pointer text-sm text-gray-500 hover:text-blue-600 hover:underline"
              >
                {view === "register"
                  ? "Đã có tài khoản? Đăng nhập ngay"
                  : "Chưa có tài khoản? Đăng ký miễn phí"}
              </button>
            </div>
          )}
        </form>
      </div>

      <style jsx>{`
        .input-field {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          color: #374151;
          transition: all 0.2s;
          outline: none;
        }
        .input-field:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .input-field::-ms-reveal,
        .input-field::-ms-clear {
          display: none;
        }
        .input-field::-webkit-password-reveal-button {
          display: none;
          -webkit-appearance: none;
        }
      `}</style>
    </div>
  );
}
