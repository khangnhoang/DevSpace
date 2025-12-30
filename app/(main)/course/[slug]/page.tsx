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
import {
  getFullCourseDetail,
  type CourseDetail,
  checkHasEnroll,
  supabase,
  getLastAccessedLessonSlug,
} from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createPendingPayment } from "@/app/action/payment";
import { enrollCourse } from "@/app/action/enroll";
import CoursePaymentModal from "@/app/components/CoursePaymentModal";
import { User } from "@supabase/supabase-js";
import Image from "next/image";

export default function DetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const { slug } = use(params);

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedChapters, setExpandedChapters] = useState<number[]>([]);
  const [hasEnrolled, setHasEnrolled] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isOpenPaymentForm, setIsOpenPaymentForm] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const getDestinationRoute = async (
    currentCourse: CourseDetail,
    userId: string
  ) => {
    const lastSlug = await getLastAccessedLessonSlug(userId, currentCourse.id);
    if (lastSlug) {
      return `/learn/${currentCourse.slug}/${lastSlug}`;
    }

    if (
      currentCourse.chapters.length > 0 &&
      currentCourse.chapters[0].lessons.length > 0
    ) {
      const firstSlug = currentCourse.chapters[0].lessons[0].slug;
      return `/learn/${currentCourse.slug}/${firstSlug}`;
    }

    return null;
  };

  useEffect(() => {
    const initPageData = async () => {
      setLoading(true);
      try {
        const [courseData, enrollmentStatus] = await Promise.all([
          getFullCourseDetail(slug),
          checkHasEnroll(slug),
        ]);

        if (courseData) {
          setCourse(courseData);
          if (courseData.chapters.length > 0) {
            setExpandedChapters([courseData.chapters[0].id]);
          }
        }
        setHasEnrolled(enrollmentStatus);

        if (enrollmentStatus && courseData) {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user) {
            const destination = await getDestinationRoute(courseData, user.id);

            if (destination) {
              router.push(destination);
              return;
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch course data:", error);
        toast.error("Không thể tải thông tin khóa học");
      } finally {
        setLoading(false);
      }
    };

    if (slug) initPageData();
  }, [slug, router]);

  const toggleChapter = (id: number) => {
    setExpandedChapters((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleExpandAll = () => {
    if (!course) return;
    const allIds = course.chapters.map((c) => c.id);
    setExpandedChapters(
      expandedChapters.length === allIds.length ? [] : allIds
    );
  };

  const handleEnrollmentClick = async () => {
    if (!course) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.warning("Bạn phải đăng nhập mới có thể đăng ký học");
      return;
    }
    setCurrentUser(user);

    if (course.price > 0) {
      setIsEnrolling(true);
      const res = await createPendingPayment(course.id, user.id);
      setIsEnrolling(false);

      if (res.error) {
        toast.error(res.error);
        return;
      }

      if (res.success && res.paymentId) {
        setCurrentPaymentId(res.paymentId);
        setIsOpenPaymentForm(true);
      }
    } else {
      processFreeEnrollment(user.id);
    }
  };

  const processFreeEnrollment = async (userId: string) => {
    setIsEnrolling(true);
    try {
      const result = await enrollCourse(course!.id, userId, 0);

      if (result.error) {
        toast.error(result.error);
        setIsEnrolling(false);
      } else if (result.success) {
        toast.success("Đăng ký thành công! Đang vào lớp học...");
        handleEnrollmentSuccess(result.slug);
      }
    } catch (error) {
      toast.error("Có lỗi xảy ra" + error);
      setIsEnrolling(false);
    }
  };

  const handleEnrollmentSuccess = async (courseSlug: string) => {
    setHasEnrolled(true);
    setIsOpenPaymentForm(false);

    let destUrl = "";
    if (
      course &&
      course.chapters.length > 0 &&
      course.chapters[0].lessons.length > 0
    ) {
      const firstSlug = course.chapters[0].lessons[0].slug;
      destUrl = `/learn/${courseSlug}/${firstSlug}`;
    }

    if (destUrl) {
      setTimeout(() => {
        router.push(destUrl);
      }, 1000); // Giảm delay xuống 1s cho nhanh
    } else {
      toast.warning("Khóa học này chưa cập nhật bài học nào.");
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
        <div className="text-center">
          <p className="text-xl font-bold mb-2">Không tìm thấy khóa học</p>
          <button
            onClick={() => router.push("/")}
            className="text-blue-400 hover:underline"
          >
            Quay về trang chủ
          </button>
        </div>
      </div>
    );

  return (
    <div className="bg-[#111827] w-full min-h-screen p-4 flex md:p-8 flex-col lg:flex-row gap-8 justify-center">
      {/* CỘT TRÁI: NỘI DUNG KHÓA HỌC */}
      <div className="w-full lg:w-2/3 flex flex-col gap-8">
        <div className="w-full flex flex-col gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {course.name}
          </h1>
          <p className="text-sm leading-relaxed text-gray-300">
            {course.description}
          </p>
        </div>

        {/* Learning Outcomes */}
        {course.learning_outcomes && course.learning_outcomes.length > 0 && (
          <div className="flex flex-col gap-4">
            <h1 className="text-xl md:text-2xl font-bold text-white">
              Bạn sẽ học được gì?
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {course.learning_outcomes.map((item, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <Check size={20} className="text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-gray-400 text-sm">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Danh sách bài học */}
        <div>
          <div className="flex flex-col gap-4">
            <p className="text-xl md:text-2xl font-bold">Nội dung khóa học</p>
            <div className="flex justify-between items-end flex-wrap gap-2 text-gray-300">
              <div className="flex gap-2 text-sm flex-wrap items-center">
                <p className="font-bold">{course.chapters.length}</p>{" "}
                <p>chương</p> <span className="mx-1">•</span>
                <p className="font-bold">{course.stats.lesson_count}</p>{" "}
                <p>bài học</p> <span className="mx-1">•</span>
                <p>Thời lượng</p>{" "}
                <p className="font-bold">{course.stats.duration}</p>
              </div>
              <button
                className="text-blue-400 cursor-pointer hover:text-blue-300 text-sm font-medium"
                onClick={handleExpandAll}
              >
                {expandedChapters.length === course.chapters.length &&
                course.chapters.length > 0
                  ? "Thu gọn tất cả"
                  : "Mở rộng tất cả"}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {course.chapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className="flex bg-[#1f2937] border border-gray-700 rounded-lg flex-col overflow-hidden"
                >
                  <div
                    onClick={() => toggleChapter(chapter.id)}
                    className="flex justify-between items-center p-3 md:p-4 hover:bg-gray-700 select-none cursor-pointer text-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-blue-400">
                        {expandedChapters.includes(chapter.id) ? (
                          <Minus size={18} />
                        ) : (
                          <Plus size={18} />
                        )}
                      </div>
                      <h3 className="text-sm md:text-base font-medium">
                        {chapter.title}
                      </h3>
                    </div>
                    <span className="hidden sm:block text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                      {chapter.lessons.length} bài
                    </span>
                  </div>

                  {expandedChapters.includes(chapter.id) && (
                    <div className="flex flex-col border-t border-gray-700 animate-in slide-in-from-top-2 duration-200">
                      {chapter.lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="flex gap-3 items-center justify-between border-b border-gray-700/50 p-3 pl-10 hover:bg-gray-700/50"
                        >
                          <div className="flex items-center gap-3">
                            <PlayCircle
                              size={16}
                              className="text-gray-500 shrink-0"
                            />
                            <span className="text-sm text-gray-300">
                              {lesson.title}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {lesson.duration_display}
                          </span>
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

      {/* CỘT PHẢI: SIDEBAR MUA KHÓA HỌC */}
      <div className="w-full lg:w-1/3">
        <div className="flex flex-col gap-5 w-full bg-[#1f2937] p-5 rounded-xl border border-gray-700 lg:sticky lg:top-8 shadow-xl">
          <div className="relative aspect-video w-full rounded-lg overflow-hidden group">
            <Image
              src={course.image_url}
              alt={course.name}
              fill
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <PlayCircle size={48} className="text-white drop-shadow-lg" />
            </div>
          </div>

          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-3xl font-bold text-green-400">
              {course.price_text}
            </h1>
            {course.price > 0 && (
              <p className="text-xs text-gray-400 line-through">
                {(course.price * 1.5).toLocaleString()}đ
              </p>
            )}
          </div>

          <button
            onClick={
              hasEnrolled
                ? () => {
                    getDestinationRoute(course, "").then((url) => {
                      if (url) router.push(url);
                      else {
                        if (course.chapters[0]?.lessons[0])
                          router.push(
                            `/learn/${course.slug}/${course.chapters[0].lessons[0].slug}`
                          );
                      }
                    });
                  }
                : handleEnrollmentClick
            }
            disabled={isEnrolling || loading}
            className={`px-4 py-3 rounded-full cursor-pointer transition-all w-full font-bold text-lg
              ${
                isEnrolling
                  ? "bg-gray-600 cursor-not-allowed text-gray-300"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transform hover:-translate-y-0.5"
              }
            `}
          >
            {isEnrolling ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={24} /> Đang xử lý...
              </div>
            ) : hasEnrolled ? (
              "Tiếp tục học ngay"
            ) : course.price === 0 ? (
              "Đăng ký học ngay"
            ) : (
              "Mua khóa học ngay"
            )}
          </button>

          <div className="flex flex-col gap-3 mt-2 text-sm text-gray-300 border-t border-gray-700 pt-4">
            <div className="flex gap-3 items-center">
              <CircleFadingArrowUp size={18} className="text-white" />
              <p>
                Trình độ:{" "}
                <span className="font-semibold text-white capitalize">
                  {course.stats.level}
                </span>
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <Film size={18} className="text-white" />
              <p>
                Tổng số{" "}
                <span className="font-semibold text-white">
                  {course.stats.lesson_count}
                </span>{" "}
                bài học
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <Clock size={18} className="text-white" />
              <p>
                Thời lượng:{" "}
                <span className="font-semibold text-white">
                  {course.stats.duration}
                </span>
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <BatteryFull size={18} className="text-white" />
              <p>{course.stats.accessibility}</p>
            </div>
          </div>
        </div>
      </div>
      {/* === THÊM MODAL VÀO CUỐI JSX (Trước thẻ đóng div ngoài cùng) === */}
      {isOpenPaymentForm && course && currentUser && currentPaymentId &&(
        <CoursePaymentModal
          course={course}
          userId={currentUser.id}
          paymentId={currentPaymentId} 
          onClose={() => setIsOpenPaymentForm(false)}
          onSuccess={() => handleEnrollmentSuccess(course.slug)}
        />
      )}
    </div>
  );
}
