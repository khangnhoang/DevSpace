import {ArrowUp, ArrowDown} from "lucide-react";
import { getAdminDashboardStats, getAdminCourseChartData } from "@/lib/supabase";
import TransactionChart from "../components/TransactionChart";
export default async function AdminPage() {
  const stats = await getAdminDashboardStats();
  const chartData = await getAdminCourseChartData();
  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex gap-8">
        <div className="w-1/4 bg-[#191C24] flex p-4 justify-between rounded-md">
          <div className="text-2xl"> {stats?.lessons} <p className="text-sm text-[#676a86]">Bài học</p></div>
          <div><ArrowUp size={40} className="text-green-500 bg-[#16302a] rounded-md p-2"/></div>
        </div>
        <div className="w-1/4 bg-[#191C24] flex p-4 justify-between rounded-md">
          <div className="text-2xl"> {stats?.students} <p className="text-sm text-[#676a86]">Sinh viên</p></div>
          <div><ArrowUp size={40} className="text-green-500 bg-[#16302a] rounded-md p-2"/></div>
        </div>
        <div className="w-1/4 bg-[#191C24] flex p-4 justify-between rounded-md">
          <div className="text-2xl">{stats?.exercises} <p className="text-sm text-[#676a86]">Bài tập</p></div>
          <div><ArrowDown size={40} className="text-red-500 bg-[#322028] rounded-md p-2"/></div>
        </div>
        <div className="w-1/4 bg-[#191C24] flex p-4 justify-between rounded-md">
          <div className="text-2xl">{stats?.completed} <p className="text-sm text-[#676a86]">Bài đã hoàn thành</p></div>
          <div><ArrowUp size={40} className="text-green-500 bg-[#16302a] rounded-md p-2"/></div>
        </div>  
      </div>
      <div className="flex gap-4">
          <div className="w-1/3">
            <TransactionChart data = {chartData}/>
          </div>

          <div className="w-2/3 bg-[#191C24] p-6 rounded-md">
              <h2 className="text-xl font-semibold mb-4">Thống kê khác...</h2>
              <p className="text-[#676a86]"></p>
          </div>
      </div>
    </div>
  );
}
