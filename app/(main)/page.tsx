"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getDashboardData, type HomeCourseData } from "@/lib/supabase";
import HeroSlider from "../components/HeroSlider";
import Image from "next/image";

// --- 1. COMPONENT SKELETON (Định nghĩa ngay trong file này) ---
const CourseSkeleton = () => {
  return (
    <div className="w-full bg-gray-100 rounded-2xl overflow-hidden shadow-lg animate-pulse border border-gray-200">
      {/* Ảnh giả lập */}
      <div className="h-48 bg-gray-300 w-full"></div>
      {/* Nội dung giả lập */}
      <div className="p-4 flex flex-col gap-3">
        <div className="h-6 bg-gray-300 rounded w-3/4"></div>
        <div className="h-4 bg-gray-300 rounded w-full"></div>
        <div className="h-4 bg-gray-300 rounded w-2/3"></div>
        <div className="flex justify-between items-center mt-2">
           <div className="h-5 bg-gray-300 rounded w-1/3"></div>
           <div className="h-8 bg-gray-300 rounded-full w-20"></div>
        </div>
      </div>
    </div>
  );
};

const BannerSkeleton = () => {
  return (
    <div className="w-full px-2 md:px-5">
       <div className="w-full h-64 md:h-80 lg:h-[400px] bg-gray-200 rounded-2xl animate-pulse"></div>
    </div>
  )
}
// -----------------------------------------------------------

export default function Home() {
  const [courses, setCourses] = useState<HomeCourseData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Giả lập delay nhẹ để thấy skeleton (nếu mạng quá nhanh)
      // await new Promise(r => setTimeout(r, 800)); 
      
      const data = await getDashboardData();
      setCourses(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  return (
    <div className="bg-white min-h-screen w-full p-2 text-black flex flex-col gap-6 overflow-x-hidden">
      
      {/* --- PHẦN 1: HERO BANNER --- */}
      {loading ? (
        <BannerSkeleton />
      ) : (
        // Lấy 3 khóa học đầu tiên đưa vào Slider
        <HeroSlider slides={courses.slice(0, 3)} />
      )}

      <div className="px-2 md:px-5">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
           <span className="block w-2 h-8 bg-blue-600 rounded-sm"></span>
           Danh sách khóa học
        </h1>
        <p className="text-gray-500 mt-1 ml-5">Các khóa học lập trình chất lượng cao dành cho bạn</p>
      </div>

      {/* --- PHẦN 2: COURSE GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10 px-2 md:px-5">
        
        {loading ? (
          // Hiển thị 6 cái Skeleton khi đang tải
          Array(6).fill(0).map((_, index) => (
            <CourseSkeleton key={index} />
          ))
        ) : (
          // Hiển thị danh sách thật
          courses.map((course) => (
            <div
              key={course.id}
              className="w-full bg-white border border-gray-100 shadow-xl flex flex-col rounded-2xl overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="relative overflow-hidden w-full aspect-video">
                <Image
                  src={course.image_url || "https://placehold.co/600x400"} // Fallback nếu ko có ảnh
                  alt={course.name}
                  fill // Tự động lấp đầy khung cha (aspect-video)
                  className="object-cover rounded-t-xl cursor-pointer group-hover:scale-110 transition-transform duration-500"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // Tối ưu load ảnh theo kích thước màn hình
                />
                
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold shadow-sm text-black z-10">
                   {course.price === 0 ? "FREE" : "PRO"}
                </div>
              </div>

              <div className="flex flex-col gap-2 p-5 flex-1 justify-between">
                <div>
                  <h2 className="uppercase text-xl font-bold line-clamp-1 group-hover:text-blue-600 transition-colors">
                    {course.name}
                  </h2>
                  <p className="text-gray-500 italic text-sm line-clamp-2 mt-1 h-10">
                    {course.description}
                  </p>
                </div>
                
                <div className="flex justify-between items-end mt-4 pt-4 border-t border-dashed border-gray-200">
                  <span className="text-lg font-bold text-blue-600">
                    {course.price === 0
                      ? "Miễn phí"
                      : new Intl.NumberFormat("vi-VN", {
                          style: "currency",
                          currency: "VND",
                        }).format(course.price ?? 0)}
                  </span>
                  
                  {course.firstLessonSlug ? (
                    <Link href={`/course/${course.slug}`}>
                      <button className="rounded-full px-5 py-2 bg-black text-white text-sm font-medium cursor-pointer hover:bg-blue-600 transition-colors hover:shadow-lg hover:shadow-blue-500/30">
                        Chi tiết
                      </button>
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="rounded-full px-5 py-2 bg-gray-100 text-gray-400 text-sm font-medium cursor-not-allowed"
                    >
                      Sắp ra mắt
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}