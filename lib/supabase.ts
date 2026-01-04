import { createClient } from "@supabase/supabase-js";

// ✅ 1. IMPORT & RE-EXPORT
// Dòng này giúp các file khác vẫn import type từ đây được (không gãy code cũ)
export * from "@/lib/types";

// Import nội bộ để dùng trong file này
import type {
  DBCourse,
  DBLesson,
  DBProgress,
  DBChapter,
  DBProfile,
  DashboardCourse,
  HomeCourseData,
  AdminCourseData,
  DashboardStats,
  CourseDetail,
  ExerciseData,
  LessonItem,
  ChapterItem,
  ProfileData,
} from "@/lib/types";

// 2. Khởi tạo Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// --------------------------------------------------------
// SECTION A: LOGIC BÀI HỌC (LESSONS)
// --------------------------------------------------------

export async function getLessonsByCourse(courseSlug: string) {
  // Bước 1: Tìm xem cái slug 'html-css' là ID số mấy?
  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("slug", courseSlug)
    .single();

  if (!course) return [];

  // Bước 2: Lấy các bài học thuộc ID đó
  const { data: chapters } = await supabase
    .from("chapters")
    .select(
      `id, title, order_index, lessons (id, title, slug, video_url, exercises (count))`
    )
    .eq("course_id", course.id)
    .order("order_index", { ascending: true })
    .order("id", { referencedTable: "lessons", ascending: true });

  const formattedChapters = (chapters || []).map((ch: any) => ({
    ...ch,
    lessons: (ch.lessons || []).map((l: any) => ({
      ...l,
      has_exercise: l.exercises && l.exercises[0]?.count > 0,
      exercises: undefined,
    })),
  }));

  return formattedChapters as any[]; // Trả về Chapter[]
}

// --------------------------------------------------------
// SECTION B: LOGIC BÀI TẬP (QUIZ / EXERCISES)
// --------------------------------------------------------

