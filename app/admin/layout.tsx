"use client"; // 👈 KHÓA CHỐT: Chuyển hẳn sang Client Side

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // 👈 DÙNG LẠI FILE CLIENT CŨ CỦA BẠN (Cái file static ấy)
import SidebarAdmin from "../components/SidebarAdmin";
import HeaderAdmin from "../components/HeaderAdmin";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false); // Chưa cho hiện gì cả
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        // 1. Check User (Lấy thẳng từ browser cache/cookie, không cần server)
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          toast.error("Bạn chưa đăng nhập!");
          router.replace("/login");
          return;
        }

        // 2. Check Role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        // 3. Quyết định số phận
        if (profile?.role === "admin") {
          setIsAuthorized(true); // Mở cổng
        } else {
          toast.error("Mày đếch phải admin");
          router.replace("/"); // Sút về trang chủ
        }
      } catch (error) {
        console.error("Lỗi check quyền:", error);
        router.replace("/");
      } finally {
        setIsLoading(false); // Tắt loading dù thành công hay thất bại
      }
    };

    checkAdmin();
  }, [router]);

  // -----------------------------------------------------------
  // GIAO DIỆN CHỜ (Trong lúc đang check)
  // -----------------------------------------------------------
  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#191C24] text-gray-400 gap-4">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <p>Đang kiểm tra quyền Admin...</p>
      </div>
    );
  }

  // Nếu check xong mà không được quyền -> Không render gì cả (tránh nháy giao diện)
  if (!isAuthorized) return null;

  // -----------------------------------------------------------
  // GIAO DIỆN CHÍNH (Khi đã qua cửa bảo vệ)
  // -----------------------------------------------------------
  return (
    <div className="h-full w-full bg-[#191C24]">
      {/* HEADER */}
      <div className="fixed top-0 left-0 w-full h-16 z-50 border-b border-gray-700 bg-[#191C24]">
        <HeaderAdmin />
      </div>

      {/* SIDEBAR */}
      <div className="hidden md:flex w-56 flex-col fixed inset-y-0 left-0 top-16 z-40 border-r border-gray-700">
        <SidebarAdmin isOpen={true} />
      </div>

      {/* MAIN CONTENT */}
      <main className="h-full pt-16 md:pl-56">
        <div className="h-full overflow-y-auto p-4 bg-[#0F1116]">
          {children}
        </div>
      </main>
    </div>
  );
}
