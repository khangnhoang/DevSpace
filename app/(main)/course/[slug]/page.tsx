"use client";
import React, { useEffect, useState, use, useCallback } from "react";
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
  Briefcase,
  UserRound,
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
import VideoModal from "@/app/components/VideoModal";
import CustomAvatar from "@/app/components/CustomAvatar";

interface ReviewItem {
  id: number | string;
  rating: number;
  content: string;
  created_at: string;
  profiles?: { full_name?: string | null; avatar_url?: string | null } | null;
}

// --- 1. COMPONENT REVIEWS (ĐỂ RA NGOÀI ĐỂ TRÁNH LỖI RENDER) ---
// --- COMPONENT COURSE REVIEWS (BẢN NÂNG CẤP) ---
// --- COMPONENT COURSE REVIEWS (BẢN FINAL: PHÂN TRANG + FIX LỖI) ---
const CourseReviews = ({
  courseId,
  hasEnrolled,
}: {
  courseId: number;
  hasEnrolled: boolean;
}) => {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // -- STATE PHÂN TRANG --
  const [page, setPage] = useState(0); // Trang hiện tại (bắt đầu từ 0)
  const [hasMore, setHasMore] = useState(true); // Còn data để load không?
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const ITEMS_PER_PAGE = 5; // Số review mỗi lần load
  const MAX_ITEMS = 50; // Giới hạn cứng (10 trang)

  // Hàm fetch data tách riêng để tái sử dụng
  const fetchReviews = useCallback(
    async (pageIndex: number, isRefresh = false) => {
      try {
        if (pageIndex * ITEMS_PER_PAGE >= MAX_ITEMS) {
          setHasMore(false);
          return;
        }

        const from = pageIndex * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        const { data, error } = await supabase
          .from("reviews")
          .select("*, profiles:profile_cards(full_name, avatar_url)", { count: "exact" })
          .eq("course_id", courseId) // Nó phụ thuộc vào courseId
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;

        if (data) {
          if (isRefresh) {
            setReviews(data);
          } else {
            setReviews((prev) => [...prev, ...data]);
          }

          if (data.length < ITEMS_PER_PAGE) {
            setHasMore(false);
          }
        }
      } catch (err) {
        console.error("Fetch reviews error:", err);
      }
    },
    [courseId],
  ); // 👈 QUAN TRỌNG: Chỉ tạo lại hàm khi courseId đổi

  const checkUserReview = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("reviews")
      .select("rating, content")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle(); // Dùng maybeSingle để không lỗi nếu chưa có

    if (data) {
      setRating(data.rating);
      setContent(data.content || "");
      setIsEditing(true); // Bật chế độ sửa
    }
  }, [courseId]);

  // Load lần đầu
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the pagination reset must happen before the refetch; moving it into the async callback changes when "Xem thêm" reappears, tracked in BL-003
    setPage(0);
    setHasMore(true);
    fetchReviews(0, true);
    if (hasEnrolled) {
      checkUserReview(); // Chỉ check nếu đã mua khóa học
    }
  }, [fetchReviews, checkUserReview, hasEnrolled]);

  // Xử lý nút "Xem thêm"
  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    const nextPage = page + 1;
    await fetchReviews(nextPage);
    setPage(nextPage);
    setIsLoadingMore(false);
  };

  // --- LOGIC TÍNH SAO (GIỮ NGUYÊN) ---
  // Lưu ý: Tính rating trung bình thì nên dùng RPC (Server function) sẽ chuẩn hơn
  // Nhưng tạm thời tính dựa trên reviews đã load cũng được (tương đối)
  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? (
          reviews.reduce((acc, item) => acc + item.rating, 0) / totalReviews
        ).toFixed(1)
      : "0.0";

  const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number>;
  reviews.forEach((r) => {
    const star = Math.round(r.rating);
    if (star >= 1 && star <= 5) starCounts[star as keyof typeof starCounts]++;
  });

  // --- SUBMIT REVIEW ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("reviews").upsert(
      {
        user_id: user?.id,
        course_id: courseId,
        rating: rating,
        content: content,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id, course_id" },
    );

    if (error) {
      toast.error("Lỗi: " + error.message);
    } else {
      toast.success("Đánh giá thành công!");
      setContent("");
      // Reset lại list để hiện review mới nhất lên đầu
      setPage(0);
      setHasMore(true);
      fetchReviews(0, true);
      setIsEditing(true);
    }
    setSubmitting(false);
  };

  return (
    <div className="mt-12 max-w-4xl border-t border-gray-700 pt-8">
      <h2 className="text-2xl font-bold text-white mb-8">
        Đánh giá & Nhận xét
      </h2>

      {/* DASHBOARD THỐNG KÊ (GIỮ NGUYÊN) */}
      <div className="flex flex-col md:flex-row gap-8 mb-10 items-center bg-[#1f2937] p-6 rounded-xl border border-gray-700">
        <div className="flex flex-col items-center justify-center gap-2 min-w-[150px]">
          <div className="text-6xl font-extrabold text-white">
            {averageRating}
          </div>
          <div className="flex text-yellow-400 text-xl gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star}>
                {star <= Math.round(Number(averageRating)) ? "★" : "☆"}
              </span>
            ))}
          </div>
          <p className="text-gray-400 text-sm">
            {totalReviews} đánh giá (đã tải)
          </p>
        </div>
        <div className="flex-1 w-full flex flex-col gap-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = starCounts[star] || 0;
            const percent = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-3 text-sm">
                <span className="text-white w-3 font-bold">{star}</span>
                <span className="text-yellow-400">★</span>
                <div className="flex-1 h-2.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full"
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
                <span className="text-gray-400 w-10 text-right">
                  {percent.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* FORM VIẾT ĐÁNH GIÁ (GIỮ NGUYÊN) */}
      {hasEnrolled && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-8"
        >
          <h3 className="text-white font-bold mb-4">
            {isEditing ? "Chỉnh sửa đánh giá của bạn" : "Viết đánh giá của bạn"}
          </h3>
          <div className="flex gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => setRating(star)}
                className={`cursor-pointer text-3xl transition-transform hover:scale-110 ${star <= rating ? "text-yellow-400" : "text-gray-600"}`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Chia sẻ cảm nhận..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white mb-3 h-24 focus:outline-none focus:border-blue-500"
          />
          <div className="flex justify-end">
            <button
              disabled={submitting}
              className="cursor-pointer bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-500 disabled:opacity-50"
            >
              {submitting
                ? "Đang xử lý..."
                : isEditing
                  ? "Cập nhật đánh giá"
                  : "Gửi đánh giá"}
            </button>
          </div>
        </form>
      )}

      {/* DANH SÁCH REVIEW (CÓ PHÂN TRANG) */}
      <div className="flex flex-col gap-6">
        {reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-500 italic bg-gray-800/50 rounded-lg">
            Chưa có đánh giá nào.
          </div>
        ) : (
          reviews.map((review) => (
            <div
              key={review.id}
              className="bg-[#1f2937] p-5 rounded-xl border border-gray-700 flex gap-4 animate-in fade-in slide-in-from-bottom-2"
            >
              <div className="shrink-0">
                <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-bold text-white text-sm overflow-hidden shadow-md">
                  {review.profiles?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- review avatar from an arbitrary remote URL; next/image needs a size and remote host config, tracked in BL-003
                    <img
                      src={review.profiles.avatar_url}
                      alt="Ava"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    review.profiles?.full_name?.charAt(0) || "U"
                  )}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <p className="text-white font-bold text-sm">
                      {review.profiles?.full_name || "Học viên ẩn danh"}
                    </p>
                    <div className="flex text-yellow-400 text-xs mt-0.5">
                      {Array(5)
                        .fill(0)
                        .map((_, i) => (
                          <span
                            key={i}
                            className={
                              i < review.rating
                                ? "text-yellow-400"
                                : "text-gray-600"
                            }
                          >
                            ★
                          </span>
                        ))}
                    </div>
                  </div>
                  <span className="text-gray-500 text-xs ml-auto">
                    {new Date(review.created_at).toLocaleDateString("vi-VN")}
                  </span>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mt-2 bg-[#111827] p-3 rounded-lg border border-gray-800">
                  {review.content}
                </p>
              </div>
            </div>
          ))
        )}

        {/* NÚT LOAD MORE */}
        {hasMore && reviews.length > 0 && (
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="mx-auto mt-4 text-sm text-gray-400 hover:text-white hover:underline disabled:opacity-50"
          >
            {isLoadingMore ? "Đang tải thêm..." : "Xem thêm đánh giá cũ hơn"}
          </button>
        )}
      </div>
    </div>
  );
};

