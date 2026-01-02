"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type ViewState = "login" | "register";
type AuthMessage = {
  text: string;
  type: "error" | "success";
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [view, setView] = useState<ViewState>("login");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<AuthMessage | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setMessage({ text: "Email hoặc mật khẩu trống", type: "error" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage({ text: "Sai email hoặc mật khẩu", type: "error" });
    } else {
      setMessage({ text: "Đăng nhập thành công", type: "success" });
      router.refresh();
      setTimeout(() => {
        router.push("/");
      }, 3000);
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage({ text: "Email hoặc mật khẩu không hợp lệ", type: "error" });
    } else {
      setMessage({ text: "Đăng ký thành công", type: "success" });
      router.refresh();
      setTimeout(() => {
        router.push("/");
      }, 3000);
    }
    setLoading(false);
  };

  const changeUI = () => {
    setView(view === "register" ? "login" : "register");
    setMessage(null); // Xóa thông báo cũ khi chuyển tab
  };

  // Thêm sự kiện e: React.FormEvent để xử lý submit form
  const handleAuthentication = async (e: React.FormEvent) => {
    e.preventDefault(); // Chặn reload trang khi bấm Enter

    if (view === "register") {
      if (password !== confirmPassword) {
        setMessage({ text: "Mật khẩu không trùng khớp", type: "error" });
        return;
      }
      await handleSignUp();
    } else {
      await handleLogin();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 bg-gray-50">
      <form
        onSubmit={handleAuthentication}
        className="p-8 bg-white rounded shadow-lg w-full max-w-sm"
      >
        {/* Đổi màu tiêu đề sang blue */}
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">
          {view === "login" ? "Đăng nhập" : "Đăng ký"}
        </h1>

        <input
          className="w-full p-2 mb-4 border rounded placeholder-gray-500 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          placeholder="Email..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full p-2 mb-4 border rounded placeholder-gray-500 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          type="password"
          placeholder="Mật khẩu..."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          className={`w-full mb-3 p-2 border rounded placeholder-gray-500 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
            view === "register" ? "block" : "hidden"
          }`}
          type="password"
          placeholder="Xác nhận Mật khẩu..."
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {/* Thông báo lỗi/thành công */}
        {message && (
          <div
            className={`mb-4 text-center text-sm font-medium ${
              message.type === "error" ? "text-red-500" : "text-green-500"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Nút bấm chính: Đổi sang blue và type='submit' để bắt sự kiện Enter */}
        <button
          // Bỏ onClick ở đây vì form đã có onSubmit
          disabled={loading}
          className="cursor-pointer w-full mt-2 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
          type="submit"
        >
          {loading
            ? "Đang xử lý..."
            : view === "login"
            ? "Đăng nhập"
            : "Đăng ký"}
        </button>

        {/* Link chuyển đổi: Giữ nguyên logic, chỉnh lại màu một chút cho hợp */}
        <button
          className="mt-4 text-sm text-gray-500 w-full text-center cursor-pointer hover:text-blue-600 hover:underline focus:outline-none transition"
          onClick={changeUI}
          type="button"
        >
          {view === "register"
            ? "Đã có tài khoản? Đăng nhập"
            : "Chưa có tài khoản? Đăng ký"}
        </button>
      </form>
    </div>
  );
}
