"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getDashboardData, type HomeCourseData } from "@/lib/supabase";

export default function Home() {
  const [courses, setCourses] = useState<HomeCourseData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const data = await getDashboardData();
      setCourses(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex justify-center text-xl">
        Đang tải khóa học...
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen w-full p-2 text-black flex flex-col gap-4 overflow-x-hidden">
      <div className="w-full bg-white flex justify-center px-2 md:px-5">
        <div className="w-full h-auto md:h-64 lg:h-40 bg-[#1D2731] flex flex-col md:flex-row items-center justify-between p-5 rounded-2xl md:gap-4 transition-all duration-300">
          <div className="flex flex-col w-full text-white md:w-2/3 justify-center gap-3 text-center md:text-left">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold leading-tight">
              Mở bán khóa học HTML & CSS Pro
            </h1>
            <span className="text-sm md:text-base">
              Từ ngày 02/12/2025 Khóa học sẽ có giá trị 1.000k. Khi khóa học
              hoàn thiện sẽ trở về giá gốc.
            </span>
            <button className="border border-white/30 w-full md:w-fit px-6 hover:bg-blue-500 hover:border-transparent rounded-full cursor-pointer py-2 mt-2 md:mt-0 mx-auto md:mx-0 transition-all duration-200">
              HỌC THỬ MIỄN PHÍ
            </button>
          </div>
          <img
            src="https://khoahocsinhvien.com/wp-content/uploads/2023/05/Khoa-hoc-HTML-CSS-Master-from-Zero-to-Hero.jpg"
            alt=""
            className="w-full md:w-1/3 lg:w-auto h-48 md:h-full object-cover rounded-xl"
          />
        </div>
      </div>

      <h1 className="text-2xl md:text-4xl px-2 md:px-5 font-bold mt-4">
        Danh sách khóa học:
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10 px-2 md:px-5">
        {courses.map((course) => (
          <div
            key={course.id}
            className="w-full bg-gray-200 border border-r-gray-200 flex flex-col rounded-2xl overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group"
          >
            <img
              src={course.image_url}
              alt={course.name}
              className="rounded-t-xl cursor-pointer"
            />
            <div className="flex flex-col gap-2 p-4 text-xl">
              <span className="uppercase text-2xl">{course.name}</span>
              <span className="italic text-lg">{course.description}</span>
              <div className="flex justify-between">
                <span>
                  {course.price === 0
                    ? "Miễn phí"
                    : new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                      }).format(course.price)}
                </span>
                {course.firstLessonSlug ? (
                  <Link href={`/course/${course.slug}`}>
                    <button className="rounded-full px-2 bg-blue-400 text-white cursor-pointer hover:animate-pulse">
                      Xem chi tiết
                    </button>
                  </Link>
                ) : (
                  <button
                    disabled
                    className="rounded-full px-4 py-2 bg-gray-300 text-white font-bold cursor-not-allowed"
                  >
                    Sắp ra mắt
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
