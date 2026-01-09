"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type HomeCourseData } from "@/lib/supabase";

export default function HeroSlider({ slides }: { slides: HomeCourseData[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // 1. Dùng useCallback để tránh lỗi dependency và tối ưu hiệu năng
  const nextSlide = useCallback(() => {
    setCurrentIndex((prevIndex) =>
      prevIndex === slides.length - 1 ? 0 : prevIndex + 1
    );
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? slides.length - 1 : prevIndex - 1
    );
  }, [slides.length]);

  const goToSlide = (slideIndex: number) => {
    setCurrentIndex(slideIndex);
  };

  // 2. Fix lỗi missing dependency
  useEffect(() => {
    const timer = setInterval(() => {
      nextSlide();
    }, 5000);
    return () => clearInterval(timer);
  }, [nextSlide]);

  if (!slides || slides.length === 0) return null;

  const currentCourse = slides[currentIndex];

  return (
    <div className="w-full bg-white flex justify-center px-2 md:px-5 group select-none">
      <div className="w-full relative h-auto md:h-80 lg:h-[400px] bg-[#1D2731] flex flex-col md:flex-row items-center justify-between p-5 md:p-10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300">
        {/* TEXT CONTENT */}
        {/* 3. Thêm key={currentIndex} để kích hoạt lại animation mỗi khi đổi slide */}
        <div
          key={`text-${currentIndex}`}
          className="flex flex-col w-full text-white md:w-1/2 justify-center gap-4 text-center md:text-left z-10 animate-in fade-in slide-in-from-bottom-8 duration-700"
        >
          <div className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded-full w-fit mx-auto md:mx-0 border border-blue-500/50">
            KHÓA HỌC NỔI BẬT
          </div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight line-clamp-2">
            {currentCourse.name}
          </h1>
          <span className="text-sm md:text-base text-gray-300 line-clamp-2 md:line-clamp-3">
            {currentCourse.description ||
              "Nâng cao kỹ năng lập trình của bạn với khóa học chất lượng cao từ DevSpace."}
          </span>
          <div className="mt-4 flex gap-3 justify-center md:justify-start">
            <Link href={`/course/${currentCourse.slug}`}>
              <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-semibold transition-all shadow-lg shadow-blue-600/30 hover:-translate-y-1">
                Học ngay
              </button>
            </Link>
            <div className="px-6 py-3 rounded-full border border-white/20 text-white font-medium">
              {currentCourse.price === 0
                ? "Miễn phí"
                : new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                  }).format(currentCourse.price ?? 0)}
            </div>
          </div>
        </div>

        {/* IMAGE */}
        {/* 4. Thêm key và animation fade-in zoom-in cho ảnh */}
        <div className="w-full md:w-1/2 h-48 md:h-full flex items-center justify-center mt-6 md:mt-0 z-10">
          <img
            key={`img-${currentIndex}`}
            src={currentCourse.image_url || "https://placehold.co/600x400/png"}
            alt={currentCourse.name}
            className="h-full w-auto max-h-[300px] object-contain rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-1000"
          />
        </div>

        {/* ARROWS (Giữ nguyên) */}
        <div
          onClick={prevSlide}
          className="hidden group-hover:flex absolute top-1/2 -translate-y-1/2 left-4 w-10 h-10 items-center justify-center rounded-full bg-black/30 text-white cursor-pointer hover:bg-blue-600 transition z-20 backdrop-blur-sm"
        >
          <ChevronLeft size={24} />
        </div>
        <div
          onClick={nextSlide}
          className="hidden group-hover:flex absolute top-1/2 -translate-y-1/2 right-4 w-10 h-10 items-center justify-center rounded-full bg-black/30 text-white cursor-pointer hover:bg-blue-600 transition z-20 backdrop-blur-sm"
        >
          <ChevronRight size={24} />
        </div>

        {/* DOTS (Giữ nguyên) */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-20">
          {slides.map((_, slideIndex) => (
            <div
              key={slideIndex}
              onClick={() => goToSlide(slideIndex)}
              className={`cursor-pointer transition-all duration-500 rounded-full ${
                currentIndex === slideIndex
                  ? "bg-blue-500 w-8 h-2"
                  : "bg-gray-500/50 w-2 h-2 hover:bg-gray-400"
              }`}
            ></div>
          ))}
        </div>

        {/* DECORATION (Giữ nguyên) */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl z-0 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl z-0 pointer-events-none"></div>
      </div>
    </div>
  );
}
