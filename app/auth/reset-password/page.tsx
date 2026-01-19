"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, Lock, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // 1. Kiểm tra session
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Liên kết không hợp lệ hoặc đã hết hạn.");
        router.push("/login");
      } else {
        setVerifying(false);
      }
    };
    checkSession();
  }, [router]);

  // 2. Xử lý đổi mật khẩu
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast.success("Khôi phục mật khẩu thành công!");

      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (error: any) {
      toast.error("Lỗi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
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

        <form onSubmit={handleResetPassword} className="p-8 space-y-5">
          <div className="space-y-1">
            <div className="relative">
              {/* 👇 Áp dụng class input-field và thêm padding-right cho icon */}
              <input
                type={showPass ? "text" : "password"}
                className="input-field pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu mới..."
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
          </div>

          <div className="space-y-1">
            {/* 👇 Áp dụng class input-field */}
            <input
              type={showPass ? "text" : "password"}
              className="input-field"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <CheckCircle size={20} />
            )}
            Đổi mật khẩu
          </button>
        </form>
      </div>

      {/* 👇 STYLE ĐỒNG BỘ VỚI TRANG LOGIN */}
      <style jsx>{`
        .input-field {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #e5e7eb; /* Màu viền chuẩn login */
          border-radius: 8px;
          color: #374151; /* Màu chữ chuẩn login */
          transition: all 0.2s;
          outline: none;
        }
        .input-field:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        /* Fix màu placeholder nếu cần */
        .input-field::placeholder {
          color: #9ca3af;
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
