interface ProgressBarProps {
  percent: number;
  showLabel?: boolean; // Option: Cho phép ẩn/hiện nhãn nếu muốn tái sử dụng chỗ khác
  ariaLabel?: string; // Names the bar for assistive tech, e.g. with the course it belongs to
}

export default function ProgressBar({ percent, showLabel = true, ariaLabel = "Progress bar" }: ProgressBarProps) {
  // 1. Validate: Đảm bảo số luôn từ 0 đến 100
  const safePercent = Math.min(100, Math.max(0, percent));

  return (
    <div className="w-full">
      {/* Label */}
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-blue-700">Tiến độ học tập</span>
          <span className="text-sm font-medium text-blue-700">{safePercent}%</span>
        </div>
      )}

      {/* Bar Container */}
      <div 
        className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden"
        role="progressbar" 
        aria-valuenow={safePercent} 
        aria-valuemin={0} 
        aria-valuemax={100}
        aria-label={ariaLabel}
      >
        {/* Fill Bar */}
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${safePercent}%` }}
        ></div>
      </div>
    </div>
  );
}