export async function getExerciseByLesson(lessonSlug: string) {
  // 1. Lấy thông tin bài học + kèm theo slug của khóa học
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, slug, course_id, courses ( slug )")
    .eq("slug", lessonSlug)
    .single();

  if (!lesson) return null;

  // 2. Lấy danh sách câu hỏi trắc nghiệm
  const { data: exercises, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("lesson_id", lesson.id)
    .order("id", { ascending: true });

  if (error) {
    console.error("Lỗi lấy bài tập:", error.message);
    return null;
  }

  // 3. Xử lý dữ liệu
  const courseSlug = (lesson as any).courses?.slug;

  return {
    lesson: {
      ...lesson,
      courseSlug: courseSlug,
    },
    exercises: exercises || [],
  };
}

// --------------------------------------------------------
// SECTION C: LOGIC TIẾN ĐỘ (USER PROGRESS)
// --------------------------------------------------------

export async function saveUserProgress(userId: string, lessonId: number) {
  const { error } = await supabase
    .from("user_progress")
    .insert({ user_id: userId, lesson_id: lessonId });

  // Mã lỗi 23505: Unique violation (Đã lưu rồi) -> Bỏ qua
  if (error && error.code !== "23505") {
    console.error("Lỗi lưu tiến độ:", error.message);
  }
}

export async function getCompletedLessonIds(userId: string) {
  const { data } = await supabase
    .from("user_progress")
    .select("lesson_id")
    .eq("user_id", userId);

  if (!data) return [];
  return data.map((item) => item.lesson_id);
}

// --------------------------------------------------------
// SECTION D: LOGIC DASHBOARD (PROFILE PAGE)
// --------------------------------------------------------

export async function getUserDashboardData(
  userId: string
): Promise<DashboardCourse[]> {
  // 1. Lấy danh sách Khóa học
  const { data: allCoursesData } = await supabase
    .from("courses")
    .select("id, name, slug"); // Lấy 'name' từ DB

  const allCourses = (allCoursesData || []) as DBCourse[];
  if (allCourses.length === 0) return [];

  // 2. Lấy danh sách Bài học
  const { data: allLessonsData } = await supabase
    .from("lessons")
    .select("id, course_id");
  const allLessons = (allLessonsData || []) as DBLesson[];

  // 3. Lấy Tiến độ của User
  const { data: progressData } = await supabase
    .from("user_progress")
    .select("lesson_id")
    .eq("user_id", userId);

  const userProgress = (progressData || []) as DBProgress[];

  // Chuyển đổi dữ liệu progress thành mảng ID
  const completedLessonIds = userProgress.map((p) => p.lesson_id);

  // 4. Tính toán phần trăm
  const dashboardData = allCourses.map((course) => {
    const lessonsOfCourse = allLessons.filter((l) => l.course_id === course.id);
    const totalLessons = lessonsOfCourse.length;

    const userCompletedCount = lessonsOfCourse.filter((l) =>
      completedLessonIds.includes(l.id)
    ).length;

    const percent =
      totalLessons > 0
        ? Math.round((userCompletedCount / totalLessons) * 100)
        : 0;

    return {
      id: course.id,
      title: course.name, // ✅ Mapping: DB 'name' -> UI 'title'
      slug: course.slug,
      total: totalLessons,
      completed: userCompletedCount,
      percent: percent,
      isStarted: userCompletedCount > 0,
    };
  });

  return dashboardData.filter((course) => course.isStarted);
}

export async function getDashboardData(): Promise<HomeCourseData[]> {
  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, name, slug, description, image_url, price, lessons (slug, id)")
    .order("id", { ascending: true })
    .order("id", { referencedTable: "lessons", ascending: true });

  if (error) {
    console.error("Lỗi lấy khóa học ", error.message);
    return [];
  }

  // Ép kiểu sang DBCourse có kèm relation lessons
  const safeCourses = (courses || []) as unknown as DBCourse[];

  return safeCourses.map((course) => {
    const firstLesson = course.lessons?.[0];

    return {
      ...course,
      firstLessonSlug: firstLesson?.slug || null,
    };
  });
}

export async function searchLesson(query: string) {
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, slug, price, image_url")
    .or(`name.ilike.%${query}%`);

  if (!query.trim()) return [];

  if (error) {
    console.error("Lỗi tìm kiếm", error);
    return [];
  }

  return data || [];
}

// --------------------------------------------------------
// SECTION E: LOGIC THỐNG KÊ (ADMIN DASHBOARD)
// --------------------------------------------------------

export async function getAdminDashboardStats() {
  try {
    const [
      { count: studentsCount },
      { count: lessonsCount },
      { count: exercisesCount },
      { count: completedCount },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "user"),
      supabase.from("lessons").select("*", { count: "exact", head: true }),
      supabase.from("exercises").select("*", { count: "exact", head: true }),
      supabase
        .from("user_progress")
        .select("*", { count: "exact", head: true }),
    ]);

    return {
      students: studentsCount || 0,
      lessons: lessonsCount || 0,
      exercises: exercisesCount || 0,
      completed: completedCount || 0,
    } as DashboardStats;
  } catch (error) {
    console.error("Lỗi lấy thống kê admin dashboard: ", error);
    return null;
  }
}

const CHART_COLORS = ["#00d25b", "#ffab00", "#0090e7", "#fc424a", "#8f5fe8"];

