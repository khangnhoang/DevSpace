"use client";
import React, { useEffect, useState, use } from "react";

import {
  Check,
  CircleFadingArrowUp,
  Film,
  Clock,
  BatteryFull,
  PlayCircle,
  Plus,
  Minus,
  Loader2,
} from "lucide-react";
import { getFullCourseDetail, type CourseDetail } from "@/lib/supabase";

export default function DetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<number[]>([]);

  const {slug} = use(params);

  useEffect(() => {
    const fetchCourseDetail = async () => {
      setLoading(true);
      try {
        const data = await getFullCourseDetail(slug);
        if (data) {
          setCourse(data);
          if (data.chapters.length > 0) {
            setExpandedChapters([data.chapters[0].id]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch course: ", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCourseDetail();
  }, [slug]);

  const toggleChapter = (id: number) => {
    setExpandedChapters((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleExpandAll = () => {
    if (!course) return;
    const allIds = course.chapters.map((c) => c.id);
    if (expandedChapters.length === allIds.length) {
      setExpandedChapters([]);
    } else {
      setExpandedChapters(allIds);
    }
  };

  if (loading)
    return (
      <div className="bg-[#111827] w-full min-h-screen flex justify-center items-center">
        <Loader2 className="animate-spin text-white" size={48} />
      </div>
    );

  if (!course)
    return (
      <div className="bg-[#111827] w-full min-h-screen flex justify-center items-center text-white">
        <p>Không tìm thấy khóa học.</p>
      </div>
    );

  return (
    <div className="bg-[#111827] w-full min-h-screen p-4 flex md:p-8 flex-col lg:flex-row gap-8 justify-center">
      <div className="w-full lg:w-2/3 flex flex-col gap-8">
        <div className="w-full flex flex-col gap-4">
          <h1 className="text-2xl md:text-3xl font-bold">
            Lập Trình JavaScript Cơ Bản
          </h1>
          <p className="text-sm leading-relaxed">
            Học Javascript cơ bản phù hợp cho người chưa từng học lập trình. Với
            hơn 100 bài học và có bài tập thực hành sau mỗi bài học.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-xl md:text-2xl font-bold">Bạn sẽ học được gì?</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {course.learning_outcomes.map((item, index) => (
              <div key={index} className="flex gap-3 items-start">
                <Check size={20} className="text-blue-400" />
                <p className="text-gray-400">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex flex-col gap-4">
            <p className="text-xl md:text-2xl font-bold">Nội dung khóa học</p>
            <div className="flex justify-between items-end flex-wrap gap-2">
              <div className="flex gap-2 text-sm flex-wrap">
                <p className="font-bold">6</p>
                <p className="">chương</p>
                <p className="font-bold">.</p>
                <p className="font-bold">30</p>
                <p className="">bài học</p>
                <p className="font-bold">.</p>
                <p className="">Thời lượng</p>
                <p className="font-bold">24 giờ 30 phút</p>
              </div>
              <div>
                <button
                  className="text-blue-400 cursor-pointer hover:text-blue-300 text-sm"
                  onClick={handleExpandAll}
                >
                  {expandedChapters.length === course.chapters.length
                    ? "Thu gọn tất cả"
                    : "Mở rộng tất cả"}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {course.chapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className="flex bg-[#1f2937] border border-gray-700 rounded-md flex-col"
                >
                  <div
                    onClick={() => toggleChapter(chapter.id)}
                    className="flex justify-between items-center p-3 md:p-4 hover:bg-gray-700 select-none"
                  >
                    <div className="flex items-center gap-3 cursor-pointer">
                      <div className="text-blue-400">
                        {expandedChapters.includes(chapter.id) ? (
                          <Minus size={20} />
                        ) : (
                          <Plus size={20} />
                        )}
                      </div>
                      <h3 className="text-sm md:text-base">{chapter.title}</h3>
                    </div>
                    <div className="">
                      <span className="hidden sm:block text-sm text-gray-400 shrink-0 ml-2">
                        {chapter.lessons.length} Bài học
                      </span>
                    </div>
                  </div>

                  {expandedChapters.includes(chapter.id) && (
                    <div className="flex flex-col gap-1 border-t border-gray-700">
                      {chapter.lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="flex gap-3 cursor-pointer group justify-between border-b border-gray-700 p-2"
                        >
                          <div className="flex items-center gap-3">
                            <PlayCircle
                              size={16}
                              className="group-hover:text-green-500 text-gray-500 shrink-0"
                            />
                            <span className="text-sm text-gray-400">
                              {lesson.title}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs flex items-center text-gray-400 shrink-0">
                              {lesson.duration_display}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="w-full lg:w-1/3">
        <div className="flex flex-col gap-4 w-full justify-center items-center bg-[#1f2937] p-4 rounded-xl border border-gray-700 lg:sticky lg:top-4">
          <img
            src={course.image_url}
            alt=""
            className="w-90 rounded-xl"
          />
          <h1 className="text-3xl text-green-400">{course.price_text}</h1>
          <button className="px-4 py-2 bg-blue-500 rounded-full cursor-pointer hover:bg-blue-400">
            ĐĂNG KÝ HỌC
          </button>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <CircleFadingArrowUp size={20} />
              <p>Trình độ: {course.stats.level}</p>
            </div>
            <div className="flex gap-2">
              <Film size={20} />
              <p>{course.stats.lesson_count} bài học</p>
            </div>
            <div className="flex gap-2">
              <Clock size={20} />
              <p>Tổng thời lượng: {course.stats.duration}</p>
            </div>
            <div className="flex gap-2">
              <BatteryFull size={20} />
              <p>{course.stats.accessibility}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
