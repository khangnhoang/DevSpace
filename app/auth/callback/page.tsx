"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // Import client supabase của ông
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // 1. Lắng nghe sự thay đổi của Auth
    // Supabase Client đủ thông minh để tự parse cái hash #access_token trên URL
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        // 2. Nếu đăng nhập thành công (bắt được token) -> Đá về trang chủ
        router.push("/");
        router.refresh(); // Refresh để Server Component cập nhật lại trạng thái login
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
      <p className="text-gray-600 font-medium">Đang xác thực tài khoản...</p>
      <p className="text-gray-400 text-sm mt-2">Vui lòng không tắt trình duyệt</p>
    </div>
  );
}