export async function getAdminCourseChartData() {
  const { data: courses, error } = await supabase
    .from("courses")
    .select("name, lessons (id)");

  if (error) {
    console.error("Lỗi lấy dữ liệu khóa học cho biểu đồ: ", error.message);
    return [];
  }

  const chartData = courses?.map((course: any, index: number) => {
    const lessonCount = course.lessons?.length || 0;
    return {
      name: course.name,
      value: lessonCount,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
  });

  return chartData.filter((item: any) => item.value > 0);
}

export async function getAdminCourseData() {
  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, name, description, slug, image_url, price, lessons (id)")
    .order("id", { ascending: true });

  if (error) {
    console.error("Lỗi lấy dữ liệu khóa học cho admin: ", error.message);
    return [];
  }

  const formattedData = courses?.map((course: any) => {
    const { lessons, ...rest } = course;
    return {
      ...rest,
      lessonCount: lessons.length || 0,
    };
  });

  return formattedData as AdminCourseData[];
}

export async function updateCourse(
  id: number,
  courseData: {
    name: string;
    slug: string;
    description: string;
    image_url: string;
    price: number;
  },
  newImageFile?: File | null
) {
  let finalImageUrl = courseData.image_url;

  if (newImageFile) {
    const fileName = `course_${id}_${Date.now()}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, newImageFile);

    if (uploadError) return { error: uploadError };

    const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
    finalImageUrl = data.publicUrl;
  }

  const { error } = await supabase
    .from("courses")
    .update({
      name: courseData.name,
      slug: courseData.slug,
      description: courseData.description,
      image_url: finalImageUrl,
      price: courseData.price,
    })
    .eq("id", id);

  return { error };
}

export async function addCourse(
  coursesData: {
    name: string;
    slug: string;
    description: string;
    price: number;
  },
  imageFile?: File | null
) {
  let imageUrl = "";

  if (imageFile) {
    const fileName = `course_new_${Date.now()}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, imageFile);

    if (uploadError) return { error: uploadError };

    const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
    imageUrl = data.publicUrl;
  }

  const { error: insertError } = await supabase.from("courses").insert({
    name: coursesData.name,
    slug: coursesData.slug,
    description: coursesData.description,
    image_url: imageUrl,
    price: coursesData.price,
  });

  return { insertError };
}

export async function deleteCourse(id: number) {
  const { error } = await supabase.from("courses").delete().eq("id", id);
  return { error };
}

export async function getCoursesForSelect() {
  const { data, error } = await supabase
    .from("courses")
    .select("id, name")
    .order("id", { ascending: true });

  if (error) {
    console.error("Lỗi lấy dữ liệu khóa học: ", error.message);
    return [];
  }
  return (data || []) as DBCourse[];
}

export async function getChaptersByCourseId(courseId: number) {
  const { data, error } = await supabase
    .from("chapters")
    .select("id, title")
    .eq("course_id", courseId)
    .order("id", { ascending: true });

  if (error) return [];
  return (data || []) as DBChapter[];
}

export async function getLessons() {
  const { data, error } = await supabase
    .from("lessons")
    .select(
      "id, title, slug, content, course_id, chapter_id, video_url, order_index, courses (id, name), chapters (id, title)"
    )
    .order("course_id", { ascending: true })
    .order("chapter_id", { ascending: true })
    .order("id", { ascending: true });

  if (error) return [];
  return data || [];
}

export async function addLesson(lessonData: any) {
  const { error } = await supabase.from("lessons").insert({
    title: lessonData.title,
    slug: lessonData.slug,
    content: lessonData.content,
    course_id: lessonData.course_id,
    chapter_id: lessonData.chapter_id,
    video_url: lessonData.video_url || null,
    order_index: lessonData.order_index === "" ? null : lessonData.order_index,
  });
  return { error };
}

export async function deleteLesson(id: number) {
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  return { error };
}

export async function editLesson(id: number, lessonData: any) {
  const { error } = await supabase
    .from("lessons")
    .update({
      title: lessonData.title,
      slug: lessonData.slug,
      content: lessonData.content,
      course_id: lessonData.course_id,
      chapter_id: lessonData.chapter_id,
      video_url: lessonData.video_url || null,
      order_index:
        lessonData.order_index === "" ? null : lessonData.order_index,
    })
    .eq("id", id);
  return { error };
}

export async function getCourseChapterManager() {
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, slug")
    .order("id", { ascending: true });

  if (error) return [];
  return (data || []) as DBCourse[];
}

