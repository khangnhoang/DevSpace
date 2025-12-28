"use client";

import { useEffect, useState } from "react";
import ProgressBar from "./ProgressBar"; // Đảm bảo tên file đã sửa đúng chính tả
import { getUserDashboardData, supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import type { DashboardCourse } from "@/lib/types";

// --- 1. COMPONENT SKELETON (Thêm mới ở đây) ---
const ProfileSkeleton = () => {
  return (
    <div className="bg-[#F9FAFB] min-h-screen w-full flex flex-col md:flex-row p-4 gap-4">
      
      {/* CỘT TRÁI SKELETON */}
      <div className="w-full md:w-1/4 flex flex-col items-center gap-4 bg-white border border-gray-200 p-6 rounded-xl h-fit shadow-sm animate-pulse">
        <div className="w-32 h-32 rounded-full bg-gray-200"></div>
        <div className="flex flex-col items-center gap-2 w-full mt-2">
          <div className="h-6 w-3/4 bg-gray-200 rounded"></div>
          <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
        </div>
      </div>

      {/* CỘT PHẢI SKELETON */}
      <div className="w-full md:w-3/4 flex flex-col gap-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded mx-auto md:mx-0"></div>

        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="h-6 w-1/3 bg-gray-200 rounded"></div>
              <div className="h-6 w-12 bg-gray-200 rounded"></div>
            </div>

            <div className="space-y-3">
              <div className="h-4 w-1/4 bg-gray-200 rounded"></div>
              <div className="w-full h-2.5 bg-gray-200 rounded-full"></div>
              <div className="h-3 w-1/5 bg-gray-200 rounded ml-auto"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- 2. MAIN COMPONENT ---
export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [myCourses, setMyCourses] = useState<DashboardCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setUser(session.user);

      const data = await getUserDashboardData(session.user.id);
      setMyCourses(data);
      setLoading(false);
    };

    fetchData();
  }, [router]);

  // ✅ Thay thế dòng loading cũ bằng Skeleton xịn xò
  if (loading) {
    return <ProfileSkeleton />;
  }

  // Logic hiển thị
  const firstLetter = user?.email?.charAt(0).toUpperCase() || "U";
  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0];

  return (
    <div className="bg-[#F9FAFB] min-h-screen w-full flex flex-col md:flex-row p-4 gap-4">
      {/* CỘT TRÁI */}
      <div className="w-full md:w-1/4 flex flex-col items-center gap-4 bg-white border border-gray-200 p-6 rounded-xl h-fit shadow-sm transition-all hover:shadow-md">
        <div className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center text-white text-5xl font-bold shadow-inner ring-4 ring-blue-50">
          {firstLetter}
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-800">{displayName}</p>
          <p className="text-gray-500 text-sm">{user?.email}</p>
        </div>
      </div>

      {/* CỘT PHẢI */}
      <div className="w-full md:w-3/4 flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-gray-800 text-center md:text-left flex items-center justify-center md:justify-start gap-2">
          Khóa học của tôi
        </h2>

        {myCourses.length > 0 ? (
          myCourses.map((course) => (
            <div
              key={course.id}
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
            >
              <div className="flex justify-between items-start mb-4">
                <h1 className="text-xl font-bold text-gray-900">
                  {course.title}
                </h1>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold">
                  {course.percent}%
                </span>
              </div>

              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-2">
                  Tiến độ học tập
                </h2>
                <div className="w-full">
                  <ProgressBar percent={course.percent} />
                </div>
                <div className="mt-2 text-right text-xs text-gray-400">
                  Đã xong {course.completed}/{course.total} bài
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-gray-500 text-center py-10 bg-white rounded-xl border border-dashed">
            Bạn chưa tham gia khóa học nào.
          </div>
        )}
      </div>
    </div>
  );
}