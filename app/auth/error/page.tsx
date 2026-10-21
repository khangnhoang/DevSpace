import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4 text-center">
      <h2 className="text-xl font-semibold text-gray-800 mb-2">
        Liên kết không hợp lệ hoặc đã hết hạn
      </h2>
      <p className="text-gray-500 text-sm mb-6 max-w-md">
        Hãy mở liên kết trong email trên cùng trình duyệt bạn đã dùng để yêu
        cầu, hoặc yêu cầu một liên kết mới.
      </p>
      <Link
        href="/login"
        className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
      >
        Về trang đăng nhập
      </Link>
    </div>
  );
}