export async function getChapterForChapterManager() {
  const { data, error } = await supabase
    .from("chapters")
    .select("id, course_id, title, order_index, created_at")
    .order("order_index", { ascending: true });

  if (error) return [];
  return (data || []) as DBChapter[];
}

export async function deleteChapter(id: number) {
  const { error } = await supabase.from("chapters").delete().eq("id", id);
  return { error };
}

export async function addChapter(dataChapter: any) {
  const { error } = await supabase.from("chapters").insert(dataChapter);
  return { error };
}

export async function editChapter(id: number, dataChapter: any) {
  const { error } = await supabase
    .from("chapters")
    .update(dataChapter)
    .eq("id", id);
  return { error };
}

export async function getAllUsersForUsersManager() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, role, created_at")
    .order("id", { ascending: false });

  if (error) return [];
  return data as DBProfile[];
}

export async function deleteUser(id: string) {
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  return { error };
}

export async function uploadUserAvatar(file: File) {
  const fileName = `avatar_${Date.now()}_${file.name.replace(/\s/g, "_")}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(fileName, file);

  if (uploadError) return null;
  const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
  return data.publicUrl;
}

export async function editUser(
  id: string,
  dataUser: any,
  newImageFile?: File | null
) {
  let finalImageUrl = dataUser.avatar_url;
  if (newImageFile) {
    const uploadedUrl = await uploadUserAvatar(newImageFile);
    if (uploadedUrl) finalImageUrl = uploadedUrl;
    else return { error: { message: "Lỗi upload avatar" } };
  }
  const { error } = await supabase
    .from("profiles")
    .update({ ...dataUser, avatar_url: finalImageUrl })
    .eq("id", id);
  return { error };
}

export async function getExerciseByLessonId(lessonId: number | null) {
  if (!lessonId) return [];
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("id", { ascending: true });

  if (error) return [];
  return data || [];
}

export async function addExercise(
  lessonId: number | null,
  exerciseData: ExerciseData
) {
  if (!lessonId) return { error: { message: "Thiếu ID bài học" } };
  const { error } = await supabase
    .from("exercises")
    .insert({ lesson_id: lessonId, ...exerciseData })
    .select();
  return { error };
}

export async function deleteExercise(exerciseId: number) {
  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", exerciseId);
  return { error };
}

export async function editExercise(
  exerciseId: number,
  exerciseData: ExerciseData
) {
  const { error } = await supabase
    .from("exercises")
    .update(exerciseData)
    .eq("id", exerciseId);
  return { error };
}

function estimateTime(content: string | null, hasVideo: boolean): number {
  if (hasVideo) return 600;
  if (!content) return 60;
  const words = content
    .replace(/<[^>]*>?/gm, "")
    .trim()
    .split(/\s+/).length;
  return Math.max(60, Math.ceil((words / 200) * 60));
}

export async function getFullCourseDetail(
  slug: string
): Promise<CourseDetail | null> {
  const { data: course } = await supabase
    .from("courses")
    .select("id, name, slug, description, image_url, price")
    .eq("slug", slug)
    .single();

  if (!course) {
    console.error("Lỗi khi lấy khóa học");
    return null;
  }

  const { data: chapter } = await supabase
    .from("chapters")
    .select(
      "id, title, order_index, lessons (id, title, slug, video_url, content, exercises (count))"
    )
    .eq("course_id", course.id)
    .order("order_index", { ascending: true })
    .order("id", { referencedTable: "lessons", ascending: true });

  let totalSeconds = 0;
  let lessonCount = 0;

  const formattedChapters = (chapter || []).map((ch: any) => ({
    id: ch.id,
    title: ch.title,
    lessons: (ch.lessons || []).map((l: any) => {
      lessonCount++;
      const hasVideo = !!l.video_url;
      const duration = estimateTime(l.content, hasVideo);
      totalSeconds += duration;
      const hasExercise = l.exercises?.[0]?.count > 0;

      return {
        id: l.id,
        title: l.title,
        slug: l.slug,
        video_url: l.video_url,
        type: hasVideo ? "video" : "reading",
        duration_display: `${Math.floor(duration / 60)
          .toString()
          .padStart(2, "0")}:${(duration % 60).toString().padStart(2, "0")}`,
        has_exercise: hasExercise,
      };
    }),
  }));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  return {
    id: course.id,
    name: course.name,
    slug: course.slug,
    description: course.description || "",
    image_url: course.image_url || "",
    price: course.price,
    price_text:
      course.price === 0
        ? "Miễn phí"
        : new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
          }).format(course.price ?? 0),
    stats: {
      level: "cơ bản",
      lesson_count: lessonCount,
      duration: hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`,
      accessibility: "Học mọi lúc, mọi nơi",
    },
    learning_outcomes: [
      "Kiến thức nền tảng",
      "Tư duy logic",
      "Thực hành dự án",
      "Giải quyết vấn đề",
    ],
    chapters: formattedChapters,
  };
}

