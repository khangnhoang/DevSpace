import { createClient } from "@supabase/supabase-js";

// 1. Khởi tạo Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Định nghĩa Types (Interface)
interface Course {
  id: number;
  name: string; // Trong DB là 'name'
  slug: string;
}

interface Lesson {
  id: number;
  course_id: number;
}

interface Progress {
  lesson_id: number;
}
// --------------------------------------------------------
// SECTION A: LOGIC BÀI HỌC (LESSONS)
// --------------------------------------------------------

export interface Chapter {
  id: number;
  title: string;
  order_index: number;
  lessons: {
    id: number;
    title: string;
    slug: string;
    video_url: string | null;
  }[];
}

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
    .select(`id, title, order_index, lessons (id, title, slug, video_url)`)
    .eq("course_id", course.id)
    .order("order_index", { ascending: true })
    .order("id", { referencedTable: "lessons", ascending: true });

  return (chapters ?? []) as Chapter[];
}

// --------------------------------------------------------
// SECTION B: LOGIC BÀI TẬP (QUIZ / EXERCISES)
// --------------------------------------------------------

export async function getExerciseByLesson(lessonSlug: string) {
  // 1. Lấy thông tin bài học + kèm theo slug của khóa học (Join bảng)
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
    console.error("Lỗi lấy bài tập:", error.message); // Dùng console thay vì alert
    return null;
  }

  // 3. Xử lý dữ liệu để trả về (Flatten structure)
  // Ép kiểu 'as any' để TS không báo lỗi dòng lesson.courses
  const courseSlug = (lesson as any).courses?.slug;

  return {
    lesson: {
      ...lesson,
      courseSlug: courseSlug, // Frontend cần cái này để tạo nút "Quay về"
    },
    exercises: exercises || [],
  };
}

// --------------------------------------------------------
// SECTION C: LOGIC TIẾN ĐỘ (USER PROGRESS)
// --------------------------------------------------------

// 1. Lưu tiến độ
export async function saveUserProgress(userId: string, lessonId: number) {
  const { error } = await supabase
    .from("user_progress")
    .insert({ user_id: userId, lesson_id: lessonId });

  // Mã lỗi 23505: Unique violation (Đã lưu rồi) -> Bỏ qua, không báo lỗi
  if (error && error.code !== "23505") {
    console.error("Lỗi lưu tiến độ:", error.message);
  }
}

// 2. Lấy danh sách ID các bài đã học
export async function getCompletedLessonIds(userId: string) {
  const { data } = await supabase
    .from("user_progress")
    .select("lesson_id")
    .eq("user_id", userId);

  if (!data) return [];
  return data.map((item) => item.lesson_id); // Trả về mảng số [1, 2, 5...]
}

// --------------------------------------------------------
// SECTION D: LOGIC DASHBOARD (PROFILE PAGE)
// --------------------------------------------------------

