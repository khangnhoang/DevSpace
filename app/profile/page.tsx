"use client"; // 1. Thêm dòng này đầu tiên để chạy ở Client
import { useEffect, useState } from "react";
import ProgressBar from "./PropressBar"; // Giữ nguyên tên file của bạn (dù sai chính tả :D)
import { getUserDashboardData, supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      // 2. Lấy session từ trình duyệt (lúc này mới lấy được)
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login"); // Đá về login nếu chưa có
        return;
      }

      setUser(session.user);

      // 3. Gọi hàm lấy dữ liệu (Hàm này chạy được cả ở Client lẫn Server)
      const data = await getUserDashboardData(session.user.id);
      setMyCourses(data);
      setLoading(false);
    };

    fetchData();
  }, [router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Đang tải hồ sơ...</div>;
  }

  // Logic hiển thị (Avatar giả)
  const firstLetter = user?.email?.charAt(0).toUpperCase() || "U";
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0];

  return (
    <div className="bg-[#F9FAFB] min-h-screen w-full flex p-4 gap-4">
      {/* CỘT TRÁI */}
      <div className="w-1/4 flex flex-col items-center gap-4 bg-white border border-gray-200 p-6 rounded-xl h-fit shadow-sm">
        <div className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center text-white text-5xl font-bold shadow-inner">
          {firstLetter}
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-800">{displayName}</p>
          <p className="text-gray-500 text-sm">{user?.email}</p>
        </div>
      </div>

      {/* CỘT PHẢI */}
      <div className="w-3/4 flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-gray-800">Khóa học của tôi</h2>
        
        {myCourses.length > 0 ? (
          myCourses.map((course: any) => (
            <div key={course.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h1 className="text-xl font-bold text-gray-900">{course.title}</h1>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold">
                    {course.percent}%
                </span>
              </div>

              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-2">Tiến độ học tập</h2>
                <div className="w-full">
                  {/* ProgressBar của bạn */}
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