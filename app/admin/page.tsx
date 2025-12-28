import {ArrowUp, ArrowDown} from "lucide-react";
import { getAdminDashboardStats, getAdminCourseChartData } from "@/lib/supabase";
import TransactionChart from "../components/TransactionChart";
export default async function AdminPage() {
  const stats = await getAdminDashboardStats();
  const chartData = await getAdminCourseChartData();
  return (
    <div className="lg:ml-6 p-4 flex flex-col gap-8 bg-[#0F1116]">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">

        <div className="bg-[#191C24] flex p-4 justify-between rounded-md w-full">
          <div className="flex flex-col justify-between">
            <div className="text-2xl"> {stats?.lessons} 
              <p className="text-sm text-[#676a86]">Bài học</p>
            </div>
          </div>
          <div><ArrowUp size={40} className="text-green-500 bg-[#16302a] rounded-md p-2"/></div>
        </div>

        <div className="bg-[#191C24] flex p-4 justify-between rounded-md w-full">
          <div className="flex flex-col justify-between">
              <div className="text-2xl"> {stats?.students}
              <p className="text-sm text-[#676a86]">Sinh viên</p>
            </div>
          </div>
          <div><ArrowUp size={40} className="text-green-500 bg-[#16302a] rounded-md p-2"/></div>
        </div>
        
        <div className="bg-[#191C24] flex p-4 justify-between rounded-md w-full">
          <div className="flex flex-col justify-between">
            <div className="text-2xl">{stats?.exercises} 
            <p className="text-sm text-[#676a86]">Bài tập</p></div>
          </div>
          <div><ArrowDown size={40} className="text-red-500 bg-[#322028] rounded-md p-2"/></div>
        </div>

        <div className="bg-[#191C24] flex p-4 justify-between rounded-md w-full">
          <div className="flex flex-col justify-between">
            <div className="text-2xl">{stats?.completed} 
            <p className="text-sm text-[#676a86]">Bài đã hoàn thành</p></div>
          </div>
          <div><ArrowUp size={40} className="text-green-500 bg-[#16302a] rounded-md p-2"/></div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
          <div className="w-full lg:w-1/3 h-[450px]">
            <TransactionChart data = {chartData}/>
          </div>

          <div className="w-full lg:w-2/3 bg-[#191C24] p-6 rounded-md min-h-[450px]">
              <h2 className="text-xl font-semibold mb-4">Thống kê khác...</h2>
              <p className="text-[#676a86]"></p>
          </div>
      </div>
    </div>
  );
}
