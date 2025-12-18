import {
  ChartPie,
  SquareChartGantt,
  Users,
  SquareKanban,
  BookOpenText,
  TableOfContents
} from "lucide-react";
import Link from "next/link";
export default function SidebarAdmin() {
  return (
    <div className="h-full bg-[#191C24]">
      <div className="flex flex-col py-2 gap-4">
        <Link
          href="#"
          className="flex gap-2 items-center border-l-4 py-2 px-4 border-blue-500 rounded-r-full hover:bg-gray-400"
        >
          <div className="flex items-center rounded-full justify-center p-2 bg-[#22242E]">
            <ChartPie size={15} className="text-purple-500" />
          </div>
          <span>Thống Kê</span>
        </Link>
        <Link
          href="/admin/courses"
          className="flex gap-2 items-center py-2 px-4 border-blue-500 rounded-r-full hover:bg-gray-400"
        >
          <div className="flex items-center rounded-full justify-center p-2 bg-[#22242E]">
            <BookOpenText size={15} className="text-green-500" />
          </div>
          <span>Quản lý khóa học</span>
        </Link>
        <Link
          href="/admin/lessons"
          className="flex gap-2 items-center py-2 px-4 rounded-r-full hover:bg-gray-400"
        >
          <div className="flex items-center rounded-full justify-center p-2 bg-[#22242E]">
            <SquareChartGantt size={15} className="text-orange-500" />
          </div>
          <span>Quản lí bài học</span>
        </Link>
        <Link
          href="/admin/users"
          className="flex gap-2 items-center py-2 px-4 rounded-r-full hover:bg-gray-400"
        >
          <div className="flex items-center rounded-full justify-center p-2 bg-[#22242E]">
            <Users size={15} className="text-red-500" />
          </div>
          <span>Quản lý người dùng</span>
        </Link>
        <Link
          href="#"
          className="flex gap-2 items-center py-2 px-4 rounded-r-full hover:bg-gray-400"
        >
          <div className="flex items-center rounded-full justify-center p-2 bg-[#22242E]">
            <SquareKanban size={15} className="text-blue-500" />
          </div>
          <span>Biểu đồ chi tiết</span>
        </Link>
        <Link
          href="/admin/chapters"
          className="flex gap-2 items-center py-2 px-4 rounded-r-full hover:bg-gray-400"
        >
          <div className="flex items-center rounded-full justify-center p-2 bg-[#22242E]">
            <TableOfContents size={15} className="text-yellow-500" />
          </div>
          <span>Quản lí chương</span>
        </Link>
      </div>
    </div>
  );
}
