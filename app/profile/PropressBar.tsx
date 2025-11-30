interface ProgressBarProps {
  percent: number;
}

export default function ProgressBar({ percent }: ProgressBarProps) {
  // percent là số bạn truyền vào (ví dụ: 31)
  
  return (
    <div className="w-full">
      
      {/* 1. Nhãn hiển thị số % (tùy chọn) */}
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-blue-700">Tiến độ học tập</span>
        <span className="text-sm font-medium text-blue-700">{percent}%</span>
      </div>

      {/* 2. Thanh Background (Màu xám làm nền) */}
      <div className="w-full bg-gray-300 rounded-full h-2.5">
        
        {/* 3. Thanh Tiến Độ (Màu xanh chạy theo %) */}
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
          style={{ width: `${percent}%` }} 
        ></div>
        
      </div>
    </div>
  );
}