export async function checkHasEnroll(slug: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!course) return false;

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", course.id)
    .maybeSingle();

  return !!enrollment;
}

export async function getLastAccessedLessonSlug(
  userId: string,
  courseId: number
) {
  const { data, error } = await supabase
    .from("user_progress")
    .select(`completed_at, lessons!inner (slug, course_id)`)
    .eq("user_id", userId)
    .eq("lessons.course_id", courseId)
    .order("completed_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  const lessonData = data[0].lessons as any;
  return Array.isArray(lessonData) ? lessonData[0]?.slug : lessonData?.slug;
}

export async function checkAndSaveProgress(userId: string, lessonId: number) {
  const { data: exercise, error: exError } = await supabase
    .from("exercises")
    .select("*")
    .eq("lesson_id", lessonId)
    .limit(1);

  if (exError) {
    console.error("Lỗi khi kiểm tra bài tập", exError);
    // Thêm saved: false để đồng bộ cấu trúc object
    return { hasExercise: false, error: exError, saved: false };
  }

  const hasExercise = exercise && exercise.length > 0;

  if (!hasExercise) {
    const { error: saveError } = await supabase.from("user_progress").insert({
      user_id: userId,
      lesson_id: lessonId,
    });

    if (saveError && saveError.code !== "23505") {
      console.log({ hasExercise: false, saved: false, error: saveError });
      // Trả về error nếu lưu thất bại
      return { hasExercise: false, saved: false, error: saveError };
    }

    return { hasExercise: false, saved: true, error: null };
  }

  return { hasExercise: true, saved: false, error: null };
}

export async function getLastAccessedLessonId(
  userId: string,
  courseSlug: string
) {
  const { data: courseData } = await supabase
    .from("courses")
    .select("id")
    .eq("slug", courseSlug)
    .single();

  if (!courseData) return null;
  const courseId = courseData.id;

  const { data: progressData } = await supabase
    .from("user_progress")
    .select(`lessons!inner (id, course_id)`)
    .eq("user_id", userId)
    .eq("lessons.course_id", courseId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (progressData && progressData.lessons) {
    const lessonInfo = progressData.lessons as any;
    return Array.isArray(lessonInfo) ? lessonInfo[0].id : lessonInfo.id;
  }

  const { data: firstLesson } = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", courseId)
    .order("id", { ascending: true })
    .limit(1)
    .single();

  return firstLesson ? firstLesson.id : null;
}

export async function checkUserAndHasEnroll(
  userId: string,
  courseSlug: string
) {
  const { data: courseData, error: courseError } = await supabase
    .from("courses")
    .select("id")
    .eq("slug", courseSlug)
    .single();

  if (courseError || !courseData) {
    console.error(
      "Lỗi khi lấy courseId cho việc kiểm tra user, đăng ký khóa học",
      courseError
    );
    return { enrolled: false, error: courseError };
  }

  const courseId = courseData.id;

  if (!userId) {
    console.error("Chưa đăng nhập");
    return { enrolled: false };
  }

  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", courseId)
    .eq("user_id", userId)
    .maybeSingle();

  if (enrollmentError) {
    console.error(
      "Có lỗi khi kiểm tra người dùng đăng ký khóa học",
      enrollmentError
    );
    return { enrolled: false, error: enrollmentError };
  }

  if (enrollmentData) {
    return { enrolled: true, error: enrollmentError };
  } else {
    return { enrolled: false, error: enrollmentError };
  }
}

// Logic Notes
export async function getLessonNotes(userId: string, lessonId: number) {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .order("timestamp", { ascending: true });

  if (error) return [];
  return data;
}

export async function createNote(
  userId: string,
  lessonId: number,
  content: string,
  timestamp: number
) {
  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      lesson_id: lessonId,
      content: content,
      timestamp: Math.floor(timestamp),
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function deleteNote(noteId: number) {
  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  return { error };
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, dob, province, gender")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Lỗi khi lấy dữ liệu người dùng", error);
    return;
  }

  return data as ProfileData;
}

export async function updateProfile(
  userId: string,
  dataUser: {
    full_name: string;
    gender: string;
    dob: string;
    province: string;
    avatar_url: string;
  },
  newImageFile?: File | null
) {
  let finalImageUrl = dataUser.avatar_url;
  if (newImageFile) {
    const uploadedUrl = await uploadUserAvatar(newImageFile);
    if (uploadedUrl) finalImageUrl = uploadedUrl;
    else return { error: { message: "Lỗi upload avatar" } };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: dataUser.full_name,
      gender: dataUser.gender,
      dob: dataUser.dob,
      province: dataUser.province,
      avatar_url: finalImageUrl,
    })
    .eq("id", userId);

  return { error };
}

