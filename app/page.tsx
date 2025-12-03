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
      <div className="h-screen flex">
        Đang tải khóa học...
      </div>
    );
  }

  return (
    <div className="bg-white h-screen w-screen p-2 text-black flex flex-col gap-4">
      
      <div className="w-full bg-white flex justify-center px-5">
      <div className="w-full h-40 bg-[#1D2731] flex justify-between p-5 rounded-2xl">
        <div className="flex flex-col text-white w-2/4 justify-center gap-2">
          <h1 className="text-3xl font-bold">Mở bán khóa học HTML & CSS Pro</h1>
          <span className="text-sm">
            Từ ngày 02/12/2025 Khóa học sẽ có giá trị 1.000k. Khi khóa học hoàn
            thiện sẽ trở về giá gốc.
          </span>
          <button className="border w-1/3 hover:bg-blue-500 rounded-2xl cursor-pointer py-1.5">HỌC THỬ MIỄN PHÍ</button>
        </div>
        <img
          src="https://khoahocsinhvien.com/wp-content/uploads/2023/05/Khoa-hoc-HTML-CSS-Master-from-Zero-to-Hero.jpg"
          alt=""
          className="w-50 h-35"
        />
      </div>
      </div>

      <h1 className="text-4xl">Danh sách khóa học:</h1>
      <div className="flex flex-row gap-4">
        {courses.map((course) => (
          <div
            key={course.id}
            className="w-1/3 bg-gray-200 flex flex-col rounded-xl hover:shadow-xl hover:-translate-y-[3px]"
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
                <span>Miễn phí</span>
                {course.firstLessonSlug ? (
                  <Link
                    href={`/learn/${course.slug}/${course.firstLessonSlug}`}
                  >
                    <button className="rounded-full px-2 bg-blue-400 text-white cursor-pointer hover:animate-pulse">
                      Học ngay
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
