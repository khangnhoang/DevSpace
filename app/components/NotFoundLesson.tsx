import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function NotFoundLesson() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full bg-[#F8FAFC] p-4">
      {/* Card chứa nội dung */}
      <div className="bg-white p-8 md:p-12 rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full text-center transition-all hover:shadow-2xl">
        {/* Icon Area với hiệu ứng nền */}
        <div className="relative inline-flex items-center justify-center mb-6">
          <div className="absolute w-24 h-24 bg-yellow-100 rounded-full animate-pulse opacity-70"></div>
          <div className="relative bg-yellow-50 p-4 rounded-full border-4 border-white shadow-sm">
            <FileQuestion
              size={48}
              className="text-yellow-500"
              strokeWidth={1.5}
            />
          </div>
        </div>

        {/* Text Content */}
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-3">
          Không tìm thấy bài học
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Có vẻ như bài học này không tồn tại, đã bị xóa hoặc bạn không có quyền
          truy cập vào nội dung này.
        </p>

        {/* Actions Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors group"
          >
            <ArrowLeft
              size={18}
              className="group-hover:-translate-x-1 transition-transform"
            />
            Về trang chủ
          </Link>

        </div>
      </div>

      {/* Footer text nhỏ */}
      <p className="mt-8 text-sm text-gray-400">Mã lỗi: 404_LESSON_NOT_FOUND</p>
    </div>
  );
}
