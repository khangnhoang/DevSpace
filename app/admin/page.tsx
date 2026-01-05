import {
  Trophy,
  Activity,
  BookCheck,
  User,
  PenLine,
  Book
} from "lucide-react";
import {
  getAdminDashboardStats,
  getAdminCourseChartData,
  getTopStudents,
  getRecentActivities,
} from "@/app/action/admin-dashboard";
import TransactionChart from "../components/TransactionChart";
import CustomAvatar from "../components/CustomAvatar";

// Helper Component cho cái Card thống kê
const StatCard = ({
  title,
  value,
  icon: Icon,
  colorClass,
  bgIconClass,
}: any) => (
  <div className="bg-[#191C24] flex p-4 justify-between rounded-xl border border-gray-800 w-full hover:border-gray-700 transition-all shadow-sm">
    <div className="flex flex-col justify-between h-full">
      <div className="text-3xl font-bold text-white mt-1">
        {value}
        <p className="text-sm text-[#676a86] font-medium mt-2 uppercase tracking-wide">
          {title}
        </p>
      </div>
    </div>
    <div
      className={`h-12 w-12 flex items-center justify-center rounded-lg ${bgIconClass}`}
    >
      <Icon size={24} className={colorClass} />
    </div>
  </div>
);

export default async function AdminPage() {
  // Fetch song song cho nhanh
  const [stats, chartData, topStudents, recentActivities] = await Promise.all([
    getAdminDashboardStats(),
    getAdminCourseChartData(),
    getTopStudents(),
    getRecentActivities(),
  ]);

  return (
    <div className="lg:ml-6 p-4 md:p-6 flex flex-col gap-6 bg-[#0F1116] min-h-screen text-gray-200">
      {/* --- HÀNG 1: STATS CARDS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Khóa học"
          value={stats?.courses}
          icon={Book}
          colorClass="text-blue-500"
          bgIconClass="bg-blue-500/10"
        />
        <StatCard
          title="Bài học"
          value={stats?.lessons}
          icon={BookCheck}
          colorClass="text-green-500"
          bgIconClass="bg-green-500/10"
        />
        <StatCard
          title="Sinh viên"
          value={stats?.students}
          icon={User}
          colorClass="text-purple-500"
          bgIconClass="bg-purple-500/10"
        />
        <StatCard
          title="Bài tập"
          value={stats?.exercises}
          icon={PenLine}
          colorClass="text-orange-500"
          bgIconClass="bg-orange-500/10"
        />
        <StatCard
          title="Hoàn thành"
          value={stats?.completed}
          icon={Trophy}
          colorClass="text-yellow-500"
          bgIconClass="bg-yellow-500/10"
        />
      </div>

      {/* --- HÀNG 2: MAIN CONTENT --- */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* CỘT TRÁI: BIỂU ĐỒ (1/3) */}
        <div className="w-full xl:w-1/3 min-h-[450px]">
          <TransactionChart data={chartData} />
        </div>

        {/* CỘT PHẢI: THỐNG KÊ CHI TIẾT (2/3) */}
        <div className="w-full xl:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* WIDGET 1: BẢNG VÀNG HỌC TẬP */}
          <div className="bg-[#191C24] p-6 rounded-xl border border-gray-800 flex flex-col h-full">
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
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#0F1116]/50 hover:bg-[#0F1116] transition-colors border border-gray-800/50"
                  >
                    {/* Badge Rank */}
                    <div
                      className={`flex items-center justify-center w-6 h-6 rounded text-xs font-bold shadow-sm
                                    ${
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

                    {/* Avatar */}
                    {/* Container giữ khung tròn */}
                    <div className="h-10 w-10">
                      <CustomAvatar
                        src={student.avatar_url} // Truyền link (hoặc null) vào đây
                        // Không truyền fallbackText -> Nó sẽ tự lấy mặc định là "DS" như bạn muốn
                        className="w-full h-full"
                        fontSize="text-sm" // Chỉnh cỡ chữ DS cho vừa vặn
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {student.full_name || "Học viên ẩn danh"}
                      </h4>
                      <p className="text-xs text-gray-500 truncate">
                        {student.email}
                      </p>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <span className="block text-green-400 font-bold text-sm">
                        {student.progress_count}
                      </span>
                      <span className="text-[10px] text-gray-500">Bài</span>
                    </div>
                  </li>
                ))}
                {topStudents.length === 0 && (
                  <p className="text-gray-500 text-center text-sm">
                    Chưa có dữ liệu học tập
                  </p>
                )}
              </ul>
            </div>
          </div>

          {/* WIDGET 2: HOẠT ĐỘNG GẦN ĐÂY */}
          <div className="bg-[#191C24] p-6 rounded-xl border border-gray-800 flex flex-col h-full">
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
                      {/* Dấu chấm tròn (Màu sắc thay đổi theo loại hoạt động) */}
                      <span
                        className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-[#191C24] 
              ${act.type === "enrollment" ? "bg-green-500" : "bg-blue-500"}`}
                      ></span>

                      <div className="flex flex-col gap-1">
                        <div className="text-sm text-gray-300">
                          <span className="font-bold text-white hover:text-blue-400 cursor-pointer transition-colors mr-1">
                            {act.user_name}
                          </span>

                          {/* Logic hiển thị text dựa theo Type */}
                          {act.type === "enrollment" ? (
                            <span className="text-gray-400">
                              đã tham gia khóa học
                            </span>
                          ) : (
                            <span className="text-gray-400">
                              đã hoàn thành bài
                            </span>
                          )}
                        </div>

                        {/* Tên Bài học hoặc Khóa học */}
                        <div
                          className={`text-xs font-medium py-1.5 px-3 rounded-md w-fit border truncate max-w-full
                ${
                  act.type === "enrollment"
                    ? "text-green-400 bg-green-500/10 border-green-500/20"
                    : "text-blue-400 bg-blue-500/10 border-blue-500/20"
                }`}
                        >
                          {act.main_content}
                        </div>

                        {/* Nếu là bài học thì hiện thêm tên khóa học nhỏ ở dưới */}
                        {act.sub_content && (
                          <span className="text-[10px] text-gray-500 italic">
                            Thuộc khóa: {act.sub_content}
                          </span>
                        )}

                        <span className="text-[10px] text-gray-600 mt-1 block">
                          {act.date_string
                            ? new Date(act.date_string).toLocaleString("vi-VN")
                            : ""}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                  <Activity size={32} className="opacity-20" />
                  <p className="text-sm">Chưa có hoạt động nào</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