export async function getCommentByLesson(lessonId: number) {
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, content, created_at, deleted_at, user_id, profiles(full_name, avatar_url, role)"
    )
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching comments:", error);
    return [];
  }
  return data;
}

export async function addComment(
  lessonId: number,
  userId: string,
  content: string
) {
  // --- LỚP BẢO VỆ 2: CHECK DB TRƯỚC KHI INSERT ---

  // 1. Tạo mốc thời gian 5 phút trước
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // 2. Hỏi Database: "Ông này có comment nào y hệt trong 5 phút qua không?"
  const { data: existed } = await supabase
    .from("comments")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("user_id", userId)
    .eq("content", content.trim()) // Nội dung y hệt
    .gte("created_at", fiveMinutesAgo) // Trong vòng 5 phút
    .is("deleted_at", null) // Chưa xóa
    .limit(1);

  // 3. Nếu có -> Báo lỗi DUPLICATE luôn, không cho Insert
  if (existed && existed.length > 0) {
    return {
      message: "Bạn thao tác quá nhanh! Vui lòng không spam nội dung cũ.",
      code: "DUPLICATE_SPAM",
    };
  }

  // --- NẾU ỔN THÌ MỚI INSERT ---
  const { error } = await supabase.from("comments").insert({
    user_id: userId,
    content: content.trim(),
    lesson_id: lessonId,
  });

  return error;
}

export async function editComment(
  commentId: number,
  userId: string,
  content: string
) {
  const { error } = await supabase
    .from("comments")
    .update({
      content: content.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .eq("user_id", userId);

  return error;
}

export async function deleteComment(commentId: number, userId: string) {
  const { data, error } = await supabase
    .from("comments")
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .eq("user_id", userId)
    .select("id"); // Cần Policy SELECT mới để dòng này chạy được

  // Nếu có lỗi từ Supabase (VD: RLS chặn)
  if (error) {
    console.error("Supabase Error:", error);
    return error;
  }

  // Nếu không tìm thấy comment (VD: Đã xóa rồi hoặc không phải chính chủ)
  if (!data || data.length === 0) {
    return { message: "Không tìm thấy bình luận hoặc bạn không có quyền xóa." };
  }

  return null; // Thành công
}
