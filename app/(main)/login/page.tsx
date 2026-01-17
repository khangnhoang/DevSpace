"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

type ViewState = "login" | "register";
type AuthMessage = { text: string; type: "error" | "success" };

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ViewState>("login");
  const [message, setMessage] = useState<AuthMessage | null>(null);

  // -- State cho Form --
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // State riêng cho Register
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("male");

  // State quản lý bước đăng ký (1: TK/MK, 2: Info cá nhân)
  const [registerStep, setRegisterStep] = useState(1);

  // 1. Xử lý Đăng nhập
  const handleLogin = async () => {
    if (!email || !password) {
      setMessage({ text: "Vui lòng điền đầy đủ thông tin", type: "error" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage({ text: "Sai email hoặc mật khẩu", type: "error" });
      setLoading(false);
    } else {
      setMessage({ text: "Đăng nhập thành công!", type: "success" });
      router.refresh();
      setTimeout(() => router.push("/"), 1000);
    }
  };

  // 2. Xử lý Đăng ký (Gửi full info)
  const handleSignUp = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
          gender: gender,
        },
        // Quan trọng: Redirect về trang nào sau khi bấm link trong mail?
        // Thường là trang login hoặc trang chủ
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage({ text: error.message, type: "error" });
    } else if (data.user && !data.session) {
      // 🟢 CASE NÀY QUAN TRỌNG: Đăng ký được nhưng chưa có session => Cần verify email
      setMessage({
        text: "Đăng ký thành công! Vui lòng kiểm tra Email để kích hoạt tài khoản.",
        type: "success",
      });
      // Không redirect ngay, để user đọc thông báo
    } else {
      // Case này là khi tắt Confirm Email (Login luôn)
      setMessage({
        text: "Đăng ký thành công! Đang chuyển hướng...",
        type: "success",
      });
      router.refresh();
      setTimeout(() => router.push("/"), 2000);
    }
    setLoading(false);
  };

  // Logic chuyển bước đăng ký
  const handleNextStep = () => {
    if (!email || !password || !confirmPassword) {
      setMessage({
        text: "Vui lòng điền đầy đủ thông tin tài khoản",
        type: "error",
      });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ text: "Mật khẩu không khớp", type: "error" });
      return;
    }
    setMessage(null);
    setRegisterStep(2); // Chuyển sang bước nhập info
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (view === "login") {
      await handleLogin();
    } else {
      // Nếu đang ở bước 1 register thì chuyển bước, bước 2 mới submit
      if (registerStep === 1) {
        handleNextStep();
      } else {
        if (!fullName || !phone) {
          setMessage({ text: "Vui lòng nhập Họ tên và SĐT", type: "error" });
          return;
        }
        await handleSignUp();
      }
    }
  };

  const switchMode = () => {
    setView(view === "login" ? "register" : "login");
    setRegisterStep(1); // Reset step khi chuyển tab
    setMessage(null);
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
          {/* --- FORM ĐĂNG NHẬP --- */}
          {view === "login" && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-left-4 duration-300">
              <input
                className="input-field"
                placeholder="Email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
              />
              <input
                className="input-field"
                placeholder="Mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
              />
            </div>
          )}

          {/* --- FORM ĐĂNG KÝ (BƯỚC 1: TK) --- */}
          {view === "register" && registerStep === 1 && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <input
                className="input-field"
                placeholder="Email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
              />
              <input
                className="input-field"
                placeholder="Mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
              />
              <input
                className="input-field"
                placeholder="Xác nhận mật khẩu..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
              />
            </div>
          )}

          {/* --- FORM ĐĂNG KÝ (BƯỚC 2: INFO) --- */}
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
                placeholder="Số điện thoại..."
                value={phone}
                type="tel"
                onChange={(e) => setPhone(e.target.value)}
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

          {/* Thông báo lỗi */}
          {message && (
            <div
              className={`mt-4 p-3 rounded text-sm text-center font-medium ${message.type === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}
            >
              {message.text}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : view === "login" ? (
              "Đăng nhập"
            ) : registerStep === 1 ? (
              <>
                Tiếp tục <ArrowRight size={18} />
              </>
            ) : (
              "Hoàn tất đăng ký"
            )}
          </button>

          {/* Switch Mode */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={switchMode}
              className="text-sm text-gray-500 hover:text-blue-600 hover:underline transition-colors"
            >
              {view === "register"
                ? "Đã có tài khoản? Đăng nhập ngay"
                : "Chưa có tài khoản? Đăng ký miễn phí"}
            </button>
          </div>
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
      `}</style>
    </div>
  );
}