export async function getUserDashboardData(userId: string) {
  // 1. Lấy danh sách Khóa học (Courses)
  const { data: allCourses } = await supabase
    .from("courses")
    .select("id, name, slug") // Lưu ý: DB bạn là 'name', code cũ là 'title' -> phải lấy 'name'
    .returns<Course[]>();

  if (!allCourses || allCourses.length === 0) return [];

  // 2. Lấy danh sách Bài học (Lessons) để tính tổng số bài
  const { data: allLessons } = await supabase
    .from("lessons")
    .select("id, course_id")
    .returns<Lesson[]>();

  // 3. Lấy Tiến độ của User (Progress)
  const { data: progressData } = await supabase
    .from("user_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .returns<Progress[]>();

  // Chuyển đổi dữ liệu progress thành mảng ID cho dễ so sánh
  const completedLessonIds = progressData?.map((p) => p.lesson_id) || [];

  // 4. Tính toán phần trăm (Mapping)
  const dashboardData = allCourses.map((course) => {
    // Lọc ra các bài học thuộc khóa này
    const lessonsOfCourse =
      allLessons?.filter((l) => l.course_id === course.id) || [];
    const totalLessons = lessonsOfCourse.length;

    // Đếm số bài user đã hoàn thành trong khóa này
    const userCompletedCount = lessonsOfCourse.filter((l) =>
      completedLessonIds.includes(l.id)
    ).length;

    // Tính % (Tránh chia cho 0)
    const percent =
      totalLessons > 0
        ? Math.round((userCompletedCount / totalLessons) * 100)
        : 0;

    return {
      id: course.id,
      title: course.name, // Mapping lại: DB là 'name' -> UI dùng 'title'
      slug: course.slug,
      total: totalLessons,
      completed: userCompletedCount,
      percent: percent,
      isStarted: userCompletedCount > 0,
    };
  });

  return dashboardData.filter((course) => course.isStarted); // Chỉ trả về các khóa đã bắt đầu
}

export type HomeCourseData = DashboardCourse & {
  firstLessonSlug: string | null;
};

type DashboardCourse = {
  id: number;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  lessons?: { slug: string; id: number }[] | null;
};

export async function getDashboardData(): Promise<HomeCourseData[]> {
  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, name, slug, description, image_url, lessons (slug, id)")
    .order("id", { ascending: true })
    .order("id", { referencedTable: "lessons", ascending: true });

  if (error) {
    console.error("Lỗi lấy khóa học ", error.message);
    return [];
  }

  const safeCourses = (courses || []) as DashboardCourse[];

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
    .from("lessons")
    .select("id, title, course_id, slug, courses(id, slug)")
    .or(`title.ilike.%${query}%`);

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

export interface DashboardStats {
  students: number;
  lessons: number;
  exercises: number;
  completed: number;
}

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

const CHART_COLORS = [
  "#00d25b", // Xanh lá (Giống Paypal trong ảnh)
  "#ffab00", // Vàng (Giống Stripe)
  "#0090e7", // Xanh dương
  "#fc424a", // Đỏ
  "#8f5fe8", // Tím
];

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

  return chartData.filter((item) => item.value > 0);
}

export interface AdminCourseData {
  id: number;
  name: string;
  description: string;
  slug: string;
  image_url: string;
  lessonCount: number;
}

export async function getAdminCourseData() {
  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, name, description, slug, image_url, lessons (id)")
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
  },
  newImageFile?: File | null
) {
  let finalImageUrl = courseData.image_url;

  if (newImageFile) {
    const fileName = `course_${id}_${Date.now()}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, newImageFile);

    if (uploadError) {
      console.error("Lỗi upload ảnh: ", uploadError.message);
      return { error: uploadError };
    }

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
    })
    .eq("id", id);

  return { error };
}

export async function addCourse(
  coursesData: {
    name: string;
    slug: string;
    description: string;
  },
  imageFile?: File | null
) {
  let imageUrl = "";

  if (imageFile) {
    const fileName = `course_new_${Date.now()}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, imageFile);

    if (uploadError) {
      console.log("Lỗi khi thêm:", uploadError.message);
      return { error: uploadError };
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
    imageUrl = data.publicUrl;
  }

  const { error: insertError } = await supabase.from("courses").insert({
    name: coursesData.name,
    slug: coursesData.slug,
    description: coursesData.description,
    image_url: imageUrl,
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
    console.error("Lỗi lấy dữ liệu khóa học cho form thêm: ", error.message);
    return [];
  }

  return data || [];
}

export async function getChaptersByCourseId(courseId: number) {
  const { data, error } = await supabase
    .from("chapters")
    .select("id, title")
    .eq("course_id", courseId)
    .order("id", { ascending: true });

  if (error) {
    console.error("Lỗi lấy chương theo khóa học: ", error.message);
    return [];
  }

  return data || [];
}

export async function getLessons() {
  const { data, error } = await supabase
    .from("lessons")
    .select(
      "id, title, slug, content, course_id, chapter_id, video_url, courses (id, name), chapters (id, title)"
    )
    .order("course_id", { ascending: true })
    .order("chapter_id", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("Lỗi lấy danh sách bài học: ", error.message);
    return [];
  }

  return data || [];
}

export async function addLesson(lessonData: {
  title: string;
  slug: string;
  content: string;
  course_id: number;
  chapter_id: number;
  video_url?: string;
}) {
  const { error } = await supabase.from("lessons").insert({
    title: lessonData.title,
    slug: lessonData.slug,
    content: lessonData.content,
    course_id: lessonData.course_id,
    chapter_id: lessonData.chapter_id,
    video_url: lessonData.video_url || null,
  });

  return { error };
}

export async function deleteLesson(id: number) {
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  return { error };
}

export async function editLesson(
  id: number,
  lessonData: {
    title: string;
    slug: string;
    content: string;
    course_id: number;
    chapter_id: number;
    video_url?: string | null;
  }
) {
  const { error } = await supabase
    .from("lessons")
    .update({
      title: lessonData.title,
      slug: lessonData.slug,
      content: lessonData.content,
      course_id: lessonData.course_id,
      chapter_id: lessonData.chapter_id,
      video_url: lessonData.video_url || null,
    })
    .eq("id", id);

  return { error };
}

export async function getCourseChapterManager() {
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, slug")
    .order("id", { ascending: true });

  if (error) {
    console.error("Lỗi khi tải khoá học", error.message);
    return [];
  }

  return data || [];
}

export async function getChapterForChapterManager() {
  const { data, error } = await supabase
    .from("chapters")
    .select("id, course_id, title, order_index, created_at")
    .order("order_index", { ascending: true });

  if (error) {
    console.error("Lỗi khi tải chương", error.message);
    return [];
  }

  return data || [];
}

export async function deleteChapter(id: number) {
  const { error } = await supabase.from("chapters").delete().eq("id", id);
  return { error };
}

export async function addChapter(dataChapter: {
  course_id: number;
  title: string;
  order_index: number;
}) {
  const { error } = await supabase.from("chapters").insert({
    course_id: dataChapter.course_id,
    title: dataChapter.title,
    order_index: dataChapter.order_index,
  });

  return { error };
}

export async function editChapter(
  id: number,
  dataChapter: {
    course_id: number;
    title: string;
    order_index: number;
  }
) {
  const { error } = await supabase
    .from("chapters")
    .update({
      course_id: dataChapter.course_id,
      title: dataChapter.title,
      order_index: dataChapter.order_index,
    })
    .eq("id", id);

  return { error };
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
}

export async function getAllUsersForUsersManager() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, role, created_at")
    .order("id", { ascending: false });

  if (error) {
    console.error("Lỗi khi tải người dùng", error.message);
    return [];
  }

  return data as UserProfile[];
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

  if (uploadError) {
    console.error("Lỗi upload ảnh:", uploadError.message);
    return null;
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
  return data.publicUrl;
}

export async function editUser(
  id: string,
  dataUser: {
    full_name: string | null;
    avatar_url: string | null;
    role: string;
  },
  newImageFile?: File | null
) {
  let finalImageUrl = dataUser.avatar_url;

  if (newImageFile) {
    const uploadedUrl = await uploadUserAvatar(newImageFile);
    if (uploadedUrl) {
      finalImageUrl = uploadedUrl;
    } else {
      return { error: { message: "Lỗi khi upload avatar user" } };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: dataUser.full_name,
      avatar_url: finalImageUrl,
      role: dataUser.role,
    })
    .eq("id", id);

  return { error };
}

export async function getExerciseByLessonId(lessonId: number | null) {
  if(!lessonId){
    return [];
  }

  const { data, error } = await supabase
    .from("exercises")
    .select(
      "id, lesson_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation"
    )
    .eq("lesson_id", lessonId)
    .order("id", { ascending: true });

  if (error) {
    console.error("Lỗi khi lấy bài tập", error.message);
    return [];
  }

  return data || [];
}

export interface exerciseData {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string | "";
}

export async function addExercise(
  lessonId: number | null,
  exerciseData: exerciseData
) {
  if (!lessonId){
    console.error('Chưa có mã bài học, không thể lấy bài tập');
    return { 
      error: { 
        message: "Chưa có mã bài học", 
        details: "", 
        hint: "", 
        code: "MISSING_LESSON_ID" 
      } 
    };
  }

  const { error } = await supabase
    .from("exercises")
    .insert({
      lesson_id: lessonId,
      question: exerciseData.question,
      option_a: exerciseData.option_a,
      option_b: exerciseData.option_b,
      option_c: exerciseData.option_c,
      option_d: exerciseData.option_d,
      correct_answer: exerciseData.correct_answer,
      explanation: exerciseData.explanation || "",
    })
    .select();

  return { error };
}

export async function deleteExercise(exerciseId: number) {
  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", exerciseId)
    .select();

  return { error };
}

export async function editExercise(
  exerciseId: number,
  exerciseData: exerciseData
) {
  const { error } = await supabase
    .from("exercises")
    .update({
      question: exerciseData.question,
      option_a: exerciseData.option_a,
      option_b: exerciseData.option_b,
      option_c: exerciseData.option_c,
      option_d: exerciseData.option_d,
      correct_answer: exerciseData.correct_answer,
      explanation: exerciseData.explanation || "",
    })
    .eq("id", exerciseId)
    .select();

  return { error };
}