// --- 2. COMPONENT CHÍNH ---
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
  const [hasPendingPayment, setHasPendingPayment] = useState(false);

  const [isOpenPaymentForm, setIsOpenPaymentForm] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);

  const checkPendingStatus = async (userId: string, courseId: number) => {
    const { data } = await supabase
      .from("payments")
      .select("id, status")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("status", "pending")
      .maybeSingle();
    return !!data;
  };

  const getDestinationRoute = async (
    currentCourse: CourseDetail,
    userId: string,
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
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const [courseData, enrollmentStatus] = await Promise.all([
          getFullCourseDetail(slug),
          checkHasEnroll(slug, user?.id || null),
        ]);

        if (courseData) {
          setCourse(courseData);
          if (courseData.chapters.length > 0) {
            setExpandedChapters([courseData.chapters[0].id]);
          }
          if (user && !enrollmentStatus) {
            const isPending = await checkPendingStatus(user.id, courseData.id);
            setHasPendingPayment(isPending);
          }
        }
        setHasEnrolled(enrollmentStatus);
      } catch (error) {
        console.error("Failed to fetch course data:", error);
        toast.error("Không thể tải thông tin khóa học");
      } finally {
        setLoading(false);
      }
    };

    if (slug) initPageData();
  }, [slug, router]);

  const handleContinueLearning = async () => {
    if (!course || !hasEnrolled) return;
    setIsEnrolling(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const destination = await getDestinationRoute(course, user.id);
        if (destination) {
          router.push(destination);
        } else {
          toast.warning("Khóa học chưa có bài học nào.");
          setIsEnrolling(false);
        }
      }
    } catch {
      setIsEnrolling(false);
    }
  };

  const toggleChapter = (id: number) => {
    setExpandedChapters((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const handleExpandAll = () => {
    if (!course) return;
    const allIds = course.chapters.map((c) => c.id);
    setExpandedChapters(
      expandedChapters.length === allIds.length ? [] : allIds,
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

    if (hasPendingPayment) {
      toast.info("Đơn hàng của bạn đang chờ duyệt. Vui lòng đợi.");
      return;
    }

    if (course.price > 0) {
      setIsEnrolling(true);
      const res = await createPendingPayment(course.id);
      setIsEnrolling(false);

      if (res.error) {
        toast.error(res.error);
        if (res.error.includes("pending") || res.error.includes("chờ")) {
          setHasPendingPayment(true);
        }
        return;
      }

      if (res.success && res.paymentId) {
        setCurrentPaymentId(res.paymentId);
        setIsOpenPaymentForm(true);
      }
    } else {
      processFreeEnrollment();
    }
  };

  const processFreeEnrollment = async () => {
    setIsEnrolling(true);
    try {
      const result = await enrollCourse(course!.id);

      if (result.error) {
        toast.error(result.error);
        setIsEnrolling(false);
      } else if (result.success) {
        toast.success("Đăng ký thành công!");
        setHasEnrolled(true);
        setIsEnrolling(false);
      }
    } catch (error) {
      toast.error("Có lỗi xảy ra" + error);
      setIsEnrolling(false);
    }
  };

  const handlePaymentRequestSent = () => {
    setIsOpenPaymentForm(false);
    setHasPendingPayment(true);
  };

  // --- SKELETON ---
  if (loading)
    return (
      <div className="bg-[#111827] w-full min-h-screen p-4 flex md:p-8 flex-col lg:flex-row gap-8 justify-center">
        <div className="w-full lg:w-2/3 flex flex-col gap-8 animate-pulse">
          <div className="w-full flex flex-col gap-4">
            <div className="h-10 bg-gray-700 rounded-md w-3/4"></div>
            <div className="h-4 bg-gray-700 rounded-md w-full"></div>
            <div className="h-4 bg-gray-700 rounded-md w-5/6"></div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="h-8 bg-gray-700 rounded-md w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3 items-center">
                  <div className="w-5 h-5 bg-gray-700 rounded-full shrink-0"></div>
                  <div className="h-4 bg-gray-700 rounded-md w-full"></div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div className="h-8 bg-gray-700 rounded-md w-1/4"></div>
              <div className="h-6 bg-gray-700 rounded-md w-1/6"></div>
            </div>
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-gray-700 rounded-lg w-full border border-gray-600"
                ></div>
              ))}
            </div>
          </div>
        </div>
        <div className="w-full lg:w-1/3 animate-pulse">
          <div className="flex flex-col gap-5 w-full bg-[#1f2937] p-5 rounded-xl border border-gray-700 lg:sticky lg:top-8">
            <div className="aspect-video w-full bg-gray-700 rounded-lg"></div>
            <div className="flex flex-col gap-2 items-center">
              <div className="h-10 bg-gray-700 rounded-md w-1/2"></div>
              <div className="h-4 bg-gray-700 rounded-md w-1/3"></div>
            </div>
          </div>
        </div>
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
      {/* CỘT TRÁI: NỘI DUNG */}
      <div className="w-full lg:w-2/3 flex flex-col gap-8">
        <div className="w-full flex flex-col gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white uppercase">
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
            <p className="text-xl md:text-2xl font-bold text-white">
              Nội dung khóa học
            </p>
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

        {/* --- THÔNG TIN GIẢNG VIÊN --- */}
        {course.instructors && (
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white mb-6">
              Giảng viên hướng dẫn
            </h2>
            <div className="bg-[#1f2937] border border-gray-700 p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start">
              {/* Avatar Giảng viên */}
              <div className="shrink-0">
                <CustomAvatar
                  src={course.instructors.profiles?.avatar_url}
                  fallbackText={course.instructors.profiles?.full_name?.[0]}
                  className="w-20 h-20 border-2 border-blue-500 shadow-lg"
                  fontSize="text-3xl" // Chữ to lên cho cân đối với khung 80px
                />
              </div>

              {/* Thông tin chi tiết */}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  {course.instructors.profiles?.full_name ||
                    "Giảng viên ẩn danh"}
                  <Check
                    size={16}
                    className="text-blue-400 bg-blue-400/10 rounded-full p-0.5"
                  />
                </h3>
                <p className="text-blue-400 text-sm font-medium mb-3 uppercase tracking-wide">
                  {course.instructors.job_title}
                </p>

                <p className="text-gray-300 text-sm leading-relaxed mb-4 bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 italic">
                  {course.instructors.bio}
                </p>

                <div className="flex gap-4 text-xs text-gray-400 font-medium">
                  <div className="flex items-center gap-1.5 bg-gray-800 px-2 py-1 rounded">
                    <Briefcase size={14} className="text-gray-500" />
                    <span>Nhiều năm kinh nghiệm</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-gray-800 px-2 py-1 rounded">
                    <UserRound size={14} className="text-gray-500" />
                    <span>Hỗ trợ 1-1</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 👇 COURSE REVIEWS ĐÃ ĐƯỢC CHÈN VÀO ĐÂY 👇 */}
        <CourseReviews courseId={course.id} hasEnrolled={hasEnrolled} />
      </div>

      {/* CỘT PHẢI: SIDEBAR */}
      <div className="w-full lg:w-1/3">
        <div className="flex flex-col gap-5 w-full bg-[#1f2937] p-5 rounded-xl border border-gray-700 lg:sticky lg:top-8 shadow-xl">
          <div
            className="cursor-pointer relative aspect-video w-full rounded-lg overflow-hidden group border border-gray-700 shadow-md"
            onClick={() => setShowTrailer(true)}
          >
            <Image
              src={course.image_url}
              alt={course.name}
              fill
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <div className="group-hover:scale-110 transition-transform duration-300 drop-shadow-2xl">
                <PlayCircle size={60} className="text-white drop-shadow-md" />
              </div>
              <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg group-hover:bg-blue-600 transition-colors">
                <Film size={14} />
                <span>Xem Trailer</span>
              </div>
            </div>
          </div>

          <div
            onClick={() => setShowTrailer(true)}
            className="mt-3 flex items-center justify-center gap-2 text-sm text-blue-400 font-medium cursor-pointer hover:text-blue-300 hover:underline w-full"
          >
            <PlayCircle size={16} /> Xem video giới thiệu khóa học
          </div>

          {showTrailer && (
            <VideoModal
              videoId="cZHp-Oozg6I"
              onClose={() => setShowTrailer(false)}
            />
          )}

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
              hasEnrolled ? handleContinueLearning : handleEnrollmentClick
            }
            disabled={isEnrolling || loading || hasPendingPayment}
            className={`px-4 py-3 rounded-full cursor-pointer transition-all w-full font-bold text-lg flex justify-center items-center
              ${
                isEnrolling || hasPendingPayment
                  ? "bg-gray-600 cursor-not-allowed text-gray-300"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transform hover:-translate-y-0.5"
              }
            `}
          >
            {isEnrolling ? (
              <>
                <Loader2 className="animate-spin mr-2" size={24} /> Đang xử
                lý...
              </>
            ) : hasEnrolled ? (
              "Tiếp tục học ngay"
            ) : hasPendingPayment ? (
              "Đang chờ duyệt thanh toán..."
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

      {/* MODAL THANH TOÁN */}
      {isOpenPaymentForm && course && currentUser && currentPaymentId && (
        <CoursePaymentModal
          course={course}
          userId={currentUser.id}
          paymentId={currentPaymentId}
          onClose={() => setIsOpenPaymentForm(false)}
          onSuccess={handlePaymentRequestSent}
        />
      )}
    </div>
  );
}
