// components/MobileBlocker.tsx
import React from "react";
import { MonitorX } from "lucide-react";

const MobileBlocker = () => {
  return (
    // 👇 SỬA Ở ĐÂY: đổi 'md:hidden' thành 'lg:hidden'
    // lg:hidden nghĩa là: Màn hình >= 1024px (Laptop) mới ẨN cái chặn này đi.
    // Còn dưới 1024px (iPad, Tablet, Mobile) là HIỆN chặn lên hết.
    <div className="fixed inset-0 z-9999 bg-[#0f172a] text-white flex flex-col items-center justify-center p-6 text-center lg:hidden">
      
      <div className="bg-red-500/10 p-6 rounded-full mb-6 animate-pulse">
        <MonitorX size={64} className="text-red-500" />
      </div>
      
      <h1 className="text-xl font-bold mb-3 uppercase tracking-wider text-red-400">
        Yêu cầu PC / Laptop
      </h1>
      
      <p className="text-gray-300 max-w-xs leading-relaxed text-sm">
        Trình biên tập code không hỗ trợ điện thoại và máy tính bảng. 
        <br/>Vui lòng sử dụng máy tính để có trải nghiệm tốt nhất.
      </p>
      
      <div className="mt-8 px-4 py-2 bg-slate-800 rounded-lg border border-slate-700 text-xs text-gray-400 font-mono">
        💻 Resolution &ge; 1024px
      </div>
    </div>
  );
};

export default MobileBlocker;