"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getDashboardData, type HomeCourseData } from "@/lib/supabase";
import HeroSlider from "../components/HeroSlider"; // Đảm bảo ông có file này
import Image from "next/image";
import { Search, Filter, X } from "lucide-react"; // Nhớ cài: npm i lucide-react

// --- SKELETON COMPONENTS ---
const CourseSkeleton = () => {
  return (
    <div className="w-full bg-gray-100 rounded-2xl overflow-hidden shadow-lg animate-pulse border border-gray-200">
      <div className="h-48 bg-gray-300 w-full"></div>
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
  );
};

export default function Home() {
  const [courses, setCourses] = useState<HomeCourseData[]>([]);
  const [loading, setLoading] = useState(true);

  // --- STATE BỘ LỌC ---
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all"); // all | free | pro

  useEffect(() => {
    const fetchData = async () => {
      const data = await getDashboardData();
      setCourses(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  // --- LOGIC LỌC DỮ LIỆU ---
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      // 1. Lọc theo tên (không phân biệt hoa thường)
      const matchName = c.name.toLowerCase().includes(search.toLowerCase());
      const price = c.price ?? 0;

      // 2. Lọc theo loại
      const matchType =
        filterType === "all"
          ? true
          : filterType === "free"
            ? price === 0
            : price > 0; // pro

      return matchName && matchType;
    });
  }, [courses, search, filterType]);

  return (
    <div className="bg-white min-h-screen w-full p-2 text-black flex flex-col gap-8 overflow-x-hidden pb-10">
      {/* --- PHẦN 1: HERO BANNER --- */}
      {loading ? (
        <BannerSkeleton />
      ) : (
        <HeroSlider slides={courses.slice(0, 3)} />
      )}

      {/* --- PHẦN 2: THANH CÔNG CỤ (SEARCH & FILTER) --- */}
      <div className="px-2 md:px-5 flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <span className="block w-2 h-8 bg-blue-600 rounded-sm"></span>
            Danh sách khóa học
          </h1>
          <p className="text-gray-500 mt-1 ml-5 text-sm md:text-base">
            {filteredCourses.length} khóa học phù hợp với bạn
          </p>
        </div>

        {/* Cụm input tìm kiếm & lọc */}
        <div className="flex gap-3 w-full md:w-auto">
          {/* Input Search */}
          <div className="relative group w-full md:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500"
              size={18}
            />
            <input
              type="text"
              placeholder="Tìm tên khóa học..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Dropdown Filter */}
          <div className="relative">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <select
              className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white appearance-none cursor-pointer hover:border-blue-400 transition-colors"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="free">Miễn phí</option>
              <option value="pro">Trả phí (Pro)</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- PHẦN 3: COURSE GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-2 md:px-5">
        {loading ? (
          Array(6)
            .fill(0)
            .map((_, index) => <CourseSkeleton key={index} />)
        ) : filteredCourses.length > 0 ? (
          filteredCourses.map((course) => (
            <div
              key={course.id}
              className="w-full bg-white border border-gray-100 shadow-lg flex flex-col rounded-2xl overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="relative overflow-hidden w-full aspect-video">
                <Image
                  src={course.image_url || "https://placehold.co/600x400"}
                  alt={course.name}
                  fill
                  className="object-cover cursor-pointer group-hover:scale-110 transition-transform duration-500"
                  sizes="(max-width: 768px) 100vw, 33vw"
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
        ) : (
          // Empty State khi lọc không có kết quả
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400">
            <Search size={48} className="mb-4 opacity-20" />
            <p>Không tìm thấy khóa học nào phù hợp với bộ lọc.</p>
            <button
              onClick={() => {
                setSearch("");
                setFilterType("all");
              }}
              className="mt-4 text-blue-600 font-medium hover:underline"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
