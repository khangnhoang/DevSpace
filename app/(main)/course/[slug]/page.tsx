import Link from "next/link";
import { getCourseDetail } from "@/lib/courses.server";
import CourseDetailClient from "./_components/CourseDetailClient";

export default async function DetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getCourseDetail(slug);

  if (result.status === "found") {
    return <CourseDetailClient key={result.course.id} course={result.course} />;
  }

  return (
    <div className="bg-[#111827] w-full min-h-screen flex justify-center items-center text-white">
      <div className="text-center">
        <p className="text-xl font-bold mb-2">
          {result.status === "missing"
            ? "Không tìm thấy khóa học"
            : "Không thể tải thông tin khóa học"}
        </p>
        <Link href="/" className="text-blue-400 hover:underline">
          Quay về trang chủ
        </Link>
      </div>
    </div>
  );
}
