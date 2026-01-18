export const dynamic = "force-dynamic";
export const revalidate = 0;

import {
  Trophy,
  Activity,
  BookCheck,
  User,
  PenLine,
  Book,
  DollarSign,
  TrendingUp,
  Users,
  FileCheck,
} from "lucide-react";
import {
  getAdminDashboardStats,
  getAdminCourseChartData,
  getTopStudents,
  getRecentActivities,
} from "@/app/action/admin-dashboard";
import TransactionChart from "../components/TransactionChart";
import CustomAvatar from "../components/CustomAvatar";

// --- COMPONENT STAT CARD (PHIÊN BẢN MODERN) ---
const StatCard = ({ title, value, icon: Icon, color, subValue }: any) => (
  <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-[#1A1D24] p-6 hover:border-gray-600 transition-all duration-300 group shadow-lg">
    <div className="flex items-center justify-between z-10 relative">
      <div>
        <p className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">
          {title}
        </p>
        <h3 className="text-3xl font-bold text-white tracking-tight">
          {value}
        </h3>
        {subValue && (
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <TrendingUp size={12} className="text-green-500" /> {subValue}
          </p>
        )}
      </div>
      <div
        className={`p-3 rounded-xl ${color} bg-opacity-10 backdrop-blur-sm shadow-inner`}
      >
        <Icon size={26} className="text-white" />
      </div>
    </div>

    {/* Hiệu ứng Glow nền (Trang trí) */}
    <div
      className={`absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-5 blur-2xl group-hover:opacity-15 transition-opacity duration-500 ${color.replace("bg-", "bg-")}`}
    />
  </div>
);

export default async function AdminPage() {
  const [stats, chartData, topStudents, recentActivities] = await Promise.all([
    getAdminDashboardStats(),
    getAdminCourseChartData(),
    getTopStudents(),
    getRecentActivities(),
  ]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  return (
    <div className="lg:ml-6 p-6 flex flex-col gap-8 bg-[#0F1116] min-h-screen text-gray-200">
      {/* 1. HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-white">Tổng quan hệ thống</h1>
        <p className="text-gray-500 text-sm">
          Chào mừng quay trở lại, Quản Trị Viên!
        </p>
      </div>

      {/* 2. GRID THỐNG KÊ (3 Cột x 2 Hàng = 6 Thẻ cân đối) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* DOANH THU (Quan trọng nhất) */}
        <StatCard
          title="Tổng Doanh thu"
          value={formatCurrency(stats?.revenue || 0)}
          icon={DollarSign}
          color="bg-emerald-500" // Xanh lá tiền tệ
          subValue="Thực nhận"
        />

        {/* HỌC VIÊN */}
        <StatCard
          title="Học viên"
          value={stats?.students}
          icon={Users}
          color="bg-purple-500" // Tím mộng mơ
          subValue="Active users"
        />

        {/* KHÓA HỌC */}
        <StatCard
          title="Khóa học"
          value={stats?.courses}
          icon={Book}
          color="bg-blue-500" // Xanh tri thức
        />

        {/* BÀI HỌC */}
        <StatCard
          title="Bài học"
          value={stats?.lessons}
          icon={BookCheck}
          color="bg-pink-500"
        />

        {/* BÀI TẬP */}
        <StatCard
          title="Bài tập"
          value={stats?.exercises}
          icon={PenLine}
          color="bg-orange-500"
        />

        {/* HOẠT ĐỘNG (Thay cho "Hoàn thành" chung chung) */}
        <StatCard
          title="Hoạt động học tập"
          value={stats?.completed}
          icon={Activity}
          color="bg-yellow-500"
          subValue="Bài học đã xong"
        />
      </div>

      {/* 3. MAIN CONTENT (Biểu đồ & Danh sách) */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* BIỂU ĐỒ (Chiếm 40%) */}
        <div className="w-full xl:w-2/5 min-h-[450px]">
          <TransactionChart data={chartData} />
        </div>

        {/* DANH SÁCH (Chiếm 60%) */}
        <div className="w-full xl:w-3/5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Widget 1: Top Học Viên */}
          <div className="bg-[#1A1D24] p-6 rounded-2xl border border-gray-800 flex flex-col h-full shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Trophy size={18} className="text-yellow-500" />
                Top Học Viên
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <ul className="space-y-4">
                {topStudents?.map((student: any, index: number) => (
                  <li
                    key={student.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#0F1116]/50 hover:bg-[#252830] transition-colors border border-gray-800/50"
                  >
                    <div
                      className={`flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
                        index === 0
                          ? "bg-yellow-400 text-black"
                          : index === 1
                            ? "bg-gray-300 text-black"
                            : index === 2
                              ? "bg-orange-400 text-white"
                              : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="h-9 w-9">
                      <CustomAvatar
                        src={student.avatar_url}
                        className="w-full h-full rounded-full ring-2 ring-gray-800"
                        fontSize="text-xs"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {student.full_name}
                      </h4>
                      <p className="text-xs text-gray-500 truncate">
                        {student.email}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-green-400 font-bold text-sm">
                        {student.progress_count}
                      </span>
                      <span className="text-[10px] text-gray-500">Bài</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Widget 2: Hoạt động */}
          <div className="bg-[#1A1D24] p-6 rounded-2xl border border-gray-800 flex flex-col h-full shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity size={18} className="text-blue-500" />
                Hoạt động mới
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {recentActivities.length > 0 ? (
                <ul className="relative border-l border-gray-700 ml-3 space-y-6">
                  {recentActivities.map((act: any, index: number) => (
                    <li key={index} className="pl-6 relative">
                      <span
                        className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-[#1A1D24] ${act.type === "enrollment" ? "bg-green-500" : "bg-blue-500"}`}
                      ></span>
                      <div className="flex flex-col gap-1">
                        <div className="text-sm text-gray-300">
                          <span className="font-bold text-white mr-1">
                            {act.user_name}
                          </span>
                          {act.type === "enrollment" ? (
                            <span className="text-gray-400">đã tham gia</span>
                          ) : (
                            <span className="text-gray-400">đã học xong</span>
                          )}
                        </div>
                        <div
                          className={`text-xs font-medium py-1 px-2 rounded-md w-fit border truncate max-w-full ${act.type === "enrollment" ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-blue-400 bg-blue-500/10 border-blue-500/20"}`}
                        >
                          {act.main_content}
                        </div>
                        <span className="text-[10px] text-gray-600 mt-1">
                          {act.date_string
                            ? new Date(act.date_string).toLocaleString(
                                "vi-VN",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  day: "2-digit",
                                  month: "2-digit",
                                },
                              )
                            : ""}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-center text-sm mt-10">
                  Chưa có hoạt động
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
