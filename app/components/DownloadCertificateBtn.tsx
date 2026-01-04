"use client"; // <--- Quan trọng: Dòng này biến nó thành Client Component

import { Download } from "lucide-react";
import { toast } from "sonner"; // Hoặc alert tùy ông

export default function DownloadCertificateBtn() {
  return (
    <button
      onClick={() => toast.info("Tính năng đang phát triển, chụp màn hình đi fen! 😂")}
      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg transition-all active:scale-95"
    >
      <Download size={20} /> Tải chứng chỉ
    </button>
  );
}