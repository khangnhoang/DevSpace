"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type HomeCourseData } from "@/lib/supabase";
import { NO_COURSE_IMAGE } from "@/lib/constants";

export default function HeroSlider({ slides }: { slides: HomeCourseData[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null); // Dùng ref để quản lý timer thủ công nếu cần

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

  // Logic: Mỗi khi currentIndex thay đổi (do click hoặc do tự động),
  // useEffect này sẽ chạy lại -> Xóa timer cũ -> Tạo timer mới 5s.
  // => Đảm bảo sau khi click, phải chờ đủ 5s mới tự next tiếp.
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      nextSlide();
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, nextSlide]); // Quan trọng: dependency currentIndex

  if (!slides || slides.length === 0) return null;

  const currentCourse = slides[currentIndex];

  return (
    <div className="w-full bg-white flex justify-center px-2 md:px-5 group select-none">
      <div className="w-full relative h-auto md:h-80 lg:h-[400px] bg-[#1D2731] flex flex-col md:flex-row items-center justify-between p-5 md:p-10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300">
        
        {/* --- TEXT CONTENT (Giữ nguyên) --- */}
        <div
          key={`text-${currentIndex}`}
          className="flex flex-col w-full text-white md:w-1/2 justify-center gap-4 text-center md:text-left z-10 
                     animate-in fade-in slide-in-from-bottom-10 duration-1000 ease-out"
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

        {/* --- IMAGE SECTION --- */}
        <div className="w-full md:w-1/2 h-48 md:h-full flex items-center justify-center mt-6 md:mt-0 z-10 relative">
          {/* FIX LỖI BO TRÒN:
             1. Thêm overflow-hidden
             2. Thêm rounded-xl (hoặc kích thước bo bạn muốn)
             3. Đảm bảo Image nằm gọn trong div này
          */}
          <div 
            key={`img-${currentIndex}`} 
            className="relative w-full h-full flex items-center justify-center 
                       animate-in fade-in zoom-in-95 duration-1000 ease-out
                       rounded-xl overflow-hidden" 
          >
            <Image
              src={currentCourse.image_url || NO_COURSE_IMAGE}
              alt={currentCourse.name}
              fill
              priority
              // object-contain giữ nguyên tỷ lệ ảnh, 
              // nếu muốn ảnh bo tròn theo khung mà ko bị khoảng trắng thừa thì cân nhắc object-cover
              className="object-contain drop-shadow-2xl rounded-xl" 
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
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

        {/* BACKGROUND DECORATION (Giữ nguyên) */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl z-0 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl z-0 pointer-events-none"></div>
      </div>
    </div>
  );
}