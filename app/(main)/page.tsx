"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getDashboardData, type HomeCourseData } from "@/lib/supabase";
import HeroSlider from "../components/HeroSlider";
import Image from "next/image";
import { Search, Filter, X, Sparkles, ChevronRight } from "lucide-react";

// --- SKELETON COMPONENTS ---
const CourseSkeleton = () => (
  <div className="w-full bg-gray-100 rounded-xl overflow-hidden shadow-lg animate-pulse border border-gray-200">
    <div className="h-48 bg-gray-300 w-full"></div>
    <div className="p-4 flex flex-col gap-3">
      <div className="h-6 bg-gray-300 rounded w-3/4"></div>
      <div className="flex justify-between items-center mt-2">
        <div className="h-5 bg-gray-300 rounded w-1/3"></div>
        <div className="h-8 bg-gray-300 rounded-lg w-20"></div>
      </div>
    </div>
  </div>
);

const BannerSkeleton = () => (
  <div className="w-full h-[400px] md:h-[500px] bg-gray-200 animate-pulse rounded-xl"></div>
);

// --- COMPONENT: FEATURED BOTTOM ---
const FeaturedBottom = ({ courses }: { courses: HomeCourseData[] }) => {
  if (courses.length === 0) return null;

  const topExpensiveCourses = [...courses]
    .sort((a, b) => (b.price || 0) - (a.price || 0))
    .slice(0, 2);

  return (
    <div className="mt-20 mb-10 flex flex-col gap-20">
      <div className="flex items-center gap-3 -mb-10">
        <Sparkles className="text-yellow-500 fill-yellow-500" size={28} />
        <h2 className="text-3xl font-bold text-gray-800">
          Khóa học chuyên sâu
        </h2>
      </div>

      {topExpensiveCourses.map((course, index) => (
        <div
          key={course.id}
          className={`flex flex-col md:flex-row gap-8 md:gap-12 items-center ${index % 2 !== 0 ? "md:flex-row-reverse" : ""}`}
        >
          {/* CỘT 1: ẢNH (Bo góc ít hơn: rounded-xl) */}
          <Link
            href={`/course/${course.slug}`}
            className="w-full md:w-1/2 relative aspect-video rounded-xl overflow-hidden shadow-xl group cursor-pointer block"
          >
            <Image
              src={course.image_url || "https://placehold.co/800x500"}
              alt={course.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute top-4 left-4 bg-yellow-400 text-black font-bold text-xs px-3 py-1 rounded shadow-md">
              PREMIUM
            </div>
          </Link>

          {/* CỘT 2: TEXT */}
          <div className="w-full md:w-1/2 flex flex-col gap-5">
            <Link
              href={`/course/${course.slug}`}
              className="hover:text-blue-600 transition-colors w-fit"
            >
              <h3 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight cursor-pointer">
                {course.name}
              </h3>
            </Link>

            <div className="text-2xl font-bold text-blue-600">
              {new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
              }).format(course.price ?? 0)}
            </div>

            <p className="text-gray-600 text-base md:text-lg leading-relaxed">
              {course.description ||
                "Khóa học chất lượng cao với lộ trình bài bản, giúp bạn làm chủ công nghệ."}
            </p>

            <div className="pt-2">
              {course.firstLessonSlug ? (
                <Link href={`/course/${course.slug}`}>
                  <button className="bg-black text-white px-8 py-3 rounded-lg font-bold text-base flex items-center gap-2 hover:bg-blue-600 hover:shadow-lg transition-all transform hover:-translate-y-1 cursor-pointer">
                    Khám phá ngay <ChevronRight size={18} />
                  </button>
                </Link>
              ) : (
                <span className="text-gray-400 italic font-medium">
                  Đang cập nhật nội dung...
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function Home() {
  const [courses, setCourses] = useState<HomeCourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      const data = await getDashboardData();
      setCourses(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchName = c.name.toLowerCase().includes(search.toLowerCase());
      const price = c.price ?? 0;
      return (
        matchName &&
        (filterType === "all"
          ? true
          : filterType === "free"
            ? price === 0
            : price > 0)
      );
    });
  }, [courses, search, filterType]);

  return (
    <div className="bg-white min-h-screen w-full text-black flex flex-col overflow-x-hidden pb-20">
      {/* 1. HERO BANNER: Thêm mt-6 để tách khỏi Header */}
      <div className="w-full mt-6 md:mt-8">
        {loading ? (
          <div className="max-w-7xl mx-auto px-4">
            <BannerSkeleton />
          </div>
        ) : (
          <HeroSlider slides={courses.slice(0, 3)} />
        )}
      </div>

      {/* 2. MAIN CONTENT */}
      <div className="max-w-[1600px] mx-auto w-full px-4 md:px-6 py-10">
        {/* --- TOOLBAR --- */}
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <span className="block w-2 h-8 bg-blue-600 rounded-sm"></span>
              Danh sách khóa học
            </h1>
            <p className="text-gray-500 mt-1 ml-5 text-sm md:text-base">
              {filteredCourses.length} khóa học chất lượng
            </p>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            {/* Search Box */}
            <div className="relative group w-full md:w-64">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500"
                size={18}
              />
              <input
                type="text"
                placeholder="Tìm khóa học..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {/* Filter Dropdown */}
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
                <option value="pro">Trả phí</option>
              </select>
            </div>
          </div>
        </div>

        {/* --- GRID KHÓA HỌC (Bo góc ít hơn: rounded-xl) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
            Array(6)
              .fill(0)
              .map((_, i) => <CourseSkeleton key={i} />)
          ) : filteredCourses.length > 0 ? (
            filteredCourses.map((course) => (
              <div
                key={course.id}
                className="w-full bg-white border border-gray-100 shadow-sm hover:shadow-xl flex flex-col rounded-xl overflow-hidden hover:-translate-y-1 transition-all duration-300 group"
              >
                {/* Ảnh Thumbnail - Clickable */}
                <Link
                  href={`/course/${course.slug}`}
                  className="relative overflow-hidden w-full aspect-video cursor-pointer block"
                >
                  <Image
                    src={course.image_url || "https://placehold.co/600x400"}
                    alt={course.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-bold shadow-sm text-black z-10">
                    {course.price === 0 ? "FREE" : "PRO"}
                  </div>
                </Link>

                {/* Nội dung Card */}
                <div className="p-5 flex flex-col gap-4">
                  <Link href={`/course/${course.slug}`}>
                    <h2 className="uppercase text-lg font-bold line-clamp-2 group-hover:text-blue-600 transition-colors min-h-14 flex items-center cursor-pointer">
                      {course.name}
                    </h2>
                  </Link>

                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
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
                        <button className="rounded-lg w-9 h-9 flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-blue-600 hover:text-white transition-all cursor-pointer">
                          <ChevronRight size={18} />
                        </button>
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400 italic">
                        Sắp ra mắt
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center text-gray-400">
              Không tìm thấy khóa học nào.
            </div>
          )}
        </div>

        {/* --- FEATURED SECTION --- */}
        {!loading && (
          <>
            <div className="w-full h-px bg-gray-200 my-16"></div>
            <FeaturedBottom courses={courses} />
          </>
        )}
      </div>
    </div>
  );
}
