"use client"; // 👈 1. Đánh dấu Client Component

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Home } from "lucide-react";
import DownloadCertificateBtn from "@/app/components/DownloadCertificateBtn";
import { supabase } from "@/lib/supabase"; // Import supabase client

// The completion screen. The gate is on the server in ../page.tsx; the student's name is still read in the browser
// (TM-U14 moves it).
export default function FinishCompletion({ course }: { course: string }) {
  // State để lưu tên người dùng
  const [studentName, setStudentName] = useState("Đang tải...");

  // 👈 3. Dùng useEffect để lấy tên thật của user
  useEffect(() => {
    const getUserProfile = async () => {
      // Lấy user hiện tại
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Lấy thông tin từ bảng profiles (nếu ông có lưu full_name ở đó)
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        // Ưu tiên lấy full_name trong profile, nếu không có thì lấy email
        if (profile?.full_name) {
          setStudentName(profile.full_name);
        } else {
          setStudentName(user.email?.split("@")[0] || "Học viên");
        }
      }
    };

    getUserProfile();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4 text-center">
      <div className="mb-8 animate-bounce text-6xl">🏆</div>
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Chúc mừng bạn đã hoàn thành khóa học!
      </h1>
      <p className="text-gray-600 mb-8 max-w-md">
        Bạn đã xuất sắc vượt qua tất cả bài học. Đây là thành quả xứng đáng cho
        nỗ lực của bạn.
      </p>

      {/* CÁI CHỨNG CHỈ */}
      {/* Thêm id để cái nút Download nó biết chụp khu vực nào */}
      <div
        id="certificate-area"
        className="w-full max-w-2xl bg-slate-50 border-4 border-double border-yellow-400 p-10 rounded-lg shadow-xl mb-10 relative text-center"
      >
        <div className="absolute top-0 left-0 w-full h-full border border-gray-200 m-2 pointer-events-none"></div>
        <h2 className="text-3xl font-serif text-gray-800 mb-2">
          CERTIFICATE OF COMPLETION
        </h2>
        <p className="text-gray-500 mb-6">This is to certify that</p>

        {/* Tên người dùng Dynamic */}
        <p className="text-4xl font-bold text-blue-600 mb-6 font-serif uppercase">
          {studentName}
        </p>

        <p className="text-gray-500">Has successfully completed the course</p>
        <p className="text-xl font-bold text-gray-800 mt-2 uppercase">
          {course.replace("-", " ")}{" "}
          {/* Fix nhẹ cái slug cho đẹp (vd: html-css -> html css) */}
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          <Home size={20} /> Về trang chủ
        </Link>

        {/* Nút download giữ nguyên */}
        <DownloadCertificateBtn />
      </div>
    </div>
  );
}
