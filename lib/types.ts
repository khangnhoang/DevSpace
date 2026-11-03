// app/types/index.ts

// --- 1. TYPE CHO DATABASE (Mapping 1:1 với cột trong DB) ---
// Dùng khi fetch dữ liệu thô từ Supabase

export interface DBCourse {
  id: number;
  name: string; // Trong DB là 'name'
  slug: string;
  description?: string;
  image_url?: string;
  price?: number;
  lessons?: { id: number; slug: string }[] | null; // Relation
}

export interface DBLesson {
  id: number;
  title: string;
  slug: string;
  content?: string | null;
  course_id: number;
  chapter_id?: number;
  video_url?: string | null;
  created_at?: string;
  has_exercise?: boolean; // Field tính toán thêm
}

export interface DBChapter {
  id: number;
  title: string;
  course_id: number;
  order_index: number;
  created_at: string;
  lessons?: DBLesson[];
}

export interface DBProgress {
  lesson_id: number;
  user_id?: string;
  completed_at?: string;
}

export interface DBProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
}

export interface DBExercise {
  id: number;
  lesson_id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string | null;
}

// --- 2. TYPE CHO GIAO DIỆN (UI) ---
// Dùng để hiển thị, đã qua xử lý logic

// Dùng cho Dashboard (Trang hồ sơ)
export interface DashboardCourse {
  id: number;
  title: string; // Đã map từ 'name' sang
  slug: string;
  total: number;
  completed: number;
  percent: number;
  isStarted: boolean;
  isEnrolled: boolean;
  imageUrl: string | null;
  // Latest completed_at of the learner's progress in the course, else the enrollment's created_at (ISO); orders the list.
  lastActivityAt: string | null;
  // Where the card leads: the next unfinished lesson, or the course page when the course has no lesson.
  href: string;
}

// Dùng cho Trang chủ
export type HomeCourseData = DBCourse & {
  firstLessonSlug: string | null;
};

// Dùng cho trang chi tiết khóa học (Course Detail)
export interface LessonItem {
  id: number;
  title: string;
  slug: string;
  duration_display: string;
  has_exercise: boolean;
  type?: "video" | "reading";
}

export interface ChapterItem {
  id: number;
  title: string;
  lessons: LessonItem[];
}

export interface Instructor {
  id: number;
  bio: string;
  job_title: string;
  profiles: {
    full_name: string;
    avatar_url: string;
  } | null;
}

export interface CourseDetail {
  id: number;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  price: number;
  price_text: string;
  stats: {
    level: string;
    lesson_count: number;
    duration: string;
    accessibility: string;
  };
  learning_outcomes: string[];
  chapters: ChapterItem[];
  instructors: Instructor | null;
}

// Dùng cho Admin
export interface DashboardStats {
  students: number;
  lessons: number;
  exercises: number;
  completed: number;
  courses: number;
}

export interface AdminCourseData {
  id: number;
  name: string;
  description: string;
  slug: string;
  image_url: string;
  lessonCount: number;
  price: number;
  instructor_id: number | null;
}

// Dùng cho Form thêm/sửa bài tập
export interface ExerciseData {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string | null;
}

// Dùng cho trang profile
export interface ProfileData {
  full_name: string;
  avatar_url: string;
  gender: string;
  dob: string;
  province: string;
}

// --- 3. ALIAS (Giữ lại tên cũ để không gãy code đang dùng) ---
export type Lessons = DBLesson;
export type Chapter = DBChapter;
export type UserProfile = DBProfile;
export type exerciseData = ExerciseData;
export type NextLesson = DBLesson | null;
export type PrevLesson = DBLesson | null;
