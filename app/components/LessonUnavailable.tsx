import Link from "next/link";

// Shown when the API could not answer a /learn read (TM-U5 AC10): no lesson content and no redirect, because an outage
// is not "not signed in" or "not enrolled".
export default function LessonUnavailable() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full bg-[#F8FAFC] p-4 text-center">
      <p className="text-xl font-bold text-gray-800 mb-2">
        Không thể tải bài học
      </p>
      <p className="text-gray-500 mb-6">Vui lòng thử lại sau ít phút.</p>
      <Link href="/" className="text-blue-600 hover:underline">
        Về trang chủ
      </Link>
    </div>
  );
}
