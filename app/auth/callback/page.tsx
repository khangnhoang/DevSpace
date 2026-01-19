"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

// 👇 1. Tách logic chính ra component con
function CallbackLogic() {
  const router = useRouter();
  const searchParams = useSearchParams(); // Dùng ở đây OK vì đã được bọc Suspense bên dưới
  const [msg, setMsg] = useState("Đang xác thực tài khoản...");

  useEffect(() => {
    // Lấy đích đến (nếu có)
    const nextPath = searchParams.get("next") || "/";

    // Lắng nghe sự kiện Auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        setMsg("Đăng nhập thành công! Đang chuyển hướng...");

        setTimeout(() => {
          router.replace(nextPath);
          router.refresh();
        }, 500);
      }
    });

    // Fallback timeout
    const timeout = setTimeout(() => {
      setMsg("Đang điều hướng...");
      router.replace(nextPath);
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
      <h2 className="text-xl font-semibold text-gray-800 mb-2">
        Đang xử lý đăng nhập
      </h2>
      <p className="text-gray-500 font-medium text-sm">{msg}</p>
    </div>
  );
}

// 👇 2. Component chính chỉ làm nhiệm vụ bọc Suspense
export default function AuthCallbackPage() {
  return (
    // Fallback UI này sẽ hiện ra trong tích tắc khi Next.js đang parse URL
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
          <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
          <p className="text-gray-500">Đang tải...</p>
        </div>
      }
    >
      <CallbackLogic />
    </Suspense>
  );
}
