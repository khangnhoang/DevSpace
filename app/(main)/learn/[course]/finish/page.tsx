import Link from "next/link";
import { Home } from "lucide-react";
import DownloadCertificateBtn from "@/app/components/DownloadCertificateBtn"; // Import cái nút vừa tạo

// 1. Định nghĩa kiểu cho params là Promise
export default async function FinishCoursePage({
  params,
}: {
  params: Promise<{ course: string }>;
}) {
  // 2. Phải await params trước khi dùng
  const { course } = await params;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4 text-center">
      <div className="mb-8 animate-bounce text-6xl">🏆</div>
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Chúc mừng bạn đã hoàn thành khóa học!
      </h1>
      <p className="text-gray-600 mb-8 max-w-md">
        Bạn đã xuất sắc vượt qua tất cả bài học. Đây là thành quả xứng đáng cho
        nỗ lực của bạn.
      </p>

      {/* CÁI CHỨNG CHỈ FAKE */}
      <div className="w-full max-w-2xl bg-slate-50 border-4 border-double border-yellow-400 p-10 rounded-lg shadow-xl mb-10 relative">
        <div className="absolute top-0 left-0 w-full h-full border border-gray-200 m-2 pointer-events-none"></div>
        <h2 className="text-3xl font-serif text-gray-800 mb-2">
          CERTIFICATE OF COMPLETION
        </h2>
        <p className="text-gray-500 mb-6">This is to certify that</p>
        <p className="text-4xl font-bold text-blue-600 mb-6 font-serif">
          d
        </p>
        <p className="text-gray-500">Has successfully completed the course</p>
        {/* Dùng biến course đã await */}
        <p className="text-xl font-bold text-gray-800 mt-2 uppercase">
          {course}
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          <Home size={20} /> Về trang chủ
        </Link>

        {/* Nhét cái nút Client vào đây */}
        <DownloadCertificateBtn />
      </div>
    </div>
  );